import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { generateText, Output } from "ai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const recognitionSchema = z.object({
  rooms: z.array(z.object({
    room: z.number().int(),
    guests: z.array(z.string()),
    people: z.number().int().min(0).max(8),
    arrival: z.string(),
    departure: z.string(),
    included: z.boolean(),
    breakfastConfidence: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string()),
  })),
  warnings: z.array(z.string()),
});

const HOTEL_ROOMS = new Set([
  20, 21, 22, 23, 24, 25, 26, 27, 28,
  30, 31, 32, 33, 34, 35, 36, 37, 38,
  40, 41, 42, 43, 44, 45, 46, 47, 48,
  50, 51, 52, 53, 54, 56, 57, 58,
  60, 61, 62, 63, 64, 65, 66, 67, 68,
]);

type RecognizedRoom = {
  room: number;
  guests: string[];
  people: number;
  arrival: string;
  departure: string;
  included: boolean;
  breakfastConfidence: number;
  confidence: number;
  warnings: string[];
};

const cleanText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

const validDate = (value: unknown) => {
  const text = cleanText(value);
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : "";
};

const normalizeResult = (input: unknown) => {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const rawRooms = Array.isArray(source.rooms) ? source.rooms : [];
  const merged = new Map<number, RecognizedRoom>();

  for (const raw of rawRooms) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const room = Number(item.room);
    if (!HOTEL_ROOMS.has(room)) continue;

    const guests = Array.isArray(item.guests)
      ? [...new Set(item.guests.map(cleanText).filter(name => /[\p{L}]/u.test(name)))]
      : [];
    const people = Math.max(1, Math.min(8, Number(item.people) || guests.length || 1));
    const warnings = Array.isArray(item.warnings)
      ? item.warnings.map(cleanText).filter(Boolean)
      : [];
    const normalized: RecognizedRoom = {
      room,
      guests,
      people,
      arrival: validDate(item.arrival),
      departure: validDate(item.departure),
      included: Boolean(item.included),
      breakfastConfidence: Math.max(0, Math.min(1, Number(item.breakfastConfidence) || 0)),
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      warnings,
    };

    const previous = merged.get(room);
    if (!previous) {
      merged.set(room, normalized);
      continue;
    }
    merged.set(room, {
      room,
      guests: [...new Set([...previous.guests, ...normalized.guests])],
      people: Math.max(previous.people, normalized.people),
      arrival: previous.arrival || normalized.arrival,
      departure: previous.departure || normalized.departure,
      included: previous.included || normalized.included,
      breakfastConfidence: Math.max(previous.breakfastConfidence, normalized.breakfastConfidence),
      confidence: Math.max(previous.confidence, normalized.confidence),
      warnings: [...new Set([...previous.warnings, ...normalized.warnings])],
    });
  }

  const rooms = [...merged.values()].sort((a, b) => a.room - b.room).map(room => {
    const warnings = [...room.warnings];
    if (!room.guests.length) warnings.push("Kein Gastname sicher erkannt");
    if (!room.arrival || !room.departure) warnings.push("Aufenthaltsdatum kontrollieren");
    if (room.people < room.guests.length) room.people = room.guests.length;
    return { ...room, warnings: [...new Set(warnings)] };
  });

  const globalWarnings = Array.isArray(source.warnings)
    ? source.warnings.map(cleanText).filter(Boolean)
    : [];
  return { rooms, warnings: globalWarnings };
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("photos").filter((value): value is File => value instanceof File);
    if (!files.length || files.length > 4) {
      return NextResponse.json({ error: "Bitte 1 bis 4 Fotos auswählen." }, { status: 400 });
    }

    const supported = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (files.some(file => !supported.has(file.type) || file.size > 4_000_000)) {
      return NextResponse.json({ error: "Ein Foto ist zu groß oder hat ein nicht unterstütztes Format." }, { status: 400 });
    }

    const images = await Promise.all(files.map(async file => ({
      type: "file" as const,
      mediaType: file.type,
      filename: file.name,
      data: { type: "data" as const, data: new Uint8Array(await file.arrayBuffer()) },
    })));

    const { output: initialOutput } = await generateText({
      model: "google/gemini-3.7-flash",
      output: Output.object({ schema: recognitionSchema }),
      providerOptions: {
        gateway: {
          tags: ["feature:photo-list", "app:ambassador-fruehstuecksliste"],
          user: "hotel-ambassador-zurich",
        },
      },
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Lies diese fotografierten Seiten einer zusammengehörigen Hotel-Zimmerliste. Analysiere zunächst jede Seite für sich und führe die Ergebnisse anschließend zu genau einer Liste zusammen. Doppelt fotografierte Seiten oder Zimmer dürfen nur einmal vorkommen.

Extrahiere ausschließlich echte Zimmerblöcke. Gültige Zimmer sind:
20-28, 30-38, 40-48, 50-54, 56-58 und 60-68.

Für jedes Zimmer:
- room: Zimmernummer
- guests: alle vollständigen Gastnamen; jeder Name als eigener Eintrag
- people: gebuchte Personenzahl, nicht automatisch nur die Zahl erkannter Namen
- arrival und departure: exakt TT.MM.JJJJ
- included: Prüfe bei jedem Zimmer ausdrücklich die rechte Produkt-/Leistungsspalte. true, wenn dort "Continental breakfast", "Breakfast Étagère"/"Breakfast Etagere" oder eine eindeutig gleichbedeutende Frühstücksleistung steht; sonst false
- breakfastConfidence: Sicherheit nur für die Entscheidung, ob Frühstück inklusive ist, zwischen 0 und 1
- confidence: realistische Sicherheit zwischen 0 und 1
- warnings: nur konkrete Unsicherheiten

Ein Zimmerblock beginnt bei seiner Zimmernummer und endet unmittelbar vor der nächsten Zimmernummer. Wiederholte Zeilen derselben Zimmernummer gehören zu demselben Zimmerblock. Der erste Name kann sowohl in der Customer- als auch nochmals in der Companions-Spalte stehen; nimm denselben Namen innerhalb eines Zimmers nur einmal auf. Ordne Namen und Angaben niemals einem benachbarten Zimmer zu. Anreise und Abreise stehen zusammen im Aufenthaltsblock im Muster "x People TT.MM.JJJJ - TT.MM.JJJJ". Sobald du die Anreise erkennst, lies im selben Block gezielt auch die Abreise nach dem Bindestrich. Prüfe für jeden Zimmerblock separat die rechte Produktspalte auf eine Frühstücksleistung; überspringe diese Prüfung bei keinem Zimmer. Eine vollständig sichtbare, leere Produktzelle bedeutet eindeutig included=false und breakfastConfidence mindestens 0.95. Nur wenn die Produktspalte tatsächlich abgeschnitten oder unleserlich ist, setze eine niedrige breakfastConfidence und füge eine kurze Warnung hinzu. Wenn ein Zimmerblock am oberen oder unteren Bildrand abgeschnitten ist und die Angaben nicht eindeutig vollständig zugeordnet werden können, nutze die vollständige Wiederholung auf einem anderen Foto. "People" beziehungsweise "x People" ist die Personenzahl. Eine Zahl vor "Continental breakfast" ist die Gesamtzahl der Frühstücksleistungen über den Aufenthalt und niemals die Personenzahl. Erfinde keine Namen, Daten oder Leistungen. Bei unleserlichen Angaben verwende leere Strings beziehungsweise eine kurze Warnung. Ignoriere Seitenköpfe, Summenzeilen und "Number of guests".`,
          },
          ...images,
        ],
      }],
    });

    const draft = normalizeResult(initialOutput);
    const { output: verifiedOutput } = await generateText({
      model: "openai/gpt-5.4-mini",
      output: Output.object({ schema: recognitionSchema }),
      providerOptions: {
        gateway: {
          tags: ["feature:photo-list-verification", "app:ambassador-fruehstuecksliste"],
          user: "hotel-ambassador-zurich",
        },
      },
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Kontrolliere den folgenden ersten Entwurf noch einmal sorgfältig gegen alle Originalfotos und gib eine korrigierte, eindeutige Gesamtliste zurück.

Erster Entwurf:
${JSON.stringify(draft)}

Prüfe jeden Zimmerblock einzeln:
- Doppelt fotografierte Seiten und Zimmer dürfen nur einmal vorkommen.
- Ein Gast darf nicht versehentlich dem nächsten Zimmer zugeordnet werden.
- Abgeschnittene Blöcke am Bildrand nur übernehmen, wenn sie auf einem anderen Foto vollständig sind.
- Personenzahl ausschließlich aus "x People" lesen; Frühstücksmengen nicht als Personenzahl verwenden.
- Anreise und Abreise immer gemeinsam aus "x People TT.MM.JJJJ - TT.MM.JJJJ" lesen. Wenn eine Anreise vorhanden ist, suche im selben Block nochmals gezielt nach der Abreise.
- Prüfe bei jedem einzelnen Zimmer noch einmal die rechte Produkt-/Leistungsspalte. "Continental breakfast", "Breakfast Étagère" oder "Breakfast Etagere" bedeutet included=true. Eine vollständig sichtbare leere Produktzelle bedeutet eindeutig included=false und breakfastConfidence mindestens 0.95. Nur eine tatsächlich abgeschnittene oder unleserliche Spalte ist unsicher. Eine davorstehende Menge gehört zur Frühstücksleistung und darf die Personenzahl nicht verändern.
- Setze breakfastConfidence nur dann auf mindestens 0.9, wenn die Produktspalte für dieses Zimmer eindeutig lesbar ist und included dadurch sicher true oder sicher false ist.
- Keine Angaben erfinden. Unsichere Angaben kurz auf Deutsch markieren.

Gültige Zimmer: 20-28, 30-38, 40-48, 50-54, 56-58 und 60-68.`,
          },
          ...images,
        ],
      }],
    });

    // Die Kontrollrunde darf erkannte Werte korrigieren, aber keine zuvor
    // gelesenen Angaben durch leere Felder verlieren. Nur fehlende Werte
    // werden aus dem ersten Entwurf ergänzt; die verifizierte Frühstücks-
    // entscheidung bleibt dagegen maßgeblich.
    const verified = normalizeResult(verifiedOutput);
    const draftByRoom = new Map(draft.rooms.map(room => [room.room, room]));
    const checkedRooms = verified.rooms.map(room => {
      const fallback = draftByRoom.get(room.room);
      if (!fallback) return room;
      return {
        ...room,
        guests: room.guests.length ? room.guests : fallback.guests,
        arrival: room.arrival || fallback.arrival,
        departure: room.departure || fallback.departure,
        warnings: [...new Set([...room.warnings, ...(
          (!room.arrival && fallback.arrival) || (!room.departure && fallback.departure)
            ? ["Aufenthaltsdaten aus erster Erkennung ergänzt"]
            : []
        )])],
      };
    });
    const checkedRoomNumbers = new Set(checkedRooms.map(room => room.room));
    let result = normalizeResult({
      rooms: [...checkedRooms, ...draft.rooms.filter(room => !checkedRoomNumbers.has(room.room))],
      warnings: verified.warnings,
    });
    let uncertainRooms = result.rooms.filter(room =>
      !room.guests.length || !room.arrival || !room.departure
    );
    if (uncertainRooms.length) {
      try {
        const targets = uncertainRooms.map(room => room.room);
        const { output: repairedOutput } = await generateText({
          model: "openai/gpt-5.4-mini",
          output: Output.object({ schema: recognitionSchema }),
          providerOptions: {
            gateway: {
              tags: ["feature:photo-list-targeted-repair", "app:ambassador-fruehstuecksliste"],
              user: "hotel-ambassador-zurich",
            },
          },
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: `Lies ausschließlich die noch unvollständigen Zimmer ${targets.join(", ")} erneut aus den Originalfotos. Vergrößere gedanklich den vollständigen Zimmerblock, auch wenn er nahe am oberen oder unteren Seitenrand steht.

Aktueller unvollständiger Stand:
${JSON.stringify(uncertainRooms)}

Wiederholte Zeilen derselben Zimmernummer bilden einen Block. Lies die Personenzahl und immer beide Daten aus "x People TT.MM.JJJJ - TT.MM.JJJJ". Prüfe außerdem die rechte Produktspalte: Continental breakfast oder Breakfast Étagère bedeutet included=true; eine klar sichtbare leere Produktzelle bedeutet included=false. Gib nur die genannten Zielzimmer zurück und erfinde nichts.`,
              },
              ...images,
            ],
          }],
        });
        const repaired = normalizeResult(repairedOutput);
        const repairedByRoom = new Map(repaired.rooms.map(room => [room.room, room]));
        result = normalizeResult({
          rooms: result.rooms.map(room => {
            const fix = repairedByRoom.get(room.room);
            if (!fix) return room;
            return {
              ...room,
              guests: fix.guests.length ? fix.guests : room.guests,
              people: fix.people || room.people,
              arrival: fix.arrival || room.arrival,
              departure: fix.departure || room.departure,
              included: fix.included,
              breakfastConfidence: fix.breakfastConfidence,
              confidence: fix.confidence,
              warnings: fix.warnings,
            };
          }),
          warnings: result.warnings,
        });
        uncertainRooms = result.rooms.filter(room =>
          !room.guests.length || !room.arrival || !room.departure
        );
      } catch (repairError) {
        console.warn("Targeted AI repair failed", repairError);
      }
    }
    if (uncertainRooms.length) {
      return NextResponse.json({
        error: `Diese Zimmer sind noch nicht eindeutig lesbar: ${uncertainRooms.map(room => room.room).join(", ")}. Bitte die betreffende Seite noch einmal gerade fotografieren.`,
      }, { status: 422 });
    }
    if (!result.rooms.length) {
      return NextResponse.json({ error: "Auf den Fotos wurden keine Zimmer sicher erkannt." }, { status: 422 });
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("AI photo recognition failed", error);
    const status = error && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 500;
    if (status === 402) {
      return NextResponse.json({ error: "Das AI-Guthaben ist aufgebraucht. Bitte das Budget im Vercel AI Gateway prüfen." }, { status: 402 });
    }
    if (status === 429) {
      return NextResponse.json({ error: "Die AI ist gerade ausgelastet. Bitte kurz warten und erneut versuchen." }, { status: 429 });
    }
    return NextResponse.json({ error: "Die AI konnte die Fotos nicht lesen. Bitte erneut versuchen." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const input = await request.json();
    const { rooms } = normalizeResult(input);
    if (!rooms.length) {
      return NextResponse.json({ error: "Keine Zimmer zum Exportieren." }, { status: 400 });
    }
    const invalid = rooms.find(room => !room.guests.length || !room.arrival || !room.departure);
    if (invalid) {
      return NextResponse.json({ error: `Zimmer ${invalid.room} ist noch unvollständig.` }, { status: 400 });
    }

    const rows: (string | number)[][] = [["Space number", "Customer", "Companions", "Products"]];
    for (const room of rooms) {
      const product = room.included ? `${room.people} x Continental breakfast` : "";
      rows.push([
        room.room,
        room.guests[0],
        `${room.people} People ${room.arrival} - ${room.departure}`,
        product,
      ]);
      for (const guest of room.guests.slice(1)) rows.push([room.room, "", guest, ""]);
    }
    rows.push(["Number of guests", "", rooms.reduce((sum, room) => sum + room.people, 0), ""]);

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 16 }, { wch: 30 }, { wch: 38 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Ambassador_Fotoliste_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Photo list export failed", error);
    return NextResponse.json({ error: "Die XLSX-Datei konnte nicht erstellt werden." }, { status: 500 });
  }
}

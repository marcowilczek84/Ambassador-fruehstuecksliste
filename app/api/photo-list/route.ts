import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const maxDuration = 60;

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
      confidence: Math.min(previous.confidence, normalized.confidence),
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

const extractionSchema = {
  name: "ambassador_room_list",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["rooms", "warnings"],
    properties: {
      rooms: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["room", "guests", "people", "arrival", "departure", "included", "confidence", "warnings"],
          properties: {
            room: { type: "integer" },
            guests: { type: "array", items: { type: "string" } },
            people: { type: "integer" },
            arrival: { type: "string" },
            departure: { type: "string" },
            included: { type: "boolean" },
            confidence: { type: "number" },
            warnings: { type: "array", items: { type: "string" } },
          },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll("photos").filter((value): value is File => value instanceof File);
    if (!files.length || files.length > 4) {
      return NextResponse.json({ error: "Bitte 1 bis 4 Fotos auswählen." }, { status: 400 });
    }

    const imageParts = [];
    for (const file of files) {
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: `Ungültiges oder zu großes Bild: ${file.name}` }, { status: 400 });
      }
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      imageParts.push({
        type: "image_url",
        image_url: { url: `data:${file.type};base64,${base64}`, detail: "high" },
      });
    }

    const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "Die intelligente Erkennung ist noch nicht freigeschaltet." }, { status: 503 });
    }

    const prompt = `Du liest fotografierte, gedruckte Mews-Zimmerlisten des Ambassador Hotel Zürich.
Extrahiere die Buchungsblöcke über ALLE Bilder hinweg und gib pro Hotelzimmer genau einen zusammengeführten Eintrag zurück.

Tabellenlogik:
- Gültige Zimmer: ${[...HOTEL_ROOMS].join(", ")}.
- Ein neuer Buchungsblock beginnt typischerweise mit Zimmernummer, Hauptgast, "X People TT.MM.JJJJ - TT.MM.JJJJ" und optional einem Produkt.
- Folgezeilen mit derselben Zimmernummer enthalten weitere Gastnamen in der dritten Tabellenspalte.
- Der Hauptgast kann in einer Folgezeile nochmals auftauchen: Namen immer deduplizieren.
- Wenn ein Zimmer auf zwei Fotos oder mehrfach vorkommt, Informationen zusammenführen.
- people stammt vorrangig aus "X People", nicht aus der Anzahl sichtbarer Namenszeilen.
- included ist wahr, wenn im Produkt "Continental breakfast", "breakfast étagère" oder "breakfast etagere" steht.
- "HILTON-GOLD" allein bedeutet nicht inklusive; maßgeblich ist der Frühstückstext.
- arrival und departure immer im Format TT.MM.JJJJ ausgeben, sonst leer lassen.
- Keine Namen erfinden. Unsichere Lesungen mit confidence < 0.85 und einer kurzen deutschen Warnung markieren.
- Seiten können schräg fotografiert sein und unterschiedliche Zimmerbereiche zeigen.
- Die Summenzeile "Number of guests" ist kein Zimmer.

Gib nur das verlangte JSON zurück.`;

    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.4-mini",
        messages: [{
          role: "user",
          content: [{ type: "text", text: prompt }, ...imageParts],
        }],
        response_format: { type: "json_schema", json_schema: extractionSchema },
        reasoning_effort: "medium",
        max_completion_tokens: 9000,
      }),
      cache: "no-store",
    });

    const payload = await response.json();
    if (!response.ok) {
      console.error("AI Gateway error", response.status, payload?.error?.message || "unknown");
      return NextResponse.json({ error: "Die Bilderkennung konnte nicht gestartet werden." }, { status: 502 });
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return NextResponse.json({ error: "Die Bilderkennung hat keine Daten geliefert." }, { status: 502 });
    }
    const result = normalizeResult(JSON.parse(content));
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Photo list extraction failed", error);
    return NextResponse.json({ error: "Die Fotos konnten nicht verarbeitet werden." }, { status: 500 });
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

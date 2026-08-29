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

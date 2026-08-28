import { mkdir, readFile, writeFile } from "node:fs/promises";

async function joinParts(base, count) {
  let output = "";
  for (let index = 1; index <= count; index += 1) output += await readFile(`source/${base}.part${index}.txt`, "utf8");
  return output;
}

function replaceOrThrow(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Materialization failed: ${label}`);
  return source.replace(search, replacement);
}

await mkdir("app", { recursive: true });
let app = await joinParts("BreakfastApp", 4);

/* Canonical data model + sync integrity. Every room carries its own revision so
   simultaneous edits to different rooms can be merged instead of clobbered. */
app = replaceOrThrow(app,
  '  departure?: string;\n  breakfastDay?: number;',
  '  departure?: string;\n  updatedAt?: number;\n  breakfastDay?: number;',
  "room revision field");

app = replaceOrThrow(app,
  'function RoomRow({ room, onOpen, language, editMode = false }:',
  `function mergeRoomInventories(localRooms: Room[], remoteRooms: Room[]): Room[] {
  const local = new Map(localRooms.map(room => [room.room, normalizeRoom(room)]));
  const remote = new Map(remoteRooms.map(room => [room.room, normalizeRoom(room)]));
  return HOTEL_ROOMS.map(roomNumber => {
    const a = local.get(roomNumber);
    const b = remote.get(roomNumber);
    if (!a) return b || initialRooms.find(room => room.room === roomNumber)!;
    if (!b) return a;
    return Number(a.updatedAt || 0) > Number(b.updatedAt || 0) ? a : b;
  });
}

function RoomRow({ room, onOpen, language, editMode = false }:`,
  "room merge helper");

app = replaceOrThrow(app,
  '  const cloudWriteRef = useRef<Promise<void> | null>(null);\n',
  '  const cloudWriteRef = useRef<Promise<void> | null>(null);\n  const cloudRevisionRef = useRef(0);\n',
  "cloud revision ref");

app = replaceOrThrow(app,
`      if (Array.isArray(cloud.rooms)) {
        const next = completeInventory(cloud.rooms).map(room => normalizeRoom(room));
        roomsRef.current = next;
        setRooms(next);
        localStorage.setItem("ambassador-breakfast-rooms", JSON.stringify(next));
      }`,
`      if (Array.isArray(cloud.rooms)) {
        const remote = completeInventory(cloud.rooms).map(room => normalizeRoom(room));
        const next = mergeRoomInventories(roomsRef.current, remote);
        roomsRef.current = next;
        setRooms(next);
        localStorage.setItem("ambassador-breakfast-rooms", JSON.stringify(next));
      }`,
  "cloud room merge");

app = replaceOrThrow(app,
`        const rows = await response.json() as Array<{ payload?: CloudModel; updated_at?: number }>;
        const cloud = rows?.[0]?.payload;
        if (cloud) applyCloud(cloud);
        if (active) setSyncText("Aktuell auf allen Geräten");`,
`        const rows = await response.json() as Array<{ payload?: CloudModel; updated_at?: number }>;
        const row = rows?.[0];
        const cloud = row?.payload;
        const remoteRevision = Number(row?.updated_at || cloud?.updated || 0);
        if (cloud && remoteRevision >= cloudRevisionRef.current) {
          applyCloud(cloud);
          cloudRevisionRef.current = remoteRevision;
        }
        if (active) setSyncText("Aktuell auf allen Geräten");`,
  "stale cloud response protection");

app = replaceOrThrow(app,
`        const response = await fetch(\`${'${SUPABASE_URL}'}/rest/v1/${'${CLOUD_TABLE}'}?on_conflict=list_date\`, {
          method: "POST",`,
`        const remoteResponse = await fetch(\`${'${cloudRowUrl(dateKey())}'}&select=payload,updated_at\`, { headers: cloudHeaders(), cache: "no-store" }).catch(() => null);
        if (remoteResponse?.ok) {
          const rows = await remoteResponse.json() as Array<{ payload?: CloudModel; updated_at?: number }>;
          const remotePayload = rows?.[0]?.payload;
          if (remotePayload?.rooms) payload.rooms = mergeRoomInventories(payload.rooms || [], completeInventory(remotePayload.rooms));
          if (Array.isArray(remotePayload?.v8Arrivals)) {
            const seen = new Set<string>();
            payload.v8Arrivals = [...remotePayload.v8Arrivals, ...(payload.v8Arrivals || [])].filter(event => {
              const key = [event.room, event.at, event.people, event.included ? 1 : 0].join(":");
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
          if (Array.isArray(remotePayload?.v8History)) {
            const byDate = new Map<string, DayRecord>();
            [...remotePayload.v8History, ...(payload.v8History || [])].forEach(record => byDate.set(record.date, record));
            payload.v8History = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
          }
        }
        const response = await fetch(\`${'${SUPABASE_URL}'}/rest/v1/${'${CLOUD_TABLE}'}?on_conflict=list_date\`, {
          method: "POST",`,
  "merge remote before write");

app = replaceOrThrow(app,
`        if (!response.ok) throw new Error(\`Cloud save failed: ${'${response.status}'}\`);
        setSyncText("Auf allen Geräten gespeichert");`,
`        if (!response.ok) throw new Error(\`Cloud save failed: ${'${response.status}'}\`);
        cloudRevisionRef.current = Math.max(cloudRevisionRef.current, now);
        if (payload.rooms) {
          roomsRef.current = completeInventory(payload.rooms);
          setRooms(roomsRef.current);
          localStorage.setItem("ambassador-breakfast-rooms", JSON.stringify(roomsRef.current));
        }
        setSyncText("Auf allen Geräten gespeichert");`,
  "commit merged cloud state");

app = replaceOrThrow(app,
`  const persist = (next: Room[], nextArrivals = arrivalsRef.current, nextHistory = historyRef.current) => {
    const normalized = next.map(room => normalizeRoom(room));
    setRooms(normalized);`,
`  const persist = (next: Room[], nextArrivals = arrivalsRef.current, nextHistory = historyRef.current) => {
    const now = Date.now();
    const previous = new Map(roomsRef.current.map(room => [room.room, room]));
    const normalized = next.map(room => {
      const value = normalizeRoom(room);
      const before = previous.get(value.room);
      const comparableBefore = before ? JSON.stringify({ ...before, updatedAt: undefined }) : "";
      const comparableNext = JSON.stringify({ ...value, updatedAt: undefined });
      return { ...value, updatedAt: comparableBefore !== comparableNext ? now : Number(before?.updatedAt || value.updatedAt || 0) };
    });
    roomsRef.current = normalized;
    setRooms(normalized);`,
  "stamp local room revisions");

/* Canonical photo flow. */
app = replaceOrThrow(app,
  'const [stage, setStage] = useState<"login" | "load" | "app">("login");',
  'const [stage, setStage] = useState<"login" | "load" | "photo" | "app">("login");',
  "photo stage");
app = replaceOrThrow(app,
  '  const [photoError, setPhotoError] = useState("");\n',
  '  const [photoError, setPhotoError] = useState("");\n  const [photoPages, setPhotoPages] = useState<Array<File | null>>([null, null, null]);\n  const [activePhotoSlot, setActivePhotoSlot] = useState<number | null>(null);\n',
  "photo state");
app = replaceOrThrow(app,
  '  const photoRef = useRef<HTMLInputElement>(null);\n',
  '  const photoRef = useRef<HTMLInputElement>(null);\n  const photoLibraryRef = useRef<HTMLInputElement>(null);\n',
  "photo library ref");
app = replaceOrThrow(app,
  'type PhotoRoom = { room: number; customer: string; guests: string[]; people: number; product?: string; arrival: string; departure: string };',
  'type PhotoRoom = { room: number; customer: string; guests: string[]; people: number; product?: string; breakfastIncluded?: boolean; arrival: string; departure: string };',
  "photo room breakfast flag");
app = replaceOrThrow(app,
  'included: /continental\\s+breakfast|breakfast\\s+étagère|breakfast\\s+etagere/i.test(item.product || ""),',
  'included: item.breakfastIncluded === true || /continental\\s+breakfast|continental.*étagère|continental.*etagere|breakfast\\s+étagère|breakfast\\s+etagere|breakfast.*included|inklusive.*frühstück/i.test(item.product || ""),',
  "photo breakfast mapping");
app = replaceOrThrow(app,
  '      <button className="load-choice photo-choice" disabled={photoImporting} onClick={() => photoRef.current?.click()}>',
  '      <button className="load-choice photo-choice" disabled={photoImporting} onClick={() => { setPhotoError(""); setPhotoPages([null, null, null]); setActivePhotoSlot(null); setStage("photo"); }}>',
  "photo entry");

const photoScreen = `
  if (stage === "photo") {
    const capturedPhotoCount = photoPages.filter((file): file is File => Boolean(file)).length;
    const readyPhotoPages = photoPages.filter((file): file is File => Boolean(file));
    return <main className="entry-screen photo-workspace"><div className="entry-card photo-review-card">
      <img className="entry-logo" src="/ambassador-logo.svg?v=confirmed-20260816-0517" alt="Ambassador Hotel Zürich" />
      <div className="entry-rule" />
      <span className="entry-eyebrow">{tr("Mews-Fotoimport", "Mews photo import", "Nhập ảnh Mews")}</span>
      <h1>{tr("Seiten kontrollieren", "Review pages", "Kiểm tra trang")}</h1>
      <p className="photo-review-count">{capturedPhotoCount ? tr(\`${'${capturedPhotoCount}'} von ${'${photoPages.length}'} Seiten aufgenommen\`, \`${'${capturedPhotoCount}'} of ${'${photoPages.length}'} pages captured\`, \`Đã chụp ${'${capturedPhotoCount}'}/${'${photoPages.length}'} trang\`) : tr("3 Seiten vorbereitet", "3 pages ready", "Đã chuẩn bị 3 trang")}</p>
      <div className="photo-page-grid">
        {photoPages.map((file, index) => file ? <div className="photo-page-card" key={file.name + file.lastModified + index}>
          <div className="photo-page-preview"><img src={URL.createObjectURL(file)} alt={tr(\`Seite ${'${index + 1}'}\`, \`Page ${'${index + 1}'}\`, \`Trang ${'${index + 1}'}\`)} /></div>
          <div className="photo-page-meta"><strong>{tr(\`Seite ${'${index + 1}'}\`, \`Page ${'${index + 1}'}\`, \`Trang ${'${index + 1}'}\`)}</strong><div className="photo-page-tools">
            <button type="button" className="photo-retake" onClick={() => { setActivePhotoSlot(index); photoRef.current?.click(); }}>{tr("Neu", "Retake", "Chụp lại")}</button>
            <button type="button" className="photo-delete" aria-label={tr("Seite löschen", "Delete page", "Xóa trang")} onClick={() => setPhotoPages(current => current.map((item, itemIndex) => itemIndex === index ? null : item))}><Trash2 /></button>
          </div></div>
        </div> : <div className="photo-slot" key={index}>
          <span className="photo-slot-icon"><Camera /></span>
          <strong>{tr(\`Seite ${'${index + 1}'} hinzufügen\`, \`Add page ${'${index + 1}'}\`, \`Thêm trang ${'${index + 1}'}\`)}</strong>
          <div className="photo-source-actions">
            <button type="button" className="photo-source-button camera" onClick={() => { setActivePhotoSlot(index); photoRef.current?.click(); }} disabled={photoImporting}><Camera /><span>{tr("Kamera öffnen", "Open camera", "Mở camera")}</span></button>
            <button type="button" className="photo-source-button library" onClick={() => { setActivePhotoSlot(index); photoLibraryRef.current?.click(); }} disabled={photoImporting}><FileUp /><span>{tr("Fotos öffnen", "Open photos", "Mở ảnh")}</span></button>
          </div>
        </div>)}
        {photoPages.length < 6 && <button className="photo-add-page" type="button" onClick={() => setPhotoPages(current => [...current, null])} disabled={photoImporting}><span className="photo-add-plus"><Plus /></span><strong>{tr("Weitere Seite hinzufügen", "Add another page", "Thêm trang khác")}</strong><small>{tr("Optional", "Optional", "Tùy chọn")}</small></button>}
      </div>
      {photoError && <div className="photo-import-error" role="alert"><CircleAlert /> <span>{photoError}</span></div>}
      <div className="photo-review-actions">
        <button className="entry-secondary photo-cancel" type="button" disabled={photoImporting} onClick={() => { setPhotoPages([null, null, null]); setActivePhotoSlot(null); setPhotoError(""); setStage("load"); }}>{c.cancel}</button>
        <button className="entry-primary photo-create" type="button" disabled={!readyPhotoPages.length || photoImporting} onClick={() => void importMewsPhotos(readyPhotoPages)}>{photoImporting ? <><LoaderCircle className="spin" /> {tr("Fotos werden gelesen …", "Reading photos …", "Đang đọc ảnh …")}</> : tr("Liste aus Fotos erstellen", "Create list from photos", "Tạo danh sách từ ảnh")}</button>
      </div>
      <input ref={photoRef} hidden type="file" accept="image/*" capture="environment" onChange={event => { const file = event.target.files?.[0] || null; if (file && activePhotoSlot !== null) setPhotoPages(current => current.map((item, index) => index === activePhotoSlot ? file : item)); setActivePhotoSlot(null); event.currentTarget.value = ""; }} />
      <input ref={photoLibraryRef} hidden type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0] || null; if (file && activePhotoSlot !== null) setPhotoPages(current => current.map((item, index) => index === activePhotoSlot ? file : item)); setActivePhotoSlot(null); event.currentTarget.value = ""; }} />
    </div></main>;
  }

`;
app = replaceOrThrow(app,
  '  if (stage === "load") return <main className="entry-screen"><div className="entry-card load-card photo-load-card">',
  photoScreen + '  if (stage === "load") return <main className="entry-screen"><div className="entry-card load-card photo-load-card">',
  "photo screen");
app = replaceOrThrow(app,
  '      const message = error instanceof Error ? error.message : tr("Fotoimport fehlgeschlagen.", "Photo import failed.", "Nhập ảnh thất bại.");\n      setPhotoError(message);',
  '      const rawMessage = error instanceof Error ? error.message : "";\n      const technicalGatewayError = /AI Gateway|credit card|vercel\\.com\\/d\\?/i.test(rawMessage);\n      const message = technicalGatewayError\n        ? tr("Die Fotoerkennung ist momentan nicht verfügbar. Bitte später erneut versuchen oder die Mews-Datei importieren.", "Photo recognition is currently unavailable. Please try again later or import the Mews file.", "Nhận dạng ảnh hiện không khả dụng. Vui lòng thử lại sau hoặc nhập tệp Mews.")\n        : (rawMessage || tr("Fotoimport fehlgeschlagen.", "Photo import failed.", "Nhập ảnh thất bại."));\n      setPhotoError(message);',
  "friendly photo error");

await writeFile("app/BreakfastApp.tsx", app);

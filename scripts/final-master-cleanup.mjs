import { readFile, writeFile } from "node:fs/promises";

const path = "app/BreakfastApp.tsx";
let app = await readFile(path, "utf8");

// Production has no login. After the splash screen, open the load screen directly.
// Keep the legacy login JSX unreachable so the rest of the app stays untouched.
app = app.replace(
  'const [stage, setStage] = useState<"login" | "load" | "photo" | "app">("login");',
  'const [stage, setStage] = useState<"login" | "load" | "photo" | "app">("load");'
);
app = app.replace(
  'const [stage, setStage] = useState<"login" | "load" | "app">("login");',
  'const [stage, setStage] = useState<"login" | "load" | "app">("load");'
);

// Keep the canonical photo workspace materialized by materialize-app.mjs.
// Shorter labels make the two load actions work as compact side-by-side tiles.
app = app.replace(
  'tr("Mews-Liste fotografieren", "Photograph Mews list", "Chụp danh sách Mews")',
  'tr("Foto erkennen", "Recognize photo", "Nhận dạng ảnh")'
);
app = app.replace(
  'tr("Eine oder mehrere Seiten aufnehmen", "Capture one or more pages", "Chụp một hoặc nhiều trang")',
  'tr("Papierliste intelligent lesen", "Read paper list intelligently", "Đọc danh sách giấy thông minh")'
);
app = app.replace(
  'tr("Mews-Datei importieren", "Import Mews file", "Nhập tệp Mews")',
  'tr("Mews-Datei", "Mews file", "Tệp Mews")'
);

// Fix an invalid TSX assertion emitted by the restored split source.
app = app.replace('{panel === "stats-menu" as any &&', '{(panel as any) === "stats-menu" &&');

// Final Master label, no version-number drift in the menu.
app = app.replace(/Ambassador Frühstück · Version 9/g, "Ambassador Frühstück · Final Master");

await writeFile(path, app, "utf8");

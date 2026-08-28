import { readFile, readdir } from "node:fs/promises";

const fail = (message) => { throw new Error(`Quality gate failed: ${message}`); };
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const layout = await readFile("app/layout.tsx", "utf8");
const css = await readFile("app/ambassador-ui.css", "utf8");
const nextConfig = await readFile("next.config.ts", "utf8");
const appFiles = await readdir("app");
const page = await readFile("app/page.tsx", "utf8");

if (/patch\.mjs|hotfix|polish/i.test(pkg.scripts?.prebuild || "")) fail("legacy patch/hotfix chain still active");
if (pkg.scripts?.prebuild !== "node scripts/materialize-app.mjs") fail("prebuild must use only the canonical materializer");
if (!layout.includes('import "./ambassador-ui.css"')) fail("canonical stylesheet is not imported");
const styleImports = [...layout.matchAll(/import "\.\/(.+\.css)"/g), ...page.matchAll(/import "\.\/(.+\.css)"/g)].map(match => match[1]);
const approvedStyles = ["ambassador-ui.css", "final-master.css", "ipad-polish.css", "load-intelligence.css"];
if (styleImports.length !== new Set(styleImports).size) fail("a global stylesheet is imported more than once");
if (styleImports.some(name => !approvedStyles.includes(name)) || approvedStyles.some(name => !styleImports.includes(name))) fail("global stylesheet set is not canonical");
if (!css.includes("--c-primary") || !css.includes("prefers-reduced-motion")) fail("design/accessibility tokens incomplete");
if (!nextConfig.includes("X-Content-Type-Options") || !nextConfig.includes("Referrer-Policy")) fail("security headers missing");
if (appFiles.some(name => /patch|hotfix|legacy|version9|v10/i.test(name) && name.endsWith(".css"))) fail("legacy stylesheet found in app directory");

console.log("Quality gate passed: canonical build, approved stylesheets, accessibility and security baselines present.");

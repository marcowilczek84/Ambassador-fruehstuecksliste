import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// The in-app symbols and both app icons use the cup paths from one SVG source.
const symbols = await readFile(new URL("../public/ambassador-icons.svg", import.meta.url), "utf8");
const cup = symbols.match(/<symbol id="cup"[^>]*>([\s\S]*?)<\/symbol>/)?.[1];
if (!cup) throw new Error("Master cup is missing");
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#1c777b"/>
  <g transform="translate(36 36) scale(18.333333)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${cup}</g>
</svg>\n`;
await writeFile(new URL("../public/favicon.svg", import.meta.url), logo);
await sharp(Buffer.from(logo)).resize(180, 180).png().toFile(new URL("../public/apple-touch-icon.png", import.meta.url).pathname);
for (const id of ["note", "home", "menu", "search", "guests", "calendar", "stats", "check", "close", "cup"]) {
  const paths = symbols.match(new RegExp(`<symbol id="${id}"[^>]*>([\\s\\S]*?)<\\/symbol>`))?.[1];
  if (!paths) throw new Error(`${id} symbol is missing`);
  await writeFile(new URL(`../public/ambassador-${id}.svg`, import.meta.url),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1c777b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>\n`);
}
const yellowCup = (await readFile(new URL("../public/ambassador-cup.svg", import.meta.url), "utf8")).replaceAll("#1c777b", "#f3cf24");
await writeFile(new URL("../public/ambassador-cup-yellow.svg", import.meta.url), yellowCup);

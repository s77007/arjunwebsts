import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./worker.js";

const ROUTES = ["/", "/about", "/projects", "/photography", "/music", "/nature"];
const OUT_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "public");

await rm(OUT_DIR, { recursive: true, force: true });

let total = 0;

for (const route of ROUTES) {
  const res = await worker.fetch(new Request(`https://arjunweb.local${route}`));
  if (!res.ok) throw new Error(`${route} returned ${res.status}`);

  const html = await res.text();
  const rel = route === "/" ? "index.html" : join(route.slice(1), "index.html");
  const dest = join(OUT_DIR, rel);

  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, html, "utf8");

  total += html.length;
  console.log(`${route.padEnd(14)} -> public/${rel}  (${html.length} bytes)`);
}

console.log(`\nDone: ${ROUTES.length} pages, ${total} bytes total.`);

/**
 * GitHub Pages has no SPA fallback: /candidates 404s on hard refresh / direct URL.
 * Serving the built index as 404.html lets the client router take over while
 * keeping the browser URL (project pages include this 404.html automatically).
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../web/dist");
const index = resolve(dist, "index.html");
const out = resolve(dist, "404.html");

if (!existsSync(index)) {
  console.error(`[spa-404] missing ${index}; run vite build first`);
  process.exit(1);
}

copyFileSync(index, out);
console.log("[spa-404] wrote web/dist/404.html (GitHub Pages deep-link fallback)");

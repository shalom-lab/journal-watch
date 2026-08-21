import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pairs = [
  ["data/clean/articles.json", "web/public/data/clean/articles.json"],
  ["data/candidates.json", "web/public/data/candidates.json"],
  ["data/meta.json", "web/public/data/meta.json"],
  ["data/ratings.json", "web/public/data/ratings.json"],
  ["config/journals.yaml", "web/public/config/journals.yaml"],
];

for (const [from, to] of pairs) {
  const src = join(root, from);
  const dest = join(root, to);
  if (!existsSync(src)) {
    console.warn(`[sync:data] skip missing ${from}`);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  console.log(`[sync:data] ${from} -> ${to}`);
}

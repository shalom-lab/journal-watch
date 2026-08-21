import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const zh = JSON.parse(readFileSync("web/src/locales/zh.json", "utf8"));
const en = JSON.parse(readFileSync("web/src/locales/en.json", "utf8"));

function walk(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(name.name)) acc.push(p);
  }
  return acc;
}

const files = walk("web/src");
const keys = new Set();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*["']([^"']+)["']\s*\)/g)) {
    keys.add(m[1]);
  }
  for (const m of src.matchAll(/t\(`([^`$]+)`\)/g)) {
    keys.add(m[1]);
  }
}

function lookup(obj, key) {
  return key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

const missingZh = [...keys].filter((k) => lookup(zh, k) == null).sort();
const missingEn = [...keys].filter((k) => lookup(en, k) == null).sort();

console.log("keys used:", [...keys].sort().join("\n"));
console.log("\nmissing zh:", missingZh.length ? missingZh.join(", ") : "(none)");
console.log("missing en:", missingEn.length ? missingEn.join(", ") : "(none)");

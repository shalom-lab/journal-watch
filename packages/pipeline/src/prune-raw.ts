import { deleteRawFile, listRawFiles } from "./lib/paths.js";

/**
 * Delete raw crawl batch files older than N months.
 * Env: RAW_RETENTION_MONTHS (default 3)
 */
export async function runPruneRaw(): Promise<{
  deleted: string[];
  kept: number;
  months: number;
}> {
  const months = Number(process.env.RAW_RETENTION_MONTHS ?? "3");
  const cutoff = Date.now() - months * 30 * 24 * 60 * 60 * 1000;
  const files = listRawFiles();
  const deleted: string[] = [];

  for (const f of files) {
    if (f.mtimeMs < cutoff) {
      deleteRawFile(f.path);
      deleted.push(f.name);
      console.log(`[prune] deleted ${f.name}`);
    }
  }

  return { deleted, kept: files.length - deleted.length, months };
}

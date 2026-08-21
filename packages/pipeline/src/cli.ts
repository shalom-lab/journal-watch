import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { REPO_ROOT } from "./lib/paths.js";
import { installProxyFromEnv } from "./lib/proxy.js";
import { runCrawl } from "./crawl.js";
import { runScreen } from "./screen.js";
import { runScreenTitle } from "./screen-title.js";
import { runScreenDetail } from "./screen-detail.js";
import { runPruneRaw } from "./prune-raw.js";

loadEnv({ path: resolve(REPO_ROOT, ".env") });
await installProxyFromEnv();

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "pipeline";

  if (cmd === "fetch:raw" || cmd === "fetch-raw" || cmd === "crawl") {
    console.log("[done] fetch:raw", await runCrawl());
    return;
  }

  if (cmd === "screen:title" || cmd === "screen-title") {
    console.log("[done] screen:title", await runScreenTitle());
    return;
  }

  if (cmd === "fetch:detail" || cmd === "fetch-detail") {
    console.log("[done] fetch:detail", await runScreenDetail());
    return;
  }

  if (cmd === "screen") {
    console.log("[done] screen", await runScreen());
    return;
  }

  if (cmd === "prune:raw" || cmd === "prune-raw") {
    console.log("[done] prune:raw", await runPruneRaw());
    return;
  }

  if (cmd === "pipeline") {
    // Automated path: fetch:raw + screen:title. Human reviews, then fetch:detail.
    console.log("[done] fetch:raw", await runCrawl());
    console.log("[done] screen:title", await runScreenTitle());
    return;
  }

  console.error(
    `Unknown command: ${cmd}. Use fetch:raw | screen:title | fetch:detail | screen | prune:raw | pipeline`,
  );
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

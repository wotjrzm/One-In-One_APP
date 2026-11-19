// Verifies that the production build traces content/problems into the server functions that load the bank.
// Run after `npm run build`.
import fs from "node:fs";
import path from "node:path";

const serverDir = path.resolve(".next/server");
const routes = ["api/today", "api/submit", "api/explanation", "api/cron/retry"];
const failures = [];

for (const r of routes) {
  const file = path.join(serverDir, "app", r, "route.js.nft.json");
  if (!fs.existsSync(file)) {
    failures.push(`missing ${path.relative(process.cwd(), file)} (run npm run build first)`);
    continue;
  }
  const { files } = JSON.parse(fs.readFileSync(file, "utf8"));
  const traced = files.some(
    (f) => f.split("\\").join("/").includes("content/problems/") && f.endsWith(".json"),
  );
  if (!traced) failures.push(`${r}: no content/problems/*.json in trace`);
}

if (failures.length) {
  console.error("check:trace FAILED\n" + failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log(`check:trace ok (${routes.length} routes include content/problems)`);

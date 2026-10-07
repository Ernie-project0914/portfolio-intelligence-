import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--import", "tsx", "server/index.mjs"], {
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "0.0.0.0",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
  ),
];
let stopped = false;
function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of children) child.on("exit", (code) => stop(code || 0));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

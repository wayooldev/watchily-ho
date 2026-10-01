/**
 * Install Watchily.wgt on a connected Tizen TV via sdb / tizen CLI.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wgt = join(root, "Watchily.wgt");

function which(bin) {
  const cmd = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(cmd, [bin], { encoding: "utf8" });
  return r.status === 0;
}

function main() {
  if (!existsSync(wgt)) {
    console.error("Watchily.wgt not found. Run: npm run tizen:package");
    process.exit(1);
  }

  if (which("tizen")) {
    const target = process.env.TIZEN_DEVICE || "";
    const args = ["install", "-n", wgt];
    if (target) args.push("-t", target);
    const r = spawnSync("tizen", args, {
      cwd: root,
      encoding: "utf8",
      shell: true,
      stdio: "inherit",
    });
    process.exit(r.status ?? 1);
  }

  if (which("sdb")) {
    const r = spawnSync("sdb", ["install", wgt], {
      cwd: root,
      encoding: "utf8",
      shell: true,
      stdio: "inherit",
    });
    process.exit(r.status ?? 1);
  }

  console.error(`
No Tizen CLI (tizen) or sdb found on PATH.

1. Install Tizen Studio + Samsung Certificate Extension
2. Connect the TV: sdb connect <tv-ip>:26101
3. Re-run: npm run tizen:install

Or install manually from Device Manager with Watchily.wgt:
  ${wgt}
`);
  process.exit(1);
}

main();

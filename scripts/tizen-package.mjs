/**
 * Build tizen-tv-hosted into Watchily.wgt at repo root.
 * Prefers `tizen package` when the CLI is on PATH; otherwise zips the folder (dev sideload).
 */
import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hosted = join(root, "tizen-tv-hosted");
const outWgt = join(root, "Watchily.wgt");

function hasTizenCli() {
  const cmd = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(cmd, ["tizen"], { encoding: "utf8" });
  return r.status === 0;
}

function packageWithTizenCli() {
  const r = spawnSync(
    "tizen",
    ["package", "-t", "wgt", "-s", "Watchily", "--", hosted],
    { cwd: root, encoding: "utf8", shell: true },
  );
  if (r.status !== 0) {
    console.error(r.stdout || "");
    console.error(r.stderr || "");
    throw new Error("tizen package failed");
  }
  console.log(r.stdout || "tizen package ok");
}

function packageWithPowershellZip() {
  if (existsSync(outWgt)) unlinkSync(outWgt);
  const hostedEsc = hosted.replace(/'/g, "''");
  const outEsc = outWgt.replace(/'/g, "''");
  const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$hosted = '${hostedEsc}'
$out = '${outEsc}'
if (Test-Path $out) { Remove-Item -Force $out }
[System.IO.Compression.ZipFile]::CreateFromDirectory($hosted, $out)
if (-not (Test-Path $out)) { throw 'WGT not created' }
Write-Output "Created $out"
`;
  const r = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", ps],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || "powershell zip failed");
    throw new Error("ZipFile.CreateFromDirectory failed");
  }
  console.log((r.stdout || "").trim() || `Created ${outWgt}`);
}

function packageWithZipCli() {
  if (existsSync(outWgt)) unlinkSync(outWgt);
  const r = spawnSync("zip", ["-r", outWgt, "."], {
    cwd: hosted,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error("zip failed — install zip or Tizen CLI");
  }
  console.log(`Created ${outWgt}`);
}

function main() {
  if (!existsSync(join(hosted, "config.xml"))) {
    throw new Error("tizen-tv-hosted/config.xml missing");
  }
  if (hasTizenCli()) {
    try {
      packageWithTizenCli();
      return;
    } catch (e) {
      console.warn(String(e));
      console.warn("Falling back to zip .wgt");
    }
  }
  if (process.platform === "win32") {
    packageWithPowershellZip();
  } else {
    packageWithZipCli();
  }
  if (!existsSync(outWgt)) {
    throw new Error(`Expected ${outWgt} was not created`);
  }
  console.log(
    "(zip fallback; sign with Tizen Studio for store/device cert installs)",
  );
}

main();

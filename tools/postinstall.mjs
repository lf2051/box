import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const customBrowserPath = String(process.env.PUPPETEER_EXECUTABLE_PATH || "").trim();
const skipBrowserDownload = String(process.env.SKIP_PUPPETEER_BROWSER_DOWNLOAD || "").trim() === "1";

if (skipBrowserDownload) {
  console.log("[postinstall] SKIP_PUPPETEER_BROWSER_DOWNLOAD=1, pulando download do Chrome.");
  process.exit(0);
}

if (customBrowserPath && existsSync(customBrowserPath)) {
  console.log(
    "[postinstall] PUPPETEER_EXECUTABLE_PATH aponta para um Chrome existente, pulando download."
  );
  process.exit(0);
}

const isWin = process.platform === "win32";
const npxBin = isWin ? "npx.cmd" : "npx";
const installResult = spawnSync(npxBin, ["puppeteer", "browsers", "install", "chrome"], {
  stdio: "inherit",
  shell: isWin,
});

process.exit(installResult.status ?? 1);

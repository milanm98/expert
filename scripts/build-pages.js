import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, getConfig } from "../src/config.js";
import { BettingExpertScraper } from "../src/scraper.js";
import { ConsensusService } from "../src/service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const siteDir = path.join(rootDir, "site");
const distDir = path.join(rootDir, "dist");

loadEnvFile();

const config = getConfig();
const scraper = new BettingExpertScraper(config);
const service = new ConsensusService({ scraper, config });

try {
  const payload = await service.getTodayConsensus();

  prepareDistDirectory();
  cpSync(siteDir, distDir, { recursive: true });
  writeFileSync(path.join(distDir, "today.json"), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(
    path.join(distDir, "site-config.json"),
    `${JSON.stringify(
      {
        title: process.env.SITE_TITLE ?? "Consensus Picks",
        tagline: process.env.SITE_TAGLINE ?? "Daily BettingExpert consensus picks"
      },
      null,
      2
    )}\n`
  );

  console.log(`Static site generated in ${distDir}`);
  console.log(`Result status: ${payload.ok ? "ok" : "error"}`);
} finally {
  await scraper.close();
}

function prepareDistDirectory() {
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }

  mkdirSync(distDir, { recursive: true });
}

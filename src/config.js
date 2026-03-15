import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadEnvFile(filePath = path.resolve(__dirname, "..", ".env")) {
  try {
    const contents = readFileSync(filePath, "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key && process.env[key] === undefined) {
        process.env[key] = stripWrappingQuotes(value);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function getConfig() {
  return {
    port: toInt(process.env.PORT, 3000),
    host: process.env.HOST ?? "127.0.0.1",
    username: process.env.BETTINGEXPERT_USERNAME ?? "",
    password: process.env.BETTINGEXPERT_PASSWORD ?? "",
    headless: toBoolean(process.env.BETTINGEXPERT_HEADLESS, true),
    topN: toInt(process.env.BETTINGEXPERT_TOP_N, 20),
    timeoutMs: toInt(process.env.BETTINGEXPERT_TIMEOUT_MS, 30_000),
    maxLoadMoreClicks: toInt(process.env.BETTINGEXPERT_MAX_LOAD_MORE_CLICKS, 20),
    baseUrl: process.env.BETTINGEXPERT_BASE_URL ?? "https://www.bettingexpert.com",
    loginUrl:
      process.env.BETTINGEXPERT_LOGIN_URL ??
      "https://www.bettingexpert.com",
    tipsUrl: process.env.BETTINGEXPERT_TIPS_URL ?? "https://www.bettingexpert.com/tips",
    hotTipsUrl:
      process.env.BETTINGEXPERT_HOT_TIPS_URL ??
      "https://www.bettingexpert.com/tips/hot",
    leaderboardUrl:
      process.env.BETTINGEXPERT_LEADERBOARD_URL ??
      "https://www.bettingexpert.com/competitions/monthly-en"
  };
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

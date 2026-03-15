import http from "node:http";
import { loadEnvFile, getConfig } from "./config.js";
import { BettingExpertScraper } from "./scraper.js";
import { ConsensusService } from "./service.js";

loadEnvFile();

const config = getConfig();
const scraper = new BettingExpertScraper(config);
const service = new ConsensusService({ scraper, config });

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400, jsonHeaders());
    response.end(JSON.stringify({ ok: false, error: "Missing request URL" }));
    return;
  }

  const url = new URL(request.url, `http://127.0.0.1:${config.port}`);
  if (request.method === "GET" && url.pathname === "/today") {
    const payload = await service.getTodayConsensus();
    const statusCode = payload.ok ? 200 : 500;
    response.writeHead(statusCode, jsonHeaders());
    response.end(JSON.stringify(payload, null, 2));
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, jsonHeaders());
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.writeHead(404, jsonHeaders());
  response.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(config.port, config.host, () => {
  console.log(`Picks board server listening on http://${config.host}:${config.port}`);
});

process.on("SIGINT", async () => {
  await scraper.close();
  server.close(() => process.exit(0));
});

process.on("SIGTERM", async () => {
  await scraper.close();
  server.close(() => process.exit(0));
});

function jsonHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8"
  };
}

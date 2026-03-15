import { chromium } from "playwright";
import {
  normalizeDateLabel,
  normalizeEventKey,
  normalizeTipsterName
} from "./normalize.js";
import { selectors } from "./scraperConfig.js";

export class BettingExpertScraper {
  #config;
  #browser;
  #context;
  #page;

  constructor(config) {
    this.#config = config;
  }

  async init() {
    if (this.#browser) {
      return;
    }

    this.#browser = await chromium.launch({ headless: this.#config.headless });
    this.#context = await this.#browser.newContext();
    this.#page = await this.#context.newPage();
    this.#page.setDefaultTimeout(this.#config.timeoutMs);
  }

  async close() {
    await this.#browser?.close();
    this.#browser = undefined;
    this.#context = undefined;
    this.#page = undefined;
  }

  async fetchTodayConsensusInputs() {
    if (!this.#config.username || !this.#config.password) {
      throw new Error(
        "Missing BETTINGEXPERT_USERNAME or BETTINGEXPERT_PASSWORD environment variables."
      );
    }

    await this.init();
    const warnings = [];

    await this.#login(warnings);
    const topTipsters = await this.#fetchTopTipsters(warnings);
    const tips = await this.#fetchTipsForToday(warnings);

    return {
      topTipsters,
      tips,
      warnings
    };
  }

  async enrichConsensusPicks(consensusPicks) {
    const enriched = [];

    for (const pick of consensusPicks) {
      if (!pick.eventUrl || !pick.tipsters?.length) {
        enriched.push({
          ...pick,
          tipsterArguments: {}
        });
        continue;
      }

      const tipsterArguments = await this.#extractTipsterArgumentsForPick(pick);
      enriched.push({
        ...pick,
        tipsterArguments
      });
    }

    return enriched;
  }

  async #login(warnings) {
    await this.#page.goto(this.#config.loginUrl, { waitUntil: "networkidle" });
    await this.#acceptCookiesIfPresent();

    const openLoginButton = await this.#findVisibleLocator(selectors.login.openButton);
    if (!openLoginButton) {
      throw new Error("Unable to find the BettingExpert login button.");
    }

    await openLoginButton.click();

    const usernameField = await this.#waitForVisibleLocator(selectors.login.username, 10_000);
    const passwordField = await this.#waitForVisibleLocator(selectors.login.password, 10_000);
    if (!usernameField || !passwordField) {
      throw new Error("Unable to find the BettingExpert login form.");
    }

    await this.#fillField(usernameField, this.#config.username);
    await this.#fillField(passwordField, this.#config.password);

    const loginForm = usernameField.locator("xpath=ancestor::form[1]").first();
    const submitButton = await this.#findVisibleLocator(selectors.login.submit, loginForm);

    if (submitButton) {
      const enabled = await this.#waitForLocatorEnabled(submitButton, 5_000);
      if (enabled) {
        await submitButton.click();
      } else {
        await loginForm.evaluate((form) => {
          if (form instanceof HTMLFormElement) {
            form.requestSubmit();
          }
        });
      }
    } else {
      await loginForm.evaluate((form) => {
        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
      });
    }

    const success = await this.#waitForAnyLocator(selectors.login.successSignals, 10_000);
    if (!success) {
      warnings.push(
        "Login completed without a clear success signal. Scraping may fail if the session was not created."
      );
    }
  }

  async #acceptCookiesIfPresent() {
    for (const selector of selectors.cookieButtons) {
      const button = this.#page.locator(selector).first();
      if ((await button.count()) > 0) {
        try {
          await button.click({ timeout: 2_000 });
          return;
        } catch {
          // Best-effort only.
        }
      }
    }
  }

  async #fetchTopTipsters(warnings) {
    await this.#page.goto(this.#config.leaderboardUrl, { waitUntil: "networkidle" });

    const pageText = await this.#page.locator("body").innerText();
    const tipsters = extractLeaderboardTipsters(pageText, this.#config.topN);

    if (tipsters.length === 0) {
      warnings.push("No tipsters were found on the configured leaderboard page.");
    }

    return tipsters.slice(0, this.#config.topN);
  }

  async #fetchTipsForToday(warnings) {
    const urlsToTry = [this.#config.hotTipsUrl, this.#config.tipsUrl];
    const collectedTips = [];

    for (const url of urlsToTry) {
      await this.#page.goto(url, { waitUntil: "networkidle" });
      await this.#loadAllTipsIfPossible();
      const pageText = await this.#page.locator("body").innerText();
      const sportHints = await this.#extractTipSportHints();
      const tips = extractTodayTips(pageText, sportHints);
      collectedTips.push(...tips);

      if (tips.length > 0) {
        break;
      }
    }

    if (collectedTips.length === 0) {
      warnings.push(
        "No tips for today were found on the configured pages. The site layout or date labels may have changed."
      );
    }

    return dedupeTips(collectedTips);
  }

  async #waitForAnyLocator(locatorStrings, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      for (const selector of locatorStrings) {
        if ((await this.#page.locator(selector).count()) > 0) {
          return true;
        }
      }

      await this.#page.waitForTimeout(250);
    }

    return false;
  }

  async #waitForVisibleLocator(selector, timeoutMs, root = this.#page) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const locator = await this.#findVisibleLocator(selector, root);
      if (locator) {
        return locator;
      }

      await this.#page.waitForTimeout(250);
    }

    return null;
  }

  async #findVisibleLocator(selector, root = this.#page) {
    const matches = root.locator(selector);
    const count = await matches.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = matches.nth(index);
      const isVisible = await candidate.isVisible().catch(() => false);
      if (!isVisible) {
        continue;
      }

      return candidate;
    }

    return null;
  }

  async #fillField(locator, value) {
    await locator.click();
    await locator.fill(value);
    await locator.dispatchEvent("input");
    await locator.dispatchEvent("change");
    await locator.blur();
  }

  async #waitForLocatorEnabled(locator, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await locator.isEnabled().catch(() => false)) {
        return true;
      }

      await this.#page.waitForTimeout(250);
    }

    return false;
  }

  #todayLabel() {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).format(new Date());
  }

  async #loadAllTipsIfPossible() {
    const loadMoreButton = this.#page.locator(selectors.tips.loadMoreButton).first();

    for (let attempt = 0; attempt < this.#config.maxLoadMoreClicks; attempt += 1) {
      if ((await loadMoreButton.count()) === 0) {
        return;
      }

      const visible = await loadMoreButton.isVisible().catch(() => false);
      if (!visible) {
        return;
      }

      await loadMoreButton.click();
      await this.#page.waitForTimeout(1000);
    }
  }

  async #extractTipSportHints() {
    return this.#page.evaluate(() => {
      const sportPaths = new Set([
        "football",
        "basketball",
        "tennis",
        "handball",
        "rugby-union",
        "ice-hockey",
        "baseball",
        "american-football",
        "australian-football",
        "volleyball",
        "cricket",
        "darts",
        "snooker",
        "boxing",
        "counter-strike",
        "golf",
        "rugby-league",
        "motorsports",
        "mixed-martial-arts"
      ]);

      const hints = [];
      for (const anchor of document.querySelectorAll('a[href]')) {
        const href = anchor.getAttribute("href") ?? "";
        const text = anchor.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (!text || !text.includes("-")) {
          continue;
        }

        const cleanedHref = href.replace(/^https?:\/\/[^/]+/i, "").replace(/^\//, "");
        const [sportSegment] = cleanedHref.split("/");
        if (!sportPaths.has(sportSegment)) {
          continue;
        }

        hints.push({
          eventName: text.toUpperCase(),
          sport: prettifySportName(sportSegment),
          eventUrl: normalizeEventUrl(anchor.href)
        });
      }

      return hints;

      function prettifySportName(value) {
        return value
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
      }

      function normalizeEventUrl(value) {
        if (!value) {
          return null;
        }

        return value.replace("://www.bettingexpert.com/tips/", "://www.bettingexpert.com/");
      }
    });
  }

  async #extractTipsterArgumentsForPick(pick) {
    const detailPage = await this.#context.newPage();
    detailPage.setDefaultTimeout(this.#config.timeoutMs);

    try {
      await detailPage.goto(pick.eventUrl, { waitUntil: "networkidle" });
      const pageText = await detailPage.locator("body").innerText();
      return extractTipsterArguments(pageText, pick);
    } finally {
      await detailPage.close();
    }
  }
}

function extractLeaderboardTipsters(pageText, limit) {
  const lines = pageText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const leaderboardIndex = lines.indexOf("Leaderboard");
  if (leaderboardIndex === -1) {
    return [];
  }

  const tipsters = [];
  for (let index = leaderboardIndex + 1; index < lines.length - 2; index += 1) {
    const rank = Number.parseInt(lines[index], 10);
    const name = lines[index + 1];
    const marker = lines[index + 2];

    if (!Number.isFinite(rank) || marker !== "Profit") {
      continue;
    }

    tipsters.push({
      rank,
      name,
      profileUrl: null,
      rawText: `${rank} ${name}`
    });

    if (tipsters.length >= limit) {
      break;
    }
  }

  return tipsters;
}

function extractTodayTips(pageText, sportHints = []) {
  const lines = pageText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const showingIndex = lines.findIndex((line) => /^Showing \d+ tips$/i.test(line));
  const loadMoreIndex = lines.findIndex((line) => line === "LOAD MORE TIPS");
  const sectionBoundaryIndex = lines.findIndex((line, index) => {
    if (index <= showingIndex) {
      return false;
    }

    return [
      "HOW DO WE SELECT TODAY’S PREDICTIONS?",
      "BETTING ON TODAY’S TIPS",
      "TIPSTERS STATS AND SUPER TIPSTER TIER",
      "MATCHES WE COVER"
    ].includes(line);
  });
  const endIndex =
    loadMoreIndex !== -1
      ? loadMoreIndex
      : sectionBoundaryIndex !== -1
        ? sectionBoundaryIndex
        : lines.length;

  if (showingIndex === -1 || endIndex <= showingIndex) {
    return [];
  }

  const tipLines = lines.slice(showingIndex + 1, endIndex);
  const tips = [];
  const sportByEvent = new Map(
    sportHints.map((hint) => [normalizeEventKey(hint.eventName), hint.sport])
  );
  const eventUrlByEvent = new Map(
    sportHints.map((hint) => [normalizeEventKey(hint.eventName), hint.eventUrl ?? null])
  );

  for (let index = 0; index < tipLines.length; ) {
    const eventName = tipLines[index];
    if (!looksLikeEventName(eventName)) {
      index += 1;
      continue;
    }

    const outcome = tipLines[index + 1] ?? null;
    const tipsterName = tipLines[index + 2] ?? null;
    if (!outcome || !tipsterName) {
      break;
    }

    let odds = null;
    let cursor = index + 3;
    while (cursor < tipLines.length) {
      const line = tipLines[cursor];
      if (looksLikeEventName(line)) {
        break;
      }

      if (/^ODDS\b/i.test(line)) {
        const inlineOdds = line.match(/ODDS\s+([0-9]+(?:\.[0-9]+)?)/i);
        odds = inlineOdds?.[1] ?? odds;
      } else if (!odds && /^[0-9]+(?:\.[0-9]+)?$/.test(line)) {
        odds = line;
      }

      cursor += 1;
    }

    tips.push({
      eventName,
      outcome,
      tipsterName,
      dateLabel: "today",
      sport: sportByEvent.get(normalizeEventKey(eventName)) ?? null,
      eventUrl: eventUrlByEvent.get(normalizeEventKey(eventName)) ?? null,
      league: null,
      kickoffLabel: null,
      odds,
      tipUrl: null
    });

    index = cursor;
  }

  return tips;
}

function looksLikeEventName(line) {
  if (!line.includes("-")) {
    return false;
  }

  if (/^(TODAY|TOMORROW|UPCOMING|LOAD MORE TIPS)$/i.test(line)) {
    return false;
  }

  return line === line.toUpperCase();
}

function extractTipsterArguments(pageText, pick) {
  const lines = pageText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const communityIndex = lines.findIndex((line) => line === "Community tips");
  const startIndex = communityIndex === -1 ? 0 : communityIndex + 1;
  const endIndex = lines.findIndex(
    (line, index) =>
      index > startIndex &&
      ["Tips", "Most tipped", "More tips", "Team performance", "Statistics & Data"].includes(line)
  );
  const relevantLines = lines.slice(startIndex, endIndex === -1 ? lines.length : endIndex);
  const wantedTipsters = new Set(pick.tipsters);
  const wantedOutcome = pick.outcome.trim();
  const argumentsByTipster = {};

  for (let index = 0; index < relevantLines.length; index += 1) {
    const line = relevantLines[index];
    if (!looksLikeEventName(line.replace(/\s-\s/g, "-")) && !line.includes(" - ")) {
      continue;
    }

    const maybeOutcome = relevantLines[index + 4];
    if (maybeOutcome !== wantedOutcome) {
      continue;
    }

    const descriptionLines = [];
    let cursor = index + 5;
    while (cursor < relevantLines.length && relevantLines[cursor] !== "Read more") {
      descriptionLines.push(relevantLines[cursor]);
      cursor += 1;
    }

    if (relevantLines[cursor] !== "Read more") {
      continue;
    }

    const maybeTipster = relevantLines[cursor + 2] ?? "";
    if (!wantedTipsters.has(maybeTipster) || argumentsByTipster[maybeTipster]) {
      continue;
    }

    argumentsByTipster[maybeTipster] = descriptionLines.join(" ").trim();
    if (Object.keys(argumentsByTipster).length === wantedTipsters.size) {
      break;
    }
  }

  return argumentsByTipster;
}

function dedupeTips(tips) {
  const deduped = new Map();

  for (const tip of tips) {
    const key = [
      tip.eventName,
      tip.outcome,
      normalizeTipsterName(tip.tipsterName),
      normalizeDateLabel(tip.dateLabel)
    ].join("::");
    deduped.set(key, tip);
  }

  return [...deduped.values()];
}

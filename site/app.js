const picksList = document.querySelector("#picks-list");
const emptyState = document.querySelector("#empty-state");
const template = document.querySelector("#pick-card-template");

const statusPill = document.querySelector("#status-pill");
const sourceDate = document.querySelector("#source-date");
const summaryLine = document.querySelector("#summary-line");
const tipsterPool = document.querySelector("#tipster-pool");
const totalTips = document.querySelector("#total-tips");
const consensusRule = document.querySelector("#consensus-rule");
const fetchedAt = document.querySelector("#fetched-at");
const tipstersList = document.querySelector("#tipsters-list");
const warningsList = document.querySelector("#warnings-list");
const siteTitle = document.querySelector("#site-title");
const siteTagline = document.querySelector("#site-tagline");

init().catch((error) => {
  renderFatal(error);
});

async function init() {
  const [config, payload] = await Promise.all([
    fetchJson("./site-config.json"),
    fetchJson("./today.json")
  ]);

  document.title = config.title;
  siteTitle.textContent = config.title;
  siteTagline.textContent = config.tagline;

  sourceDate.textContent = formatDate(payload.sourceDate);
  summaryLine.textContent = `${payload.consensusPicks.length} pick${payload.consensusPicks.length === 1 ? "" : "s"} surfaced from ${payload.totalTodayTips} scanned tips.`;
  tipsterPool.textContent = String(payload.inspectedTopTipsterCount);
  totalTips.textContent = String(payload.totalTodayTips);
  consensusRule.textContent = humanizeRule(payload.consensusRule);
  fetchedAt.textContent = formatDateTime(payload.fetchedAt);

  renderStatus(payload);
  renderTipsters(payload.topTipsters);
  renderWarnings(payload.warnings);
  renderPicks(payload.consensusPicks, payload.ok);
}

function renderStatus(payload) {
  if (payload.ok) {
    statusPill.textContent = "Fresh";
    statusPill.dataset.state = "ok";
    return;
  }

  statusPill.textContent = "Issue";
  statusPill.dataset.state = "error";
}

function renderTipsters(tipsters) {
  tipstersList.replaceChildren();
  for (const tipster of tipsters) {
    const item = document.createElement("li");
    item.textContent = `#${tipster.rank} ${tipster.name}`;
    tipstersList.append(item);
  }
}

function renderWarnings(warnings) {
  warningsList.replaceChildren();
  if (!warnings.length) {
    const item = document.createElement("li");
    item.textContent = "No warnings on the latest run.";
    warningsList.append(item);
    return;
  }

  for (const warning of warnings) {
    const item = document.createElement("li");
    item.textContent = warning;
    warningsList.append(item);
  }
}

function renderPicks(picks, ok) {
  picksList.replaceChildren();
  emptyState.hidden = picks.length !== 0;

  if (picks.length === 0) {
    emptyState.textContent = ok
      ? "No consensus picks were found on the latest run."
      : "The latest run did not complete successfully. Check the warnings panel for details.";
    return;
  }

  for (const pick of picks) {
    const node = template.content.cloneNode(true);
    node.querySelector(".sport-badge").textContent = pick.sport ?? "Unknown sport";
    node.querySelector(".count-badge").textContent = `${pick.count} agreeing tipster${pick.count === 1 ? "" : "s"}`;
    node.querySelector(".card__event").textContent = pick.eventName;
    node.querySelector(".card__outcome").textContent = pick.outcome;
    node.querySelector(".card__tipsters").innerHTML = pick.tipsters
      .map((tipster) => `<span class="tipster-chip">${escapeHtml(tipster)}</span>`)
      .join("");

    const argumentsBody = node.querySelector(".arguments__body");
    const argumentEntries = Object.entries(pick.tipsterArguments ?? {});
    if (argumentEntries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "argument argument--empty";
      empty.textContent = "No written argument was captured for the visible agreeing tipsters on this run.";
      argumentsBody.append(empty);
    } else {
      for (const [tipster, argument] of argumentEntries) {
        const block = document.createElement("article");
        block.className = "argument";
        block.innerHTML = `
          <h4>${escapeHtml(tipster)}</h4>
          <p>${escapeHtml(argument)}</p>
        `;
        argumentsBody.append(block);
      }
    }

    picksList.append(node);
  }
}

function renderFatal(error) {
  statusPill.textContent = "Issue";
  statusPill.dataset.state = "error";
  emptyState.hidden = false;
  emptyState.textContent = `Unable to load the latest site data: ${error.message}`;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.json();
}

function humanizeRule(value) {
  return value.replace(/-/g, " ");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

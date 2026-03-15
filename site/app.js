const picksList = document.querySelector("#picks-list");
const emptyState = document.querySelector("#empty-state");
const template = document.querySelector("#pick-card-template");

const statusPill = document.querySelector("#status-pill");
const sourceDate = document.querySelector("#source-date");
const summaryLine = document.querySelector("#summary-line");
const siteTitle = document.querySelector("#site-title");
const siteTagline = document.querySelector("#site-tagline");

init().catch((error) => {
  renderFatal(error);
});

async function init() {
  const assetVersion = new URL(import.meta.url).searchParams.get("v") ?? Date.now().toString();
  const [config, payload] = await Promise.all([
    fetchJson(`./site-config.json?v=${assetVersion}`),
    fetchJson(`./today.json?v=${assetVersion}`)
  ]);

  document.title = config.title;
  siteTitle.textContent = config.title;
  siteTagline.textContent = config.tagline;

  sourceDate.textContent = formatDate(payload.sourceDate);
  summaryLine.textContent = `${payload.consensusPicks.length} pick${payload.consensusPicks.length === 1 ? "" : "s"} surfaced from ${payload.totalTodayTips} scanned tips.`;

  const visibleTipsterNames = createVisibleTipsterNames(payload);
  renderStatus(payload);
  renderPicks(payload.consensusPicks, payload.ok, visibleTipsterNames);
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

function renderPicks(picks, ok, visibleTipsterNames) {
  picksList.replaceChildren();
  emptyState.hidden = picks.length !== 0;

  if (picks.length === 0) {
    emptyState.textContent = ok
      ? "No best picks were found on the latest run."
      : "The latest run did not complete successfully.";
    return;
  }

  for (const pick of picks) {
    const node = template.content.cloneNode(true);
    node.querySelector(".sport-badge").textContent = pick.sport ?? "Unknown sport";
    node.querySelector(".count-badge").textContent = `${pick.count} agreeing tipster${pick.count === 1 ? "" : "s"}`;
    node.querySelector(".card__event").textContent = pick.eventName;
    node.querySelector(".card__outcome").textContent = pick.outcome;
    node.querySelector(".card__tipsters").innerHTML = pick.tipsters
      .map((tipster) => `<span class="tipster-chip">${escapeHtml(getVisibleTipsterName(tipster, visibleTipsterNames))}</span>`)
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
          <h4>${escapeHtml(getVisibleTipsterName(tipster, visibleTipsterNames))}</h4>
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

function createVisibleTipsterNames(payload) {
  const names = new Map();
  let nextIndex = 1;

  for (const tipster of payload.topTipsters ?? []) {
    names.set(normalizeTipsterName(tipster.name), `Tipster ${tipster.rank ?? nextIndex}`);
    nextIndex += 1;
  }

  for (const pick of payload.consensusPicks ?? []) {
    for (const tipster of pick.tipsters ?? []) {
      const key = normalizeTipsterName(tipster);
      if (!names.has(key)) {
        names.set(key, `Tipster ${nextIndex}`);
        nextIndex += 1;
      }
    }

    for (const tipster of Object.keys(pick.tipsterArguments ?? {})) {
      const key = normalizeTipsterName(tipster);
      if (!names.has(key)) {
        names.set(key, `Tipster ${nextIndex}`);
        nextIndex += 1;
      }
    }
  }

  return names;
}

function getVisibleTipsterName(tipster, visibleTipsterNames) {
  return visibleTipsterNames.get(normalizeTipsterName(tipster)) ?? "Tipster";
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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeTipsterName(value) {
  return String(value ?? "").trim().toLowerCase();
}

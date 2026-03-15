import { normalizeEventKey, normalizeOutcome, normalizeTipsterName } from "./normalize.js";

export function computeConsensusPicks(tips, topTipsters) {
  const allowedTipsters = new Set(topTipsters.map((tipster) => normalizeTipsterName(tipster.name)));
  const grouped = new Map();

  for (const tip of tips) {
    const normalizedTipster = normalizeTipsterName(tip.tipsterName);
    if (!allowedTipsters.has(normalizedTipster)) {
      continue;
    }

    const eventKey = normalizeEventKey(tip.eventName);
    const outcomeKey = normalizeOutcome(tip.outcome);
    const key = `${eventKey}::${outcomeKey}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        eventKey,
        eventName: tip.eventName,
        outcome: tip.outcome,
        outcomeKey,
        count: 0,
        tipsters: [],
        tipUrls: [],
        sport: tip.sport ?? null,
        eventUrl: tip.eventUrl ?? null,
        league: tip.league ?? null,
        kickoffLabel: tip.kickoffLabel ?? null
      });
    }

    const group = grouped.get(key);
    if (group.tipsters.includes(normalizedTipster)) {
      continue;
    }

    group.count += 1;
    group.tipsters.push(normalizedTipster);
    if (tip.tipUrl) {
      group.tipUrls.push(tip.tipUrl);
    }
  }

  const ranked = [...grouped.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.eventName.localeCompare(right.eventName);
  });

  if (ranked.length === 0) {
    return [];
  }

  return ranked.slice(0, 3);
}

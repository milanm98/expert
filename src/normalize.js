function canonicalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeOutcome(value) {
  const compact = canonicalizeWhitespace(value).toLowerCase();
  return compact.replace(/[–—-]/g, "-");
}

export function normalizeEventName(home, away) {
  const parts = [home, away]
    .map((part) => canonicalizeWhitespace(part).toLowerCase())
    .filter(Boolean);

  return parts.join(" vs ");
}

export function normalizeTipsterName(value) {
  return canonicalizeWhitespace(value);
}

export function normalizeEventKey(rawEventName) {
  const eventName = canonicalizeWhitespace(rawEventName)
    .replace(/\s*[-–—]\s*/g, " - ")
    .toLowerCase();

  const [home, away] = eventName.split(" - ");
  if (!home || !away) {
    return eventName;
  }

  return normalizeEventName(home, away);
}

export function normalizeDateLabel(value) {
  return canonicalizeWhitespace(value).toLowerCase();
}

import test from "node:test";
import assert from "node:assert/strict";
import { computeConsensusPicks } from "../src/consensus.js";

test("returns the top consensus picks ordered by agreement", () => {
  const topTipsters = [
    { name: "Alpha" },
    { name: "Bravo" },
    { name: "Charlie" },
    { name: "Delta" }
  ];
  const tips = [
    { eventName: "Team A-Team B", outcome: "Over 2.5 goals", tipsterName: "Alpha" },
    { eventName: "Team A-Team B", outcome: "Over 2.5 goals", tipsterName: "Bravo" },
    { eventName: "Team C-Team D", outcome: "Draw", tipsterName: "Charlie" },
    { eventName: "Team E-Team F", outcome: "Away win", tipsterName: "Delta" }
  ];

  const result = computeConsensusPicks(tips, topTipsters);
  assert.equal(result.length, 3);
  assert.equal(result[0].count, 2);
  assert.equal(result[0].outcome, "Over 2.5 goals");
});

test("limits the response to the top three consensus picks", () => {
  const topTipsters = [
    { name: "Alpha" },
    { name: "Bravo" },
    { name: "Charlie" },
    { name: "Delta" },
    { name: "Echo" },
    { name: "Foxtrot" }
  ];
  const tips = [
    { eventName: "Team A-Team B", outcome: "Draw", tipsterName: "Alpha" },
    { eventName: "Team A-Team B", outcome: "Draw", tipsterName: "Bravo" },
    { eventName: "Team C-Team D", outcome: "Over 2.5 goals", tipsterName: "Charlie" },
    { eventName: "Team C-Team D", outcome: "Over 2.5 goals", tipsterName: "Delta" },
    { eventName: "Team E-Team F", outcome: "Home win", tipsterName: "Echo" },
    { eventName: "Team G-Team H", outcome: "Away win", tipsterName: "Foxtrot" }
  ];

  const result = computeConsensusPicks(tips, topTipsters);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((item) => item.count), [2, 2, 1]);
});

test("ignores duplicate picks from the same tipster for the same event and outcome", () => {
  const topTipsters = [{ name: "Alpha" }, { name: "Bravo" }];
  const tips = [
    { eventName: "Team A-Team B", outcome: "Draw", tipsterName: "Alpha" },
    { eventName: "Team A-Team B", outcome: "Draw", tipsterName: "Alpha" },
    { eventName: "Team A-Team B", outcome: "Draw", tipsterName: "Bravo" }
  ];

  const result = computeConsensusPicks(tips, topTipsters);
  assert.equal(result[0].count, 2);
});

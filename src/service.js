import { computeConsensusPicks } from "./consensus.js";

export class ConsensusService {
  #scraper;
  #config;

  constructor({ scraper, config }) {
    this.#scraper = scraper;
    this.#config = config;
  }

  async getTodayConsensus() {
    const fetchedAt = new Date().toISOString();
    const sourceDate = new Date().toLocaleDateString("en-CA", {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    try {
      const { topTipsters, tips, warnings } = await this.#scraper.fetchTodayConsensusInputs();
      const consensusPicks = computeConsensusPicks(tips, topTipsters);
      const enrichedConsensusPicks = await this.#scraper.enrichConsensusPicks(consensusPicks);

      return {
        ok: true,
        fetchedAt,
        sourceDate,
        topTipsters,
        consensusRule: "top-3-consensus-picks",
        inspectedTopTipsterCount: this.#config.topN,
        totalTodayTips: tips.length,
        consensusPicks: enrichedConsensusPicks,
        warnings
      };
    } catch (error) {
      return {
        ok: false,
        fetchedAt,
        sourceDate,
        topTipsters: [],
        consensusRule: "top-3-consensus-picks",
        inspectedTopTipsterCount: this.#config.topN,
        totalTodayTips: 0,
        consensusPicks: [],
        warnings: [error.message]
      };
    }
  }
}

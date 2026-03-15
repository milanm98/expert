# BettingExpert Consensus Pages App

This project logs into BettingExpert with Playwright, collects today's tips, compares them against the current top 20 tipsters from the configured leaderboard, and generates a static GitHub Pages site with the top 3 consensus picks.

## Local setup

1. Copy `.env.example` to `.env`.
2. Fill in `BETTINGEXPERT_USERNAME` and `BETTINGEXPERT_PASSWORD`.
3. Install dependencies with `npm install`.
4. Install the Chromium browser for Playwright with `npx playwright install chromium`.
5. Generate the static site with `npm run build:pages`.
6. Open `dist/index.html` in a browser to preview the generated site.

## Output

- `dist/index.html` is the static UI for your friends.
- `dist/today.json` contains the latest scraper result.
- `dist/site-config.json` contains the site title/tagline used by the UI.

## GitHub Pages deployment

The repo includes [deploy-pages.yml](/Users/simpletask/Desktop/expert/.github/workflows/deploy-pages.yml), which:

- runs every day at `07:00 UTC`
- also supports manual runs through `workflow_dispatch`
- installs Playwright
- generates `dist/`
- deploys the site to GitHub Pages

Before enabling the workflow in your future GitHub repo, add these repository secrets:

- `BETTINGEXPERT_USERNAME`
- `BETTINGEXPERT_PASSWORD`

Then enable GitHub Pages with GitHub Actions as the source.

## Optional local server

The original local server is still available:

- `npm start`
- `GET /today`
- `GET /health`

## Notes

- The scraper is built to be maintainable, but BettingExpert can change page structure at any time. If that happens, update selectors in `src/scraperConfig.js` or parsing rules in `src/scraper.js`.
- Output uses the `top-3-consensus-picks` rule.
- Some `tipsterArguments` objects may not contain every agreeing tipster if BettingExpert does not expose every visible write-up consistently on the event page.

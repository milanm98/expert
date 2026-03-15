export const selectors = {
  cookieButtons: [
    'button:has-text("I Accept")',
    'button:has-text("Accept")',
    'button:has-text("Allow all")',
    'button:has-text("I agree")'
  ],
  login: {
    openButton: 'button:has-text("Log in")',
    username: 'input[name="email"], input[name="username"], input[type="email"]',
    password: 'input[name="password"], input[type="password"]',
    submit: 'button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")',
    successSignals: [
      'button:has-text("Log out")',
      'a:has-text("Settings")',
      'a[href*="/user/profile/"]'
    ]
  },
  tips: {
    loadMoreButton: 'button:has-text("LOAD MORE TIPS")'
  },
  leaderboardRows: [
    'main li',
    'main article li',
    '[data-testid="leaderboard"] li',
    '.competition-table li'
  ],
  tipCards: [
    'main article',
    'main li',
    '[data-testid="tip-card"]',
    '.tips-list article'
  ]
};

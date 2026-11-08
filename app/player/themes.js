// 主題名稱登記處。顏色定義在 app/styles/themes.css。
export const THEMES = ['paper', 'ink', 'slate'];
export const THEME_NAMES = { paper: '紙張', ink: '深色', slate: '石板' };

export function applyTheme(name) {
  document.documentElement.dataset.theme = THEMES.includes(name) ? name : 'paper';
}

export function currentTheme() {
  return document.documentElement.dataset.theme || 'paper';
}

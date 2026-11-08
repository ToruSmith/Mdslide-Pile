// 主題名稱登記處。顏色定義在 app/styles/themes.css。
import { t } from '../core/i18n.js';
export const THEMES = ['paper', 'ink', 'slate'];
/** 主題的顯示名稱(依介面語言)。 */
export const themeName = name => t('theme.' + name);

export function applyTheme(name) {
  document.documentElement.dataset.theme = THEMES.includes(name) ? name : 'paper';
}

export function currentTheme() {
  return document.documentElement.dataset.theme || 'paper';
}

"""瀏覽器冒煙測試(CI 用,也可以本機跑)。

需要:pip install playwright && python -m playwright install chromium
用法:先在倉庫根目錄執行 node scripts/build-catalog.mjs 並啟動靜態伺服器,再執行
      python tests/smoke/smoke.py http://localhost:8000/
"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000/'
# 外部網站(YouTube 縮圖等)在 CI 或離線時可能連不上,不算錯誤
IGNORE = ('ytimg.com', 'youtube', 'bilibili', 'ERR_TUNNEL', 'ERR_NAME_NOT_RESOLVED', 'ERR_INTERNET_DISCONNECTED', 'net::ERR')

def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console: {m.text}') if m.type == 'error' and not any(k in m.text for k in IGNORE) else None)

        page.goto(BASE); page.wait_for_timeout(1500)
        assert page.locator('.hero').count() == 1, '首頁沒有載入'
        page.goto(BASE + '#/repo'); page.wait_for_timeout(2000)
        assert page.locator('.deck-card').count() >= 3, '內建書庫沒有載入'
        page.locator('.deck-card').first.click(); page.wait_for_timeout(2500)
        assert page.locator('.card').count() > 10, '播放器沒有載入'

        before = page.evaluate("[...document.querySelectorAll('.card')].slice(0, 8).map(c => getComputedStyle(c).transform)")
        for key in ['ArrowRight', 'Enter', 'Escape', 'l', 't', 'o', 'o', 'ArrowDown']:
            page.keyboard.press(key); page.wait_for_timeout(700)
        page.wait_for_timeout(1600)
        after = page.evaluate("[...document.querySelectorAll('.card')].slice(0, 8).map(c => getComputedStyle(c).transform)")
        assert before != after, '換章節後卡片位置沒有改變(洗牌動畫可能失效)'
        browser.close()

    if errors:
        print('\n'.join(errors)); sys.exit(1)
    print('smoke OK')

main()

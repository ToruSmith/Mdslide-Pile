"""瀏覽器冒煙測試(CI 用,也可以本機跑)。

需要:pip install playwright && python -m playwright install chromium
用法:先在倉庫根目錄執行 node scripts/build-catalog.mjs 並啟動靜態伺服器,再執行
      python tests/smoke/smoke.py http://localhost:8000/ [chromium|firefox|webkit]
"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000/'
ENGINE = sys.argv[2] if len(sys.argv) > 2 else 'chromium'
# 外部網站(YouTube 縮圖等)在 CI 或離線時可能連不上,不算錯誤
# 外部嵌入網站(影片、CodePen 等)的錯誤取決於測試機的網路,不算網站本身的問題
IGNORE = ('ytimg.com', 'youtube', 'bilibili', 'codepen', 'vimeo', 'ERR_TUNNEL', 'ERR_NAME_NOT_RESOLVED', 'ERR_INTERNET_DISCONNECTED', 'net::ERR')
LOCAL = ('localhost', '127.0.0.1')

def main():
    errors = []
    with sync_playwright() as p:
        browser = getattr(p, ENGINE).launch()
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
        # 內容安全政策(CSP):任何違規都算錯誤
        ctx.add_init_script("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))")
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        def on_console(m):
            src = (m.location or {}).get('url', '')
            if m.type != 'error' or any(k in m.text for k in IGNORE): return
            if src and not any(h in src for h in LOCAL): return  # 錯誤來自外部網站的框框
            errors.append(f'console: {m.text}')
        page.on('console', on_console)

        page.goto(BASE); page.wait_for_timeout(1500)
        assert page.locator('.hero').count() == 1, '首頁沒有載入'
        page.goto(BASE + '#/repo'); page.wait_for_timeout(2000)
        assert page.locator('.deck-card').count() >= 3, '內建書庫沒有載入'
        page.fill('.search', 'feature tour'); page.wait_for_timeout(200)
        assert page.locator('.deck-card:not([hidden])').count() == 1, '搜尋沒有篩選簡報'
        page.fill('.search', ''); page.wait_for_timeout(200)
        page.locator('.deck-card').first.click(); page.wait_for_timeout(2500)
        assert page.locator('.card').count() > 10, '播放器沒有載入'

        before = page.evaluate("[...document.querySelectorAll('.card')].slice(0, 8).map(c => getComputedStyle(c).transform)")
        for key in ['ArrowRight', 'Enter', 'Escape', 'l', 't', 'o', 'o', 'ArrowDown']:
            page.keyboard.press(key); page.wait_for_timeout(700)
        page.wait_for_timeout(1600)
        after = page.evaluate("[...document.querySelectorAll('.card')].slice(0, 8).map(c => getComputedStyle(c).transform)")
        assert before != after, '換章節後卡片位置沒有改變(洗牌動畫可能失效)'
        # 畫筆(D):在放大的投影片上畫一筆,Esc 關閉
        page.keyboard.press('d'); page.wait_for_timeout(900)
        fb = page.locator('.frame').bounding_box()
        page.click('.ink-bar [data-ink=pen]')
        page.mouse.move(fb['x'] + 300, fb['y'] + 400); page.mouse.down()
        for i in range(1, 15): page.mouse.move(fb['x'] + 300 + i * 12, fb['y'] + 400)
        page.mouse.up(); page.wait_for_timeout(200)
        assert page.locator('.frame .ink-strokes path').count() == 1, '畫筆沒有留下筆跡'
        page.keyboard.press('Escape'); page.keyboard.press('Escape'); page.wait_for_timeout(700)
        # 點圖片放大
        img_at = page.evaluate("[...document.querySelectorAll('.card')].findIndex(c => c.querySelector('img[data-media]:not(.logo)'))")
        if img_at >= 0:
            page.evaluate("n => { location.hash = location.hash.replace(/[/][0-9]+$/, '/' + n) }", img_at + 1); page.wait_for_timeout(900)
            page.keyboard.press('Enter'); page.wait_for_timeout(900)
            page.locator('.frame img[data-media]').first.click(); page.wait_for_timeout(400)
            assert page.locator('.lightbox').count() == 1, '點圖片沒有放大'
            page.keyboard.press('Escape'); page.keyboard.press('Escape'); page.wait_for_timeout(700)
        # 互動網頁:倉庫裡的 .html 放大後可以操作
        page_at = page.evaluate("[...document.querySelectorAll('.card')].findIndex(c => c.querySelector('[data-page]'))")
        if page_at >= 0:
            page.evaluate("n => { location.hash = location.hash.replace(/[/][0-9]+$/, '/' + n) }", page_at + 1); page.wait_for_timeout(900)
            page.keyboard.press('Enter'); page.wait_for_timeout(1200)
            demo = page.frame_locator('.frame figure.page iframe')
            try:
                demo.locator('#out').wait_for(timeout=15000)
            except Exception:
                info = page.evaluate("() => { const f = document.querySelector('.frame figure.page iframe'); return f ? [f.src, f.getAttribute('sandbox')] : 'no iframe' }")
                raise AssertionError(f'互動網頁沒有載入:{info}')
            before_v = demo.locator('#out').inner_text()
            demo.locator('#years').fill('35'); page.wait_for_timeout(300)
            assert demo.locator('#out').inner_text() != before_v, '互動網頁沒有反應'
            here = page.url
            page.locator('.frame h1').first.click(); page.wait_for_timeout(500)  # 點回投影片:拿回鍵盤,不翻頁
            assert page.url == here, '從互動網頁點回投影片時不應翻頁'
            page.keyboard.press('Escape'); page.wait_for_timeout(700)
        # 編輯模式(E):倉庫模式是唯讀,預覽要跟著打字更新
        page.keyboard.press('e'); page.wait_for_timeout(1200)
        assert page.locator('.editor').count() == 1, '編輯模式沒有打開'
        assert page.locator('.efile').inner_text().endswith('.md'), f"編輯的不是 MD 檔:{page.locator('.efile').inner_text()}"
        page.fill('.etext', '# 預覽測試\n\n- 一點\n'); page.wait_for_timeout(600)
        assert page.locator('.escale h1').inner_text() == '預覽測試', '預覽沒有跟著更新'
        page.once('dialog', lambda d: d.accept())
        page.keyboard.press('Escape'); page.wait_for_timeout(800)
        assert page.locator('.editor').count() == 0, '編輯模式沒有關閉'

        # 閱讀模式(M)
        page.keyboard.press('m'); page.wait_for_timeout(1000)
        assert page.locator('.reader .ritem').count() == page.locator('.card').count(), '閱讀模式的張數不對'
        assert '/read' in page.url, '閱讀模式的網址沒有 /read'
        page.keyboard.press('Enter'); page.wait_for_timeout(1200)
        assert page.locator('.reader').count() == 0 and page.evaluate("document.querySelector('.player').classList.contains('viewing')"), '閱讀模式按 Enter 沒有放大投影片'
        page.keyboard.press('Escape'); page.wait_for_timeout(900)
        page.keyboard.press('v'); page.wait_for_timeout(1300)
        assert page.evaluate("document.querySelector('.player').dataset.stage") == 'side', 'V 沒有切到對照模式'
        big = page.evaluate("document.querySelector('.card.focus').getBoundingClientRect().width")
        assert big > 600, f'對照模式的大圖太小:{big}'
        page.keyboard.press('v'); page.wait_for_timeout(1300)
        errors.extend('csp: ' + v for v in page.evaluate('window.__csp'))

        # 匯出單一 HTML,在全新、離線的瀏覽器設定檔用 file:// 開啟
        import os, tempfile
        cards = page.locator('.card').count()
        page.click('[data-act=export]')
        page.wait_for_selector('.export-panel [data-x=go]:not([disabled])')
        with page.expect_download() as dl:
            page.click('.export-panel [data-x=go]')
        out = os.path.join(tempfile.mkdtemp(), 'deck.html')
        dl.value.save_as(out)
        offline = browser.new_context(offline=True, viewport={'width': 1280, 'height': 800})
        q = offline.new_page()
        q.on('pageerror', lambda e: errors.append(f'export pageerror: {e}'))
        q.goto('file://' + out); q.wait_for_timeout(2000)
        assert q.locator('.card').count() == cards, '匯出的 HTML 卡片數量不對'
        q.keyboard.press('Enter'); q.wait_for_timeout(800)
        assert q.locator('.frame .slide').count() == 1, '匯出的 HTML 無法放大投影片'
        offline.close()

        # 手機:左右滑換頁(TouchEvent 建構子只有 Chromium 桌面版能用,其他引擎略過)
        if ENGINE == 'chromium':
            mob = browser.new_context(**p.devices['iPhone 13'])
            m = mob.new_page()
            m.on('pageerror', lambda e: errors.append(f'mobile pageerror: {e}'))
            m.goto(page.url.rsplit('/', 1)[0] + '/1'); m.wait_for_timeout(2000)
            assert m.locator('.rotate-hint').count() == 1, '手機直放時沒有提示轉橫向'
            assert m.evaluate("document.querySelector('.stage-select').value") == 'side', '手機沒有預設使用對照模式'
            m.click('.rotate-hint [data-r=ok]'); m.wait_for_timeout(300)
            m.evaluate("""() => { const el = document.querySelector('.stage'); const mk = x => new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 });
              el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [mk(300)], changedTouches: [mk(300)] }));
              el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [mk(60)] })); }""")
            m.wait_for_timeout(800)
            assert m.url.endswith('/2'), f'手機左滑沒有換到下一張:{m.url}'
            assert m.evaluate("document.querySelector('.pbar').scrollWidth <= innerWidth"), '手機工具列超出畫面'
            mob.close()

        # 連不上網路時打開內建範例:顯示看得懂的提示,不是「Failed to fetch」
        net = browser.new_context()
        r = net.new_page()
        r.route('**/catalog.json', lambda route: route.abort('internetdisconnected'))
        r.goto(BASE + '#/repo'); r.wait_for_timeout(1500)
        box = r.locator('.error-box').inner_text() if r.locator('.error-box').count() else ''
        assert ('網路' in box or 'offline' in box.lower()) and 'fetch' not in box.lower(), f'離線提示不對:{box!r}'
        net.close()

        # 離線快取:service worker 接手後,斷網重新整理首頁仍可開啟
        # (Playwright 只有 Chromium 能可靠模擬「有 service worker 時斷網」,其他引擎略過)
        page.goto(BASE); page.evaluate('navigator.serviceWorker.ready'); page.wait_for_timeout(1500)
        if ENGINE != 'chromium':
            pass
        elif page.evaluate('!!navigator.serviceWorker.controller'):
            ctx.set_offline(True)
            page.reload(); page.wait_for_timeout(1500)
            assert page.locator('.hero').count() == 1, '離線時首頁沒有從快取載入'
            ctx.set_offline(False)
        else:
            errors.append('service worker 沒有接手頁面')
        errors.extend('csp: ' + v for v in page.evaluate('window.__csp'))
        browser.close()

    if errors:
        print('\n'.join(errors)); sys.exit(1)
    print(f'smoke OK ({ENGINE})')

main()

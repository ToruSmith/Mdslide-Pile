# AGENTS.md:給維護這個倉庫的 AI(與人)

> **如果你的任務是「做一份簡報」**,請讀 [`製作專案指南.md`](製作專案指南.md),不必讀這份。
> 這份文件是給**修改工具本身**的人看的。

## 這個專案是什麼

Mdslide Pile 把「資料夾 + Markdown」播放成 3D 牌堆簡報。網站是遊戲機(GitHub Pages),簡報是遊戲片(使用者電腦或隨身碟上的資料夾)。

## 不能違反的原則

1. **零依賴、零建置。** 網站是原生 ES 模組,直接由靜態伺服器提供。不要加 npm 套件、打包工具或框架。需要的功能自己寫精簡版(例如 `app/core/yaml.js`、`app/core/markdown.js`)。
2. **解析器只有一份。** `app/core/` 同時給瀏覽器與 Node 腳本使用,裡面不能用到 DOM 或 Node 專屬 API。
3. **按需讀取。** 本機資料可能在隨身碟上。讀取分三層(目錄 → 封面 → 整份簡報),媒體只在快要看到時才載入。新增功能時不要在目錄層讀 MD 檔;`tests/core.test.mjs` 有測試在把關。
4. **規則文件與程式同步。** 改了規則(版型、設定欄位、命名規則),必須同時更新 `製作專案指南.md`、`docs/GUIDE.en.md`、範例內容與測試。
5. **使用者內容不執行。** Markdown 裡的 HTML 一律跳脫;外部連結只允許 http(s)、mailto 與相對路徑。
6. **介面文字一律走 i18n。** 新增任何使用者看得到的文字,必須同時加進 `app/core/locales/zh-Hant.js` 與 `en.js`,程式裡用 `t('鍵')` 取用;不要把 `t` 拿來當變數名稱。`tests/i18n.test.mjs` 會擋下寫死的中文與缺漏的鍵。
7. **向後相容。** `deck.yml` 的 `mdslide: 1` 是規則版本;破壞性變更才升版,並保留舊版的讀法。

## 架構

```
index.html               入口(只載入 CSS 與 app/main.js;含 CSP)
sw.js                    離線快取(依 shell-manifest.js 預先快取網站本身,不快取簡報內容)
offline.html             沒網路也沒快取時的說明頁
manifest.webmanifest     安裝成 App 用;icon.svg 與 icons/(PNG)是圖示
app/
  main.js                路由、首頁、資料來源切換、介面語言、即時重新載入
  standalone.js          匯出的單一 HTML 檔的入口(內嵌資料來源)
  core/                  ── 純邏輯,瀏覽器與 Node 共用 ──
    names.js             檔名、排序前綴、略過規則
    yaml.js              精簡 YAML 解析
    markdown.js          精簡 Markdown → HTML(跳脫所有 HTML)
    media.js             媒體分類(本機 / YouTube / Bilibili / Drive / Vimeo)與路徑規則
    slide.js             一個 MD 檔 → 投影片資料(front matter、拆張、備註、自動版型)
    library.js           書庫掃描三層:scanLibrary / loadCover / loadDeck
    check.js             檢查規則(網站按鈕、check.mjs、單檔版共用)
    chart.js             圖表表格解析與刻度(負值、缺值、1/2/5 級距)
    color.js             顏色白名單(safeColor)
    highlight.js         程式碼上色(只輸出跳脫後的 span)
    i18n.js              t()、setLang()、簡報語言偵測
    locales/             zh-Hant.js、en.js(兩份的鍵與 {參數} 必須一致)
  sources/
    sources.js           HttpSource(倉庫)、HandleSource(Chrome/Edge 資料夾)、FileListSource(其他瀏覽器)
    store.js             IndexedDB:記住最近開啟的資料夾
  ui/library-view.js     目錄頁(封面懶載入)
  ui/check-view.js       檢查結果面板
  player/
    render.js            投影片資料 → HTML(所有版型在這裡)
    hydrate.js           媒體佔位 → 真實網址
    layouts.js           3D 排列(純函式)
    player.js            播放器:動畫、放大、逐步、鍵盤、講者同步、列印、重新載入、動畫偏好
    export.js            匯出單一 HTML(import map + data: 網址,不需打包工具)
    presenter.js         講者視窗
    themes.js            主題名稱登記
  styles/
    themes.css           主題變數
    slides.css           投影片內容與各版型樣式(1280×720)
    app.css              介面外框
scripts/
  build-catalog.mjs      產生 catalog.json 與 shell-manifest.js(部署時執行)
  shell-files.mjs        網站本身的檔案清單與雜湊(給 sw.js)
  check.mjs              檢查資料夾是否符合規則(命令列)
  new-deck.mjs           建立新簡報骨架(內容文字在 locale 的 scaffold.*)
  build-starter.mjs      組出範例書庫(starter/ + content/ 的主題 + dist/),發布時打包
starter/                 範例書庫的 README 與 _site.yml
  bundle-check.mjs       產生 dist/mdslide-check.mjs 單檔版
  node-source.mjs        Node 版資料來源
dist/                    自動產生的單檔檢查工具與雙擊捷徑(不要手動修改)
content/                 內建書庫;00-官方範例 是驗收基準,不要刪
docs/                    GUIDE.en.md(英文製作指南)等
tests/                   node:test 單元測試;smoke/smoke.py 是瀏覽器冒煙測試(Python Playwright)
  protected.test.mjs     洗牌動畫守門:改到受保護的程式會失敗
  i18n.test.mjs          locale 鍵一致、沒有寫死的中文、不可用 t 當變數名稱
  docs-sync.test.mjs     版型、排列、設定欄位與兩份指南同步
  visual/compare.py      畫面比對:PR 時與目標分支逐張比對官方範例(提醒用)
```

資料流:`source` → `core/library.js` → 簡報資料 → `player/render.js` → HTML → `hydrate.js` 補上媒體。

資料來源介面(新增來源時只要實作這些):`label`、`list(path)`、`readText(path)`、`mediaURL(path)`、`releaseMedia()`。

## 常見修改

**新增版型**
1. `app/core/slide.js` 的 `LAYOUTS` 加上名稱(必要時調整 `autoLayout`)。
2. `app/player/render.js` 的 `switch` 加上輸出。
3. `app/styles/slides.css` 加上 `.l-<名稱>` 樣式;用 `--c`、`--slide-*` 變數,三套主題都要能看。
4. `製作專案指南.md` 第 5 節的表格與範例。
5. 在 `content/00-官方範例/01-功能總覽/03-功能展示/` 加一張示範。

**新增主題**:`app/styles/themes.css` 複製一段 `[data-theme]`,再到 `app/player/themes.js` 的 `THEMES` 登記、在兩份 locale 加上 `theme.<名稱>`,並更新兩份指南。

**新增 3D 排列**:在 `app/player/layouts.js` 寫一個純函式並加進 `STAGES`(要在牌堆輪替中出現就加進 `STAGE_ORDER`),並更新指南的 `layout.stage` 說明。

**新增檢查規則**:只改 `app/core/check.js`,然後執行 `node scripts/bundle-check.mjs` 更新單檔版(`tests/bundle.test.mjs` 會在不同步時失敗)。

**新增線上影片平台**:`app/core/media.js` 的 `classifyMedia`,並在 `tests/core.test.mjs` 加測試。

## 開發與驗證

不需要安裝任何東西,只需要 Node 18 以上(跑測試與腳本)與任何靜態伺服器:

```bash
node --test tests/*.test.mjs          # 單元測試
node scripts/check.mjs content        # 檢查內建書庫
node scripts/new-deck.mjs <資料夾>     # 建立新簡報骨架
node scripts/build-catalog.mjs        # 產生 catalog.json(倉庫模式需要)
python3 -m http.server 8000           # 開 http://localhost:8000
```

提交前的檢查:

- [ ] 改過 `app/core/` 就執行 `node scripts/bundle-check.mjs`
- [ ] 測試全部通過(含 `protected.test.mjs` 洗牌動畫守門;洗牌的時間、軌跡與 `STAGES[*].shuffle` 不可更動,只能新增選項)
- [ ] 新增的介面文字兩份 locale 都有,鍵與參數一致(`i18n.test.mjs`)
- [ ] 改了播放器或匯出:`python3 tests/smoke/smoke.py http://localhost:8000/` 通過(需要先 `pip install playwright`,不要寫進 package.json)
- [ ] `check.mjs content` 沒有警告
- [ ] 用瀏覽器開過官方範例,牌堆、放大、六種排列、三套主題、講者視窗(S)、列印(P)都正常
- [ ] 規則有變動時,`製作專案指南.md` 與 `docs/GUIDE.en.md` 已同步
- [ ] `CHANGELOG.md` 已記錄

## 部署

推送到 `main` 後會產生 `catalog.json` 與 `shell-manifest.js` 並部署到 GitHub Pages(這兩個檔案不進版本控制)。部署和測試在同一個 `.github/workflows/ci.yml`:單元測試、書庫檢查、單檔版同步、三種瀏覽器引擎的冒煙測試都通過,才會部署。PR 另外會跑畫面比對,有變化的投影片列在 Actions 摘要並附上差異圖(只是提醒,不會擋 PR)。`.github/dependabot.yml` 每月提醒更新 Actions 版本。

## 發布新版

1. `package.json`、`app/main.js` 的 `VERSION`、`CHANGELOG.md` 改成新版本號(`tests/version.test.mjs` 會檢查三處一致)。
2. 推送到 `main`,等 CI 通過、網站部署完成。
3. 打標籤並推送:`git tag v1.4.0 && git push origin v1.4.0`。`.github/workflows/release.yml` 會建立 GitHub Release,附上 `Mdslide書庫.zip`(範例書庫 + 檢查工具)與 `mdslide-check.mjs`,說明取自 CHANGELOG 該版本的段落。

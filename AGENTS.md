# AGENTS.md:給維護這個倉庫的 AI(與人)

> **如果你的任務是「做一份簡報」**,請讀 [`製作專案指南.md`](製作專案指南.md),不必讀這份。
> 這份文件是給**修改工具本身**的人看的。

## 這個專案是什麼

Mdslide Pile 把「資料夾 + Markdown」播放成 3D 牌堆簡報。網站是遊戲機(GitHub Pages),簡報是遊戲片(使用者電腦或隨身碟上的資料夾)。

## 不能違反的原則

1. **零依賴、零建置。** 網站是原生 ES 模組,直接由靜態伺服器提供。不要加 npm 套件、打包工具或框架。需要的功能自己寫精簡版(例如 `app/core/yaml.js`、`app/core/markdown.js`)。
2. **解析器只有一份。** `app/core/` 同時給瀏覽器與 Node 腳本使用,裡面不能用到 DOM 或 Node 專屬 API。
3. **按需讀取。** 本機資料可能在隨身碟上。讀取分三層(目錄 → 封面 → 整份簡報),媒體只在快要看到時才載入。新增功能時不要在目錄層讀 MD 檔;`tests/core.test.mjs` 有測試在把關。
4. **規則文件與程式同步。** 改了規則(版型、設定欄位、命名規則),必須同時更新 `製作專案指南.md`、範例內容與測試。
5. **使用者內容不執行。** Markdown 裡的 HTML 一律跳脫;外部連結只允許 http(s)、mailto 與相對路徑。
6. **向後相容。** `deck.yml` 的 `mdslide: 1` 是規則版本;破壞性變更才升版,並保留舊版的讀法。

## 架構

```
index.html               入口(只載入 CSS 與 app/main.js)
sw.js                    離線快取(只快取網站本身,不快取簡報內容)
app/
  main.js                路由、首頁、資料來源切換
  core/                  ── 純邏輯,瀏覽器與 Node 共用 ──
    names.js             檔名、排序前綴、略過規則
    yaml.js              精簡 YAML 解析
    markdown.js          精簡 Markdown → HTML(跳脫所有 HTML)
    media.js             媒體分類(本機 / YouTube / Bilibili / Drive / Vimeo)與路徑規則
    slide.js             一個 MD 檔 → 投影片資料(front matter、拆張、備註、自動版型)
    library.js           書庫掃描三層:scanLibrary / loadCover / loadDeck
    check.js             檢查規則(網站按鈕、check.mjs、單檔版共用)
  sources/
    sources.js           HttpSource(倉庫)、HandleSource(Chrome/Edge 資料夾)、FileListSource(其他瀏覽器)
    store.js             IndexedDB:記住最近開啟的資料夾
  ui/library-view.js     目錄頁(封面懶載入)
  ui/check-view.js       檢查結果面板
  player/
    render.js            投影片資料 → HTML(所有版型在這裡)
    hydrate.js           媒體佔位 → 真實網址
    layouts.js           3D 排列(純函式)
    player.js            播放器:動畫、放大、逐步、鍵盤、講者同步、列印
    presenter.js         講者視窗
    themes.js            主題名稱登記
  styles/
    themes.css           主題變數
    slides.css           投影片內容與各版型樣式(1280×720)
    app.css              介面外框
scripts/
  build-catalog.mjs      產生 catalog.json(部署時執行)
  check.mjs              檢查資料夾是否符合規則(命令列)
  bundle-check.mjs       產生 dist/mdslide-check.mjs 單檔版
  node-source.mjs        Node 版資料來源
dist/                    自動產生的單檔檢查工具與雙擊捷徑(不要手動修改)
content/                 內建書庫;00-官方範例 是驗收基準,不要刪
tests/                   node:test 單元測試
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

**新增主題**:`app/styles/themes.css` 複製一段 `[data-theme]`,再到 `app/player/themes.js` 的 `THEMES` 與 `THEME_NAMES` 登記,並更新指南。

**新增 3D 排列**:在 `app/player/layouts.js` 寫一個純函式並加進 `STAGES`(要在牌堆輪替中出現就加進 `STAGE_ORDER`),並更新指南的 `layout.stage` 說明。

**新增檢查規則**:只改 `app/core/check.js`,然後執行 `node scripts/bundle-check.mjs` 更新單檔版(`tests/bundle.test.mjs` 會在不同步時失敗)。

**新增線上影片平台**:`app/core/media.js` 的 `classifyMedia`,並在 `tests/core.test.mjs` 加測試。

## 開發與驗證

不需要安裝任何東西,只需要 Node 18 以上(跑測試與腳本)與任何靜態伺服器:

```bash
node --test tests/*.test.mjs          # 單元測試
node scripts/check.mjs content        # 檢查內建書庫
node scripts/build-catalog.mjs        # 產生 catalog.json(倉庫模式需要)
python3 -m http.server 8000           # 開 http://localhost:8000
```

提交前的檢查:

- [ ] 改過 `app/core/` 就執行 `node scripts/bundle-check.mjs`
- [ ] 測試全部通過
- [ ] `check.mjs content` 沒有警告
- [ ] 用瀏覽器開過官方範例,牌堆、放大、六種排列、三套主題、講者視窗(S)、列印(P)都正常
- [ ] 規則有變動時,`製作專案指南.md` 已同步
- [ ] `CHANGELOG.md` 已記錄

## 部署

推送到 `main` 後,`.github/workflows/deploy.yml` 會跑測試、產生 `catalog.json`,再部署到 GitHub Pages。`catalog.json` 不進版本控制。

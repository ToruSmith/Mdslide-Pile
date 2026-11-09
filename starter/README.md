# Mdslide 書庫

這是一個 Mdslide Pile 書庫。

## 怎麼播放

1. 用 Chrome 或 Edge 打開 https://torusmith.github.io/Mdslide-Pile/
2. 按「開啟本機資料夾」,選擇「Mdslide書庫」這個資料夾
3. 之後在首頁的「最近開啟的書庫」點一下就能重新連線

網站可以「安裝」成 App(網址列右側的安裝圖示),裝過一次之後沒有網路也能播放這個書庫。
要寄給別人或在沒有網路的電腦上報告:在播放畫面按「匯出」,會得到一個雙擊就能播放的 `.html` 檔。

## 怎麼新增簡報

在主題資料夾裡新增一個資料夾,例如 `02-工作報告/2026-12-年終成果/`,
裡面放 `deck.yml` 與章節資料夾,每個 `.md` 檔是一張投影片。

操作說明與完整規則都在 `_說明/` 資料夾(底線開頭,不會被當成簡報):

- `使用手冊.md`:快捷鍵、編輯模式、設定速查表(可以直接複製)、字型、顏色、請 AI 幫忙
- `製作專案指南.md`:資料夾、設定檔、版型的完整規則;請 AI 做簡報時,把這份給它讀
- 英文版:`MANUAL.en.md`、`GUIDE.en.md`

## 怎麼檢查

做完簡報後,任選一種:

- **不用安裝**:在網站開啟這個書庫,按「✓ 檢查」
- **雙擊執行**(需要先安裝 [Node.js](https://nodejs.org/)):Windows 雙擊「檢查書庫.cmd」,Mac 雙擊「檢查書庫.command」

`mdslide-check.mjs` 是檢查工具本體,放在哪個資料夾就檢查哪個資料夾。
工具更新時,到 https://github.com/ToruSmith/Mdslide-Pile/releases 下載最新的 `mdslide-check.mjs` 覆蓋即可(你的簡報不用動)。

## 目前內容

- `01-財經市場/`:兩份台股大跌時事簡報(範例內容,數字截至 2026-11-08,不再更新)
- `02-工作報告/`:空的,等你放第一份
- `03-學習分享/`:空的,等你放第一份

不想播放的東西,資料夾或檔名前面加 `_`(例如 `_封存`)就會被略過。
這份 README 不會被當成投影片。

---

**English:** this is a Mdslide Pile library. Open https://torusmith.github.io/Mdslide-Pile/ in Chrome or Edge, choose "Open a local folder" and pick this folder. The user manual and full rules are in the `_說明/` folder (`MANUAL.en.md`, `GUIDE.en.md`).

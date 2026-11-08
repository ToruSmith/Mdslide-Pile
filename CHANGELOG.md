# 更新紀錄

## 1.0.0 — 2026-11-08

第一個版本。

- 書庫 → 主題 → 簡報 → 章節 → 投影片的資料夾規則,所有設定檔可省略
- 三層按需讀取:目錄、封面、整份簡報;媒體快看到時才載入
- 本機模式:Chrome / Edge 可記住資料夾;其他瀏覽器可選擇或拖放資料夾
- 倉庫模式:`content/` 由 GitHub Actions 產生目錄並部署
- 六種 3D 排列:牌堆(洗牌)、封面流、圓柱、螺旋、球體、總覽
- 三套主題:紙張、深色、石板
- 版型:text、center、split、split-left、full、quote、number、stats、timeline、columns、agenda、chart(bar / hbar / line)、title、section、end
- 媒體:本機圖片影片;YouTube、Bilibili、Google Drive、Vimeo 嵌入
- 逐步顯示、講者視窗、黑屏、全螢幕、列印 / PDF、離線快取
- `scripts/check.mjs` 檢查工具、`製作專案指南.md`、`AGENTS.md`
- 零依賴,無建置步驟

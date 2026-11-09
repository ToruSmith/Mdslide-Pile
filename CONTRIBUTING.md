# 參與貢獻 / Contributing

謝謝你願意幫忙!先看看你想做的是哪一種:

| 我想… | 怎麼做 |
|---|---|
| 學會操作 | 讀 [`docs/使用手冊.md`](docs/使用手冊.md)(英文:[`docs/MANUAL.en.md`](docs/MANUAL.en.md)) |
| 做一份簡報 | 讀 [`製作專案指南.md`](製作專案指南.md)(英文:[`docs/GUIDE.en.md`](docs/GUIDE.en.md)),不需要改程式 |
| 回報錯誤 | 開一個 Issue,選「錯誤回報」,附上重現步驟 |
| 建議新功能 | 開一個 Issue,選「功能建議」,說明想解決的問題 |
| 回報安全問題 | **不要開公開 Issue**,看 [`SECURITY.md`](SECURITY.md) |
| 修改程式 | 先讀 [`AGENTS.md`](AGENTS.md),再發 Pull Request |

## 修改程式之前

這個專案刻意保持簡單,請先確認你的改動符合 [`AGENTS.md`](AGENTS.md) 的原則,最重要的幾條:

- **零依賴、零建置**:不加 npm 套件、打包工具或框架。
- **使用者內容不執行**:Markdown 裡的 HTML 一律跳脫。
- **介面文字走 i18n**:中英兩份 locale 都要加。
- **不改既有的資料夾規則**:現有的簡報資料夾必須照樣能播放。

大的功能請先開 Issue 討論,避免做完才發現方向不合。

## 驗證

只需要 Node 18 以上:

```bash
node --test tests/*.test.mjs       # 單元測試
node scripts/check.mjs content     # 檢查內建書庫,應該沒有警告
python3 -m http.server 8000        # 用瀏覽器開 http://localhost:8000 實際操作
```

改了 `app/core/` 要執行 `node scripts/bundle-check.mjs`。完整的提交前清單在 `AGENTS.md`。PR 會自動跑測試與三種瀏覽器引擎的冒煙測試。

---

**English:** to learn the basics, read `docs/MANUAL.en.md`; to make a deck, read `docs/GUIDE.en.md` (no code changes needed). To report a bug or suggest a feature, open an issue using the templates. For security problems, see `SECURITY.md`. Before changing code, read `AGENTS.md`: no dependencies or build step, never execute user content, all UI text goes through i18n, and existing deck folders must keep working. Run `node --test tests/*.test.mjs` and `node scripts/check.mjs content` before opening a pull request.

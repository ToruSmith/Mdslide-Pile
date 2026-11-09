# 安全問題回報 / Security

## 怎麼回報

發現安全問題時,**請不要開公開的 Issue**,改用 GitHub 的私密回報:

到倉庫的 **Security** 分頁 → **Report a vulnerability**,寫下:

- 問題是什麼、影響範圍(例如能執行簡報裡的程式、能讀到不該讀的檔案)
- 重現步驟,最好附上一份最小的簡報資料夾
- 使用的瀏覽器與版本

我們會在確認後修正,並在 `CHANGELOG.md` 記錄(不會公開回報者資料,除非你希望被列名)。

## 範圍

Mdslide Pile 是純前端的靜態網站,沒有伺服器與帳號。以下屬於安全問題:

- 簡報內容(Markdown、設定檔、媒體網址)能在網站上執行程式,或繞過 HTML 跳脫
- 嵌入的網頁或本機 HTML 能讀取網站本身的資料(例如最近開啟的資料夾)
- 編輯模式寫到書庫資料夾以外、寫入 `.md` / `.yml` 以外的檔案,或刪除使用者的檔案
- 匯出的單一 HTML 能被簡報內容注入程式

以下**不屬於**安全問題:

- 你自己放進簡報的外部網站(YouTube、CodePen 等)本身的行為
- 需要先改動網站程式碼才能發生的情況

## 現有的防護

設計上的安全規則寫在 [`AGENTS.md`](AGENTS.md)(「不能違反的原則」與「寫入的安全規則」),並由 `tests/` 裡的測試把關。

---

**English:** please do not open a public issue. Use the repository's **Security → Report a vulnerability** form and include steps to reproduce (ideally a minimal deck folder) and your browser version. In scope: running script from deck content, bypassing HTML escaping, embedded pages reading site data, the editor writing outside the library folder or deleting files, and script injection into exported HTML.

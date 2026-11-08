#!/usr/bin/env node
// Mdslide Pile 書庫檢查工具(單檔版 v1.8.0)
// 由 scripts/bundle-check.mjs 自動產生,請不要手動修改。原始碼:https://github.com/ToruSmith/Mdslide-Pile
//
// 用法(需要 Node.js 18 以上):
//   node mdslide-check.mjs                 檢查這個檔案所在的資料夾(放在書庫根目錄時 = 整個書庫)
//   node mdslide-check.mjs <資料夾>         檢查指定的書庫、主題或單一簡報
//   node mdslide-check.mjs <資料夾> --slides 連每張投影片都列出來
//   node mdslide-check.mjs <資料夾> --lang en  英文輸出(預設依作業系統語言)
// Windows 也可以直接雙擊「檢查書庫.cmd」,Mac 雙擊「檢查書庫.command」。

import * as fsp from 'node:fs/promises';
import * as nodePath from 'node:path';
import { fileURLToPath as __toPath } from 'node:url';

// ───────── app/core/locales/zh-Hant.js ─────────
// 繁體中文字串表。新增任何使用者看得到的文字時,必須同時加進 en.js(tests/i18n.test.mjs 會檢查)。
// {name} 是參數佔位,兩份語言的佔位必須一致。

const LOCALE_ZH_HANT = {
  // ---------- 設定檔(YAML)----------
  'yaml.line': '第 {line} 行:{message}',
  'yaml.tab': '請用空白縮排,不要用 Tab',
  'yaml.inconsistent': '縮排不一致',
  'yaml.tooDeep': '縮排過多',
  'yaml.notList': '這裡應該是「名稱: 值」,不是清單',
  'yaml.unknown': '看不懂「{text}」,格式應為「名稱: 值」',
  'yaml.array': '行內陣列缺少 ]',

  // ---------- 解析時的提醒 ----------
  'lib.defaultLabel': '書庫',
  'issue.color': '顏色「{value}」格式不正確,已改用預設顏色',
  'issue.slideColor': '顏色「{value}」格式不正確,已改用章節顏色',
  'issue.readFailed': '讀取失敗',
  'issue.noSlides': '這個資料夾裡沒有找到任何投影片(.md 檔)',
  'issue.newerSchema': '此簡報需要較新版本的工具(mdslide: {version})',
  'issue.frontMatter': '開頭設定(front matter){detail}',
  'issue.frontMatterParse': '無法解析',
  'issue.layout': '未知的版型「{layout}」,改用自動判斷。可用:{list}',
  'issue.brandFont': 'brand 字型「{value}」含有不允許的字元,已忽略',

  // ---------- 檢查 ----------
  'check.noTable': 'chart 版型找不到表格',
  'check.badCell': '圖表第 {row} 列第 {col} 欄「{text}」不是數字,會顯示為空白',
  'check.missingMedia': '找不到素材 {src}(實際路徑 {path})',
  'check.missingBg': '找不到背景圖 {src}',
  'check.missingCover': '找不到 cover_image {src}',
  'check.missingLogo': '找不到 brand.logo {src}',
  'check.missingFootnote': '腳註 [^{id}] 沒有定義',
  'check.deckFolder': '(簡報資料夾)',
  'check.tooMany': '共 {n} 張,25–30 分鐘的報告建議 20–30 張',
  'check.opening': '(開場)',
  'check.unreadable': '無法讀取:{error}',
  'check.kind.library': '書庫',
  'check.kind.topic': '主題',
  'check.kind.deck': '單一簡報',
  'check.report.title': '📚 {title}(偵測為:{kind})',
  'check.report.topic': '▸ 主題:{title}',
  'check.report.empty': '  (還沒有簡報)',
  'check.report.deck': '  ▪ {title}{date}— {sections} 章、{total} 張、{layouts} 種版型、備註 {noted}/{total}{noConfig}',
  'check.report.date': '({date})',
  'check.report.noConfig': '、沒有 deck.yml',
  'check.report.section': '      {title}:{count} 張',
  'check.report.untitled': '(無標題)',
  'check.report.auto': '  (自動)',
  'check.report.problems': '⚠ {n} 個問題:',
  'check.report.ok': '✓ 沒有發現問題',
  'check.usage': '用法:node scripts/check.mjs <資料夾> [--slides] [--lang en|zh-Hant]',
  'catalog.done': 'catalog.json:{topics} 個主題、{decks} 份簡報、{slides} 張投影片',

  // ---------- 資料來源 ----------
  'source.repoLabel': '內建範例',
  'source.localLabel': '本機資料夾',
  'source.noCatalog': '找不到 catalog.json',

  // ---------- 投影片自動文字(依簡報語言)----------
  'slide.thanks': '謝謝',
  'slide.agenda': '大綱',
  'slide.noMedia': '沒有媒體',
  'slide.missingMedia': '找不到素材',

  // ---------- 主題與排列 ----------
  'theme.paper': '紙張',
  'theme.ink': '深色',
  'theme.slate': '石板',
  'stage.pile': '牌堆',
  'stage.coverflow': '封面流',
  'stage.carousel': '圓柱',
  'stage.helix': '螺旋',
  'stage.sphere': '球體',
  'stage.overview': '總覽',
  'stage.side': '對照',

  // ---------- 首頁與導覽 ----------
  'doc.title': 'Mdslide Pile · 把資料夾變成會動的簡報',
  'nav.repo': '內建範例',
  'nav.home': '我的書庫',
  'nav.backHome': '回首頁',
  'lang.label': '語言 / Language',
  'lang.zhShort': '中',
  'loading': '讀取中…',
  'loading.library': '讀取書庫目錄…',
  'loading.deck': '讀取簡報…',
  'err.title': '出了點問題',
  'err.offlineTitle': '目前沒有網路',
  'err.offline': '內建範例與倉庫裡的簡報需要連線才能讀取。你電腦或隨身碟上的簡報資料夾不需要網路,回首頁選擇資料夾即可。',
  'err.noRecord': '找不到這個書庫的紀錄,請重新開啟資料夾。',
  'err.sessionGone': '這次開啟的資料夾已經失效(重新整理頁面後需要再選一次)。',
  'err.cannotRead': '無法讀取這個資料夾,可能已被移動或隨身碟未插上。',
  'err.noDeck': '找不到這份簡報,可能已經改名或移除。',
  'err.emptyDeck': '這份簡報裡沒有投影片。',
  'err.dropFolder': '請拖入「資料夾」,不是單一檔案。',
  'drop.hint': '放開來開啟這個資料夾',
  'home.eyebrow': '把資料夾變成會動的簡報',
  'home.title': '網站是遊戲機,<br>你的資料夾是遊戲片。',
  'home.lead': '簡報檔案留在你的電腦或隨身碟裡,這裡只負責播放。不用安裝、不用上傳。',
  'home.open': '開啟本機資料夾',
  'home.repo': '看內建範例',
  'home.tipPicker': '也可以直接把資料夾拖進這個視窗。Chrome / Edge 會記住你開過的書庫。',
  'home.tipNoPicker': '也可以直接把資料夾拖進這個視窗。這個瀏覽器無法記住資料夾,重新整理後需要再選一次;用 Chrome 或 Edge 體驗最好。',
  'home.recent': '最近開啟的書庫',
  'home.forget': '從清單移除(不會刪除檔案)',
  'home.step1.title': '準備資料夾',
  'home.step1.text': '一個資料夾一份簡報,子資料夾是章節,每個 .md 檔是一張投影片。',
  'home.step2.title': '開啟',
  'home.step2.text': '開啟整個書庫、一個主題,或單一簡報資料夾都可以,會自動判斷。',
  'home.step3.title': '上台',
  'home.step3.text': 'Enter 放大、方向鍵翻頁、S 開講者視窗、P 存成 PDF。',
  'home.rules': '規則說明:',
  'home.guideName': '製作專案指南.md',
  'home.guidePath': '製作專案指南.md',
  'perm.title': '重新連線「{name}」',
  'perm.text': '為了保護你的檔案,瀏覽器每次重新開啟都需要再確認一次讀取權限。<br>如果是隨身碟,請先確認已經插上。',
  'perm.grant': '允許讀取',

  // ---------- 目錄頁 ----------
  'lib.repo': '內建書庫',
  'lib.local': '本機書庫',
  'lib.eyebrow': '{kind} · {topics} 個主題 · {decks} 份簡報',
  'lib.search': '搜尋簡報標題、標籤…',
  'lib.noResults': '找不到符合「{q}」的簡報',
  'lib.check': '✓ 檢查',
  'lib.checkTitle': '檢查所有簡報是否符合規則',
  'lib.refresh': '↻ 重新整理',
  'lib.refreshTitle': '重新讀取資料夾',
  'lib.all': '全部',
  'lib.issues': '⚠ {n} 個設定檔問題',
  'lib.empty': '這個主題還沒有簡報',
  'lib.chapters': '{n} 章',

  // ---------- 檢查面板 ----------
  'checkp.aria': '檢查結果',
  'checkp.title': '檢查',
  'checkp.close': '關閉(Esc)',
  'checkp.progress': '檢查中({i}/{n}):{title}',
  'checkp.finishing': '整理結果…',
  'checkp.failed': '檢查失敗:{error}',
  'checkp.problems': '⚠ {n} 個問題',
  'checkp.summary': '{decks} 份簡報 · {slides} 張投影片',
  'checkp.problemsHeading': '問題',
  'checkp.decksHeading': '簡報',
  'checkp.sections': '{n} 章',
  'checkp.slides': '{n} 張',
  'checkp.layouts': '{n} 種版型',
  'checkp.notes': '備註 {a}/{b}',
  'checkp.auto': '自動',
  'checkp.noDecks': '還沒有簡報',
  'checkp.foot': '規則:製作專案指南.md · 版型建議至少 4 種、每張都有講者備註。修改檔案後再按一次「檢查」即可。',

  // ---------- 播放器 ----------
  'player.back': '‹ 目錄',
  'player.backTitle': '回到目錄(Esc)',
  'player.stageTitle': '排列方式(L)',
  'player.theme': '主題',
  'player.themeTitle': '切換主題(T)',
  'player.check': '檢查',
  'player.rotate': '把手機轉成橫向,投影片會大很多。',
  'player.rotateLock': '全螢幕橫放',
  'player.rotateOk': '知道了',
  'player.export': '匯出',
  'player.exportTitle': '匯出成單一 HTML 檔(離線也能播放)',
  'export.title': '匯出成單一 HTML 檔',
  'export.text': '程式、樣式、簡報內容與圖片會放進同一個檔案,雙擊就能離線播放,不需要網路或這個網站。線上影片(YouTube 等)仍需要網路。',
  'export.measuring': '正在計算檔案大小…',
  'export.size': '預估大小:{size}',
  'export.videos': '包含影片與音訊({n} 個,約 {size})',
  'export.go': '下載',
  'export.cancel': '取消',
  'export.working': '正在產生檔案…',
  'export.done': '已匯出({size})',
  'export.failed': '匯出失敗,請再試一次。',
  'player.checkTitle': '檢查這份簡報',
  'player.presentTitle': '放大播放(Enter)',
  'player.helpTitle': '快捷鍵(?)',
  'player.hint': '← → 翻頁 · ↑ ↓ 換章 · Enter 放大 · L 排列 · ? 說明',
  'player.issues': '⚠ {n} 個提醒',
  'player.slideLabel': '第 {n} 張:{title}',
  'player.reloaded': '已重新載入',
  'player.reloadUnsupported': '這個資料來源無法重新載入,請重新開啟資料夾',
  'help.title': '快捷鍵',
  'help.foot': '點卡片選取,再點一次放大。滑鼠滾輪也可以翻頁。',
  'help.motion': '動畫',
  'help.motionFull': '完整',
  'help.motionReduced': '簡化',
  'key.prevNext': '上一張 / 下一張(翻頁筆也可以)',
  'key.section': '上一章 / 下一章(牌堆會洗牌)',
  'key.enter': '放大 / 縮回',
  'key.esc': '縮回、離開總覽、回目錄',
  'key.jump': '跳到第幾章',
  'key.homeEnd': '第一張 / 最後一張',
  'key.overview': '總覽',
  'key.side': '對照模式(大圖 + 縮圖列)',
  'key.stage': '切換排列',
  'key.theme': '切換主題',
  'key.black': '黑屏',
  'key.full': '全螢幕',
  'key.presenter': '開啟講者視窗',
  'key.print': '列印 / 存成 PDF',
  'key.video': '放大時播放 / 暫停本機影片',
  'key.reload': '重新載入簡報',
  'key.help': '這個說明',
  'toast.theme': '主題:{name}',
  'toast.noPresenter': '這個瀏覽器不支援講者視窗',
  'toast.popupBlocked': '瀏覽器擋住了彈出視窗,請允許後再按 S',
  'toast.printing': '準備列印中…',

  // ---------- 講者視窗 ----------
  'pv.docTitle': '講者視窗 · Mdslide Pile',
  'pv.current': '目前',
  'pv.elapsed': '經過',
  'pv.now': '現在',
  'pv.reset': '重設',
  'pv.next': '下一張',
  'pv.notes': '備註',
  'pv.waiting': '等待主視窗…(在主視窗按 S 開啟)',
  'pv.keys': '← → 翻頁 · ↑ ↓ 換章 · Enter 放大 · B 黑屏(再按一次回來)· 這個視窗的按鍵會同步到主視窗(全螢幕除外)',
  'pv.last': '(最後一張)',
  'pv.steps': ' · 逐步 {a}/{b}',
  'pv.notViewing': ' · <em>主畫面未放大</em>',
  'pv.noNotes': '這張沒有備註',
  'scaffold.usage': '用法:node scripts/new-deck.mjs <資料夾> [--title "標題"] [--deck-lang zh-Hant|en]\n例:node scripts/new-deck.mjs content/02-工作報告/2026-11-Q4週報',
  'scaffold.notEmpty': '{dir} 已經有檔案了,為了不覆蓋你的內容,請換一個新資料夾。',
  'scaffold.done': '已建立簡報骨架:{dir}',
  'scaffold.next': '下一步:打開各章節的 MD 檔改寫內容,規則見「製作專案指南.md」;改完再跑一次 node scripts/check.mjs 檢查。',
  'scaffold.subtitle': '副標題:一句話說明這份簡報',
  'scaffold.end': '謝謝聆聽',
  'scaffold.sec1Folder': '01-開場',
  'scaffold.sec1Title': '開場',
  'scaffold.sec2Folder': '02-重點',
  'scaffold.sec2Title': '重點',
  'scaffold.sec3Folder': '03-結論',
  'scaffold.sec3Title': '結論',
  'scaffold.slide1File': '01-大綱.md',
  'scaffold.slide1': '<!-- layout: agenda -->\n# 今天的內容',
  'scaffold.slide2File': '01-第一個重點.md',
  'scaffold.slide2': '# 第一個重點\n\n- 一張投影片只講一件事\n- 每點不超過一行\n\nNote:\n這裡寫講者備註,只會出現在講者視窗(按 S)。',
  'scaffold.slide3File': '02-關鍵數字.md',
  'scaffold.slide3': '## 3 倍\n\n用一個數字讓觀眾記住重點\n\n資料來源:請填寫出處與日期',
  'scaffold.slide4File': '01-總結.md',
  'scaffold.slide4': '# 帶走三件事\n\n1. 第一件\n2. 第二件\n3. 第三件',
  'player.read': '閱讀',
  'player.readTitle': '閱讀模式:整份往下捲,附講者備註(M)',
  'player.inkTitle': '畫筆與雷射筆(D)',
  'ink.bar': '畫筆工具',
  'ink.laser': '雷射筆',
  'ink.pen': '畫筆',
  'ink.highlight': '螢光筆',
  'ink.eraser': '橡皮擦',
  'ink.color': '換畫筆顏色',
  'ink.undo': '復原',
  'ink.undoTitle': '復原(Ctrl+Z)',
  'ink.clear': '清除',
  'ink.clearTitle': '清除這張的畫(X)',
  'ink.offTitle': '關閉畫筆(Esc)',
  'lightbox.label': '放大的圖片',
  'lightbox.hint': '點一下或按 Esc 關閉',
  'reader.label': '閱讀模式',
  'reader.close': '‹ 回到投影片',
  'reader.closeTitle': '回到投影片(M 或 Esc)',
  'reader.print': '列印講義',
  'reader.printTitle': '印成附講者備註的講義(P)',
  'key.ink': '畫筆與雷射筆',
  'key.read': '閱讀模式(附備註)',
  'pv.inkNone': '不畫',
  'pv.inkHint': '在上面的投影片畫,觀眾畫面同步出現',
  'update.ready': '網站已更新到新版。',
  'update.reload': '重新整理',
  'update.later': '稍後',
  'pv.fullscreenHint': '全螢幕要在觀眾畫面按 F(或點一下觀眾畫面再按),瀏覽器不允許從講者視窗代為切換。',
  'toast.kNone': '這張沒有影片或音訊(K 用來播放 / 暫停放大投影片上的本機影片)',
  'toast.kZoom': '先按 Enter 放大投影片,K 才能播放 / 暫停上面的影片',
  'toast.kEmbed': '線上影片請直接點影片上的播放鈕,K 只控制本機影片',
  'toast.kPlay': '▶ 播放',
  'toast.kPause': '❚❚ 暫停',
  'slide.interactive': '互動頁面',
  'slide.openPage': '↗ 在新分頁開啟',
  'player.edit': '編輯',
  'player.editTitle': '編輯這張投影片的 Markdown(E)',
  'key.edit': '編輯這張的原始碼',
  'editor.label': '編輯 Markdown',
  'editor.close': '‹ 關閉',
  'editor.save': '儲存',
  'editor.revert': '還原',
  'editor.add': '+ 新增一張',
  'editor.addTitle': '在同一個章節新增一張投影片',
  'editor.archive': '封存',
  'editor.archiveTitle': '把這個檔案搬到 _封存/(不會真的刪掉)',
  'editor.ready': '可以編輯。Ctrl+S 儲存',
  'editor.readOnly': '這個模式不能存檔,可以「儲存」下載修改後的檔案',
  'editor.unsaved': '有尚未儲存的修改',
  'editor.noChange': '沒有修改',
  'editor.saving': '儲存中…',
  'editor.saved': '已儲存 {time}',
  'editor.failed': '儲存失敗:{message}',
  'editor.denied': '沒有寫入權限。請在瀏覽器的詢問視窗按「允許」',
  'editor.staleAsk': '這個檔案在你編輯期間被其他程式改過。按「確定」用你的版本覆蓋,按「取消」保留對方的修改(你的內容還在編輯框裡,可以先複製起來)。',
  'editor.staleKept': '已保留對方的修改。你的內容還在編輯框裡,請自行複製後再處理',
  'editor.downloaded': '已下載修改後的檔案',
  'editor.revertAsk': '要放棄尚未儲存的修改,回到打開時的內容嗎?',
  'editor.reverted': '已還原成打開時的內容',
  'editor.unsavedAsk': '有尚未儲存的修改,確定要離開嗎?',
  'editor.addAsk': '新投影片的標題(可留空):',
  'editor.added': '已新增 {name}',
  'editor.archiveAsk': '要把 {name} 搬到 _封存/ 嗎?檔案不會被刪掉,之後可以從資料夾裡拿回來。',
  'editor.archived': '已搬到 {path}',
  'editor.segment': '這個檔案有 {total} 張,目前顯示第 {n} 張(游標在哪就顯示哪一張)',
  'pv.editNotes': '改備註',
  'pv.saveNotes': '儲存備註',
  'pv.savingNotes': '儲存中…',
  'pv.notesSaved': '已儲存',
  'pv.notesFailed': '存檔失敗',
  'editor.autoSlide': '這是自動產生的封面 / 章節頁,沒有自己的檔案。這裡編輯的是 deck.yml(標題寫在裡面)',
  'editor.yamlNote': '這是簡報的設定檔,右邊不顯示預覽。存檔後畫面會重新載入',
  'editor.openFailed': '打不開 {path}',
  'editor.onGitHub': '↗ 在 GitHub 上編輯',
};

// ───────── app/core/locales/en.js ─────────
// English strings. Every key here must also exist in zh-Hant.js (tests/i18n.test.mjs checks this).
// {name} is a placeholder; both languages must use the same placeholders.

const LOCALE_EN = {
  // ---------- Config files (YAML) ----------
  'yaml.line': 'Line {line}: {message}',
  'yaml.tab': 'Indent with spaces, not tabs',
  'yaml.inconsistent': 'Inconsistent indentation',
  'yaml.tooDeep': 'Too much indentation',
  'yaml.notList': 'Expected "key: value" here, not a list item',
  'yaml.unknown': 'Cannot read "{text}"; expected "key: value"',
  'yaml.array': 'Inline list is missing ]',

  // ---------- Parse warnings ----------
  'lib.defaultLabel': 'Library',
  'issue.color': 'Invalid color "{value}"; using the default color',
  'issue.slideColor': 'Invalid color "{value}"; using the section color',
  'issue.readFailed': 'Could not read file',
  'issue.noSlides': 'No slides (.md files) found in this folder',
  'issue.newerSchema': 'This deck needs a newer version of the tool (mdslide: {version})',
  'issue.frontMatter': 'Front matter: {detail}',
  'issue.frontMatterParse': 'could not be parsed',
  'issue.layout': 'Unknown layout "{layout}"; using auto. Available: {list}',
  'issue.brandFont': 'brand font "{value}" contains characters that are not allowed; ignored',

  // ---------- Check ----------
  'check.noTable': 'chart layout has no table',
  'check.badCell': 'Chart row {row}, column {col}: "{text}" is not a number and will be shown as blank',
  'check.missingMedia': 'Missing media {src} (resolved path {path})',
  'check.missingBg': 'Missing background image {src}',
  'check.missingCover': 'Missing cover_image {src}',
  'check.missingLogo': 'Missing brand.logo {src}',
  'check.missingFootnote': 'Footnote [^{id}] is not defined',
  'check.deckFolder': '(deck folder)',
  'check.tooMany': '{n} slides; a 25–30 minute talk usually needs 20–30',
  'check.opening': '(opening)',
  'check.unreadable': 'Could not read: {error}',
  'check.kind.library': 'library',
  'check.kind.topic': 'topic',
  'check.kind.deck': 'single deck',
  'check.report.title': '📚 {title} (detected as: {kind})',
  'check.report.topic': '▸ Topic: {title}',
  'check.report.empty': '  (no decks yet)',
  'check.report.deck': '  ▪ {title}{date} — {sections} sections, {total} slides, {layouts} layouts, notes {noted}/{total}{noConfig}',
  'check.report.date': ' ({date})',
  'check.report.noConfig': ', no deck.yml',
  'check.report.section': '      {title}: {count} slides',
  'check.report.untitled': '(untitled)',
  'check.report.auto': '  (auto)',
  'check.report.problems': '⚠ {n} problems:',
  'check.report.ok': '✓ No problems found',
  'check.usage': 'Usage: node scripts/check.mjs <folder> [--slides] [--lang en|zh-Hant]',
  'catalog.done': 'catalog.json: {topics} topics, {decks} decks, {slides} slides',

  // ---------- Sources ----------
  'source.repoLabel': 'Built-in examples',
  'source.localLabel': 'Local folder',
  'source.noCatalog': 'catalog.json not found',

  // ---------- Auto slide text (follows the deck language) ----------
  'slide.thanks': 'Thank you',
  'slide.agenda': 'Agenda',
  'slide.noMedia': 'No media',
  'slide.missingMedia': 'Media not found',

  // ---------- Themes and stages ----------
  'theme.paper': 'Paper',
  'theme.ink': 'Ink',
  'theme.slate': 'Slate',
  'stage.pile': 'Pile',
  'stage.coverflow': 'Cover flow',
  'stage.carousel': 'Carousel',
  'stage.helix': 'Helix',
  'stage.sphere': 'Sphere',
  'stage.overview': 'Overview',
  'stage.side': 'Side by side',

  // ---------- Home and navigation ----------
  'doc.title': 'Mdslide Pile · Turn folders into moving slides',
  'nav.repo': 'Examples',
  'nav.home': 'My library',
  'nav.backHome': 'Back to home',
  'lang.label': '語言 / Language',
  'lang.zhShort': '中',
  'loading': 'Loading…',
  'loading.library': 'Reading the library…',
  'loading.deck': 'Loading the deck…',
  'err.title': 'Something went wrong',
  'err.offlineTitle': 'You are offline',
  'err.offline': 'The built-in examples and repository decks need a connection. Decks in folders on your computer or USB drive work without internet: go back home and choose a folder.',
  'err.noRecord': 'This library is no longer remembered. Please open the folder again.',
  'err.sessionGone': 'The folder you opened is no longer available (after a reload you need to choose it again).',
  'err.cannotRead': 'Cannot read this folder. It may have been moved, or the USB drive is not connected.',
  'err.noDeck': 'Deck not found. It may have been renamed or removed.',
  'err.emptyDeck': 'This deck has no slides.',
  'err.dropFolder': 'Please drop a folder, not a single file.',
  'drop.hint': 'Drop to open this folder',
  'home.eyebrow': 'Turn folders into moving slides',
  'home.title': 'The website is the console,<br>your folder is the game.',
  'home.lead': 'Your slides stay on your computer or USB drive; this site only plays them. Nothing to install, nothing to upload.',
  'home.open': 'Open a local folder',
  'home.repo': 'See the examples',
  'home.tipPicker': 'You can also drag a folder into this window. Chrome / Edge remember the libraries you open.',
  'home.tipNoPicker': 'You can also drag a folder into this window. This browser cannot remember folders, so you need to choose again after a reload; Chrome or Edge work best.',
  'home.recent': 'Recent libraries',
  'home.forget': 'Remove from list (files are not deleted)',
  'home.step1.title': 'Prepare a folder',
  'home.step1.text': 'One folder per deck, subfolders are sections, and each .md file is a slide.',
  'home.step2.title': 'Open it',
  'home.step2.text': 'Open a whole library, a topic, or a single deck folder; the level is detected automatically.',
  'home.step3.title': 'Present',
  'home.step3.text': 'Enter to zoom, arrow keys to advance, S for presenter view, P to save as PDF.',
  'home.rules': 'Rules: ',
  'home.guideName': 'GUIDE.en.md',
  'home.guidePath': 'docs/GUIDE.en.md',
  'perm.title': 'Reconnect "{name}"',
  'perm.text': 'To protect your files, the browser asks for read permission again each time.<br>If it is on a USB drive, make sure it is connected.',
  'perm.grant': 'Allow access',

  // ---------- Library page ----------
  'lib.repo': 'Built-in library',
  'lib.local': 'Local library',
  'lib.eyebrow': '{kind} · {topics} topics · {decks} decks',
  'lib.search': 'Search titles and tags…',
  'lib.noResults': 'No decks match “{q}”',
  'lib.check': '✓ Check',
  'lib.checkTitle': 'Check every deck against the rules',
  'lib.refresh': '↻ Refresh',
  'lib.refreshTitle': 'Read the folder again',
  'lib.all': 'All',
  'lib.issues': '⚠ {n} config problems',
  'lib.empty': 'No decks in this topic yet',
  'lib.chapters': '{n} sections',

  // ---------- Check panel ----------
  'checkp.aria': 'Check results',
  'checkp.title': 'Check',
  'checkp.close': 'Close (Esc)',
  'checkp.progress': 'Checking ({i}/{n}): {title}',
  'checkp.finishing': 'Summarizing…',
  'checkp.failed': 'Check failed: {error}',
  'checkp.problems': '⚠ {n} problems',
  'checkp.summary': '{decks} decks · {slides} slides',
  'checkp.problemsHeading': 'Problems',
  'checkp.decksHeading': 'Decks',
  'checkp.sections': '{n} sections',
  'checkp.slides': '{n} slides',
  'checkp.layouts': '{n} layouts',
  'checkp.notes': 'Notes {a}/{b}',
  'checkp.auto': 'auto',
  'checkp.noDecks': 'No decks yet',
  'checkp.foot': 'Rules: GUIDE.en.md · Use at least 4 layouts and write speaker notes for every slide. Edit your files, then press "Check" again.',

  // ---------- Player ----------
  'player.back': '‹ Library',
  'player.backTitle': 'Back to the library (Esc)',
  'player.stageTitle': 'Stage (L)',
  'player.theme': 'Theme',
  'player.themeTitle': 'Switch theme (T)',
  'player.check': 'Check',
  'player.rotate': 'Turn your phone sideways for much bigger slides.',
  'player.rotateLock': 'Full screen, landscape',
  'player.rotateOk': 'Got it',
  'player.export': 'Export',
  'player.exportTitle': 'Export as a single HTML file (plays offline)',
  'export.title': 'Export as a single HTML file',
  'export.text': 'The player, styles, slides and images go into one file. Double-click it to present offline — no internet or website needed. Online videos (YouTube etc.) still need a connection.',
  'export.measuring': 'Measuring file size…',
  'export.size': 'Estimated size: {size}',
  'export.videos': 'Include video and audio (count: {n}, about {size})',
  'export.go': 'Download',
  'export.cancel': 'Cancel',
  'export.working': 'Building the file…',
  'export.done': 'Exported ({size})',
  'export.failed': 'Export failed. Please try again.',
  'player.checkTitle': 'Check this deck',
  'player.presentTitle': 'Present (Enter)',
  'player.helpTitle': 'Shortcuts (?)',
  'player.hint': '← → slides · ↑ ↓ sections · Enter zoom · L stage · ? help',
  'player.issues': '⚠ {n} warnings',
  'player.slideLabel': 'Slide {n}: {title}',
  'player.reloaded': 'Reloaded',
  'player.reloadUnsupported': 'This source cannot be reloaded; please open the folder again',
  'help.title': 'Shortcuts',
  'help.foot': 'Click a card to select it, click again to zoom. The mouse wheel also turns slides.',
  'help.motion': 'Animation',
  'help.motionFull': 'Full',
  'help.motionReduced': 'Reduced',
  'key.prevNext': 'Previous / next slide (clickers work too)',
  'key.section': 'Previous / next section (the pile shuffles)',
  'key.enter': 'Zoom in / out',
  'key.esc': 'Zoom out, leave overview, back to library',
  'key.jump': 'Jump to section',
  'key.homeEnd': 'First / last slide',
  'key.overview': 'Overview',
  'key.side': 'Side by side (large slide + thumbnails)',
  'key.stage': 'Switch stage',
  'key.theme': 'Switch theme',
  'key.black': 'Black screen',
  'key.full': 'Full screen',
  'key.presenter': 'Open presenter view',
  'key.print': 'Print / save as PDF',
  'key.video': 'Play / pause local video on the zoomed slide',
  'key.reload': 'Reload the deck',
  'key.help': 'This help',
  'toast.theme': 'Theme: {name}',
  'toast.noPresenter': 'This browser does not support the presenter view',
  'toast.popupBlocked': 'The browser blocked the pop-up; allow it and press S again',
  'toast.printing': 'Preparing to print…',

  // ---------- Presenter view ----------
  'pv.docTitle': 'Presenter view · Mdslide Pile',
  'pv.current': 'Current',
  'pv.elapsed': 'Elapsed',
  'pv.now': 'Now',
  'pv.reset': 'Reset',
  'pv.next': 'Next',
  'pv.notes': 'Notes',
  'pv.waiting': 'Waiting for the main window… (press S there)',
  'pv.keys': '← → slides · ↑ ↓ sections · Enter zoom · B black screen (press again to return) · keys here control the main window (except full screen)',
  'pv.last': '(last slide)',
  'pv.steps': ' · step {a}/{b}',
  'pv.notViewing': ' · <em>main screen not zoomed</em>',
  'pv.noNotes': 'No notes for this slide',
  'scaffold.usage': 'Usage: node scripts/new-deck.mjs <folder> [--title "Title"] [--deck-lang zh-Hant|en]\nExample: node scripts/new-deck.mjs content/02-work/2026-11-Q4-update',
  'scaffold.notEmpty': '{dir} already has files. To avoid overwriting your work, choose a new folder.',
  'scaffold.done': 'Created a deck skeleton: {dir}',
  'scaffold.next': 'Next: edit the Markdown files in each section (rules: docs/GUIDE.en.md), then run node scripts/check.mjs again.',
  'scaffold.subtitle': 'Subtitle: this deck in one sentence',
  'scaffold.end': 'Thank you',
  'scaffold.sec1Folder': '01-Opening',
  'scaffold.sec1Title': 'Opening',
  'scaffold.sec2Folder': '02-Key-points',
  'scaffold.sec2Title': 'Key points',
  'scaffold.sec3Folder': '03-Wrap-up',
  'scaffold.sec3Title': 'Wrap-up',
  'scaffold.slide1File': '01-Agenda.md',
  'scaffold.slide1': '<!-- layout: agenda -->\n# Today',
  'scaffold.slide2File': '01-First-point.md',
  'scaffold.slide2': '# First point\n\n- One idea per slide\n- One line per bullet\n\nNote:\nSpeaker notes go here; they only appear in the presenter view (press S).',
  'scaffold.slide3File': '02-Key-number.md',
  'scaffold.slide3': '## 3x\n\nOne number the audience will remember\n\nSource: add the source and date',
  'scaffold.slide4File': '01-Summary.md',
  'scaffold.slide4': '# Three things to take away\n\n1. First\n2. Second\n3. Third',
  'player.read': 'Read',
  'player.readTitle': 'Reading view: scroll through with speaker notes (M)',
  'player.inkTitle': 'Pen and laser pointer (D)',
  'ink.bar': 'Drawing tools',
  'ink.laser': 'Laser',
  'ink.pen': 'Pen',
  'ink.highlight': 'Highlighter',
  'ink.eraser': 'Eraser',
  'ink.color': 'Change pen colour',
  'ink.undo': 'Undo',
  'ink.undoTitle': 'Undo (Ctrl+Z)',
  'ink.clear': 'Clear',
  'ink.clearTitle': 'Clear drawings on this slide (X)',
  'ink.offTitle': 'Close drawing tools (Esc)',
  'lightbox.label': 'Enlarged image',
  'lightbox.hint': 'Click or press Esc to close',
  'reader.label': 'Reading view',
  'reader.close': '‹ Back to slides',
  'reader.closeTitle': 'Back to slides (M or Esc)',
  'reader.print': 'Print handout',
  'reader.printTitle': 'Print a handout with speaker notes (P)',
  'key.ink': 'Pen and laser pointer',
  'key.read': 'Reading view (with notes)',
  'pv.inkNone': 'Off',
  'pv.inkHint': 'Draw on the slide above; it appears on the audience screen',
  'update.ready': 'A new version of the site is ready.',
  'update.reload': 'Reload',
  'update.later': 'Later',
  'pv.fullscreenHint': 'Press F on the audience window to go full screen (click it first). Browsers do not allow the presenter view to do it.',
  'toast.kNone': 'No video or audio on this slide (K plays / pauses local video on the zoomed slide)',
  'toast.kZoom': 'Press Enter to zoom in first; K then plays / pauses the video on it',
  'toast.kEmbed': 'Use the play button on online videos; K only controls local video',
  'toast.kPlay': '▶ Playing',
  'toast.kPause': '❚❚ Paused',
  'slide.interactive': 'Interactive page',
  'slide.openPage': '↗ Open in new tab',
  'player.edit': 'Edit',
  'player.editTitle': "Edit this slide's Markdown (E)",
  'key.edit': "Edit this slide's source",
  'editor.label': 'Edit Markdown',
  'editor.close': '‹ Close',
  'editor.save': 'Save',
  'editor.revert': 'Revert',
  'editor.add': '+ New slide',
  'editor.addTitle': 'Add a slide to this section',
  'editor.archive': 'Archive',
  'editor.archiveTitle': 'Move this file to _封存/ (it is not deleted)',
  'editor.ready': 'Ready to edit. Ctrl+S to save',
  'editor.readOnly': 'Saving is not available here; "Save" downloads the edited file',
  'editor.unsaved': 'Unsaved changes',
  'editor.noChange': 'No changes',
  'editor.saving': 'Saving…',
  'editor.saved': 'Saved at {time}',
  'editor.failed': 'Could not save: {message}',
  'editor.denied': 'No permission to write. Choose "Allow" in the browser prompt',
  'editor.staleAsk': 'Another program changed this file while you were editing. OK overwrites it with your version; Cancel keeps theirs (your text stays in the editor, so you can copy it first).',
  'editor.staleKept': 'Kept the other version. Your text is still in the editor - copy it before continuing',
  'editor.downloaded': 'Downloaded the edited file',
  'editor.revertAsk': 'Discard unsaved changes and go back to how the file was when you opened it?',
  'editor.reverted': 'Back to the opened version',
  'editor.unsavedAsk': 'You have unsaved changes. Leave anyway?',
  'editor.addAsk': 'Title for the new slide (can be empty):',
  'editor.added': 'Added {name}',
  'editor.archiveAsk': 'Move {name} to _封存/? The file is not deleted and you can get it back from the folder.',
  'editor.archived': 'Moved to {path}',
  'editor.segment': 'This file has {total} slides; showing number {n} (the one your cursor is in)',
  'pv.editNotes': 'Edit notes',
  'pv.saveNotes': 'Save notes',
  'pv.savingNotes': 'Saving…',
  'pv.notesSaved': 'Saved',
  'pv.notesFailed': 'Could not save',
  'editor.autoSlide': 'This is an automatic cover / section page with no file of its own. You are editing deck.yml, where its title lives',
  "editor.yamlNote": "This is the deck's config file, so there is no preview. The deck reloads after you save",
  'editor.openFailed': 'Could not open {path}',
  'editor.onGitHub': '↗ Edit on GitHub',
};

// ───────── app/core/i18n.js ─────────
// 介面語言(瀏覽器與 Node 共用)。字串表在 locales/,新增文字時兩份都要加。
//
// 兩種語言分開決定:
//   介面語言:使用者選擇 → 瀏覽器語言(zh 開頭 = 繁中,其他 = 英文)→ 繁中
//   簡報語言:deck.yml 的 lang → 標題等文字含中日韓字元 = 繁中,否則英文
// 簡報語言只影響「自動產生的投影片文字」(謝謝、大綱…)與英文字型,不受介面語言影響。



const LANGS = ['zh-Hant', 'en'];
const TABLES = { 'zh-Hant': LOCALE_ZH_HANT, en: LOCALE_EN };
let current = 'zh-Hant';

/** 把各種寫法(zh-TW、zh_hant、en-US…)整理成支援的語言代碼;不支援時回傳 null。 */
function normalizeLang(value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  if (v.startsWith('zh')) return 'zh-Hant';
  if (v.startsWith('en')) return 'en';
  return null;
}

function setLang(lang) { current = normalizeLang(lang) || 'zh-Hant'; return current; }
function getLang() { return current; }

/** 取字串。lang 省略時用目前介面語言;找不到時退回繁中,再退回鍵名本身。 */
function t(key, params, lang) {
  const table = TABLES[normalizeLang(lang) || current];
  let s = table[key] ?? TABLES['zh-Hant'][key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
  return s;
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

/** 簡報語言:明確設定優先;否則看標題、副標、資料夾與章節名稱是否含中日韓字元。 */
function detectDeckLang(explicit, ...texts) {
  return normalizeLang(explicit) || (texts.some(s => CJK.test(String(s ?? ''))) ? 'zh-Hant' : 'en');
}

// ───────── app/core/yaml.js ─────────
// 精簡 YAML 解析器:只支援設定檔需要的子集,零依賴。
//
// 支援:
//   key: value            字串、數字、布林、null、引號字串
//   巢狀物件              以縮排表示
//   - item / - key: v     清單與「物件清單」
//   [a, b, c]             行內陣列
//   key: |                多行文字(保留換行);> 會把換行併成空白
//   # 註解
// 不支援:錨點、標籤、多文件、行內物件 {}。
// 解析失敗時丟出 YamlError(含行號),呼叫端負責轉成使用者看得懂的提示。


class YamlError extends Error {
  constructor(message, line) {
    super(line ? t('yaml.line', { line, message }) : message);
    this.line = line;
  }
}

function parseYaml(text) {
  const lines = [];
  text.replace(/\r\n?/g, '\n').split('\n').forEach((raw, i) => {
    const stripped = stripComment(raw);
    if (!stripped.trim()) { lines.push({ blank: true, raw, no: i + 1 }); return; }
    if (/^\t/.test(raw)) throw new YamlError(t('yaml.tab'), i + 1);
    lines.push({ indent: stripped.match(/^ */)[0].length, text: stripped.trim(), raw, no: i + 1 });
  });
  const state = { lines, i: 0 };
  skipBlank(state);
  if (state.i >= lines.length) return {};
  const value = parseBlock(state, lines[state.i].indent);
  skipBlank(state);
  if (state.i < lines.length) throw new YamlError(t('yaml.inconsistent'), lines[state.i].no);
  return value;
}

function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).replace(/\s+$/, '');
  }
  return line.replace(/\s+$/, '');
}

function skipBlank(s) { while (s.i < s.lines.length && s.lines[s.i].blank) s.i++; }

function parseBlock(s, indent) {
  skipBlank(s);
  const first = s.lines[s.i];
  return first.text.startsWith('- ') || first.text === '-' ? parseList(s, indent) : parseMap(s, indent);
}

function parseMap(s, indent) {
  const obj = {};
  while (true) {
    skipBlank(s);
    const ln = s.lines[s.i];
    if (!ln || ln.indent < indent) break;
    if (ln.indent > indent) throw new YamlError(t('yaml.tooDeep'), ln.no);
    if (ln.text.startsWith('- ')) throw new YamlError(t('yaml.notList'), ln.no);
    const m = ln.text.match(/^("[^"]*"|'[^']*'|[^:]+?)\s*:(?:\s+(.*))?$/);
    if (!m) throw new YamlError(t('yaml.unknown', { text: ln.text }), ln.no);
    const key = unquote(m[1]);
    const rest = m[2] ?? '';
    s.i++;
    obj[key] = parseValueAfterKey(s, indent, rest, ln.no);
  }
  return obj;
}

function parseList(s, indent) {
  const arr = [];
  while (true) {
    skipBlank(s);
    const ln = s.lines[s.i];
    if (!ln || ln.indent < indent) break;
    if (ln.indent > indent) throw new YamlError(t('yaml.tooDeep'), ln.no);
    if (!(ln.text.startsWith('- ') || ln.text === '-')) break;
    const rest = ln.text === '-' ? '' : ln.text.slice(2).trim();
    if (!rest) { s.i++; skipBlank(s); arr.push(s.lines[s.i] && s.lines[s.i].indent > indent ? parseBlock(s, s.lines[s.i].indent) : null); continue; }
    // 「- key: value」才算物件;「- https://x」這種冒號後面沒有空白的不算
    if (/^("[^"]*"|'[^']*'|[^"'\[\s][^:]*?)\s*:(\s|$)/.test(rest)) {
      // 物件清單:把「- 」後面當成縮排 +2 的物件第一行
      const childIndent = ln.indent + 2;
      s.lines[s.i] = { ...ln, indent: childIndent, text: rest };
      arr.push(parseMap(s, childIndent));
    } else {
      s.i++;
      arr.push(scalar(rest, ln.no));
    }
  }
  return arr;
}

function parseValueAfterKey(s, indent, rest, no) {
  if (rest === '|' || rest === '|-' || rest === '>' || rest === '>-') return blockScalar(s, indent, rest[0] === '>');
  if (rest !== '') return scalar(rest, no);
  skipBlank(s);
  const next = s.lines[s.i];
  if (next && next.indent > indent) return parseBlock(s, next.indent);
  if (next && next.indent === indent && next.text.startsWith('- ')) return parseList(s, indent);
  return null;
}

function blockScalar(s, indent, fold) {
  const out = [];
  let base = null;
  while (s.i < s.lines.length) {
    const ln = s.lines[s.i];
    if (ln.blank) { out.push(''); s.i++; continue; }
    if (ln.indent <= indent) break;
    if (base == null) base = ln.indent;
    out.push(ln.raw.slice(base));
    s.i++;
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return fold ? out.join('\n').replace(/([^\n])\n(?!\n)/g, '$1 ') : out.join('\n');
}

function unquote(v) {
  v = v.trim();
  if (v.length >= 2 && v[0] === '"' && v.at(-1) === '"') return v.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
  if (v.length >= 2 && v[0] === "'" && v.at(-1) === "'") return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

function scalar(v, no) {
  v = v.trim();
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) throw new YamlError(t('yaml.array'), no);
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner).map(x => scalar(x, no));
  }
  if (/^["']/.test(v)) return unquote(v);
  if (/^(true|yes|on)$/i.test(v)) return true;
  if (/^(false|no|off)$/i.test(v)) return false;
  if (/^(null|~)$/i.test(v)) return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function splitTopLevel(s) {
  const out = []; let cur = '', q = null, depth = 0;
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '[') depth++;
    if (c === ']') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ───────── app/core/names.js ─────────
// 檔名與路徑的共用規則。瀏覽器與 Node 腳本都會用到,請保持零依賴。

/** 以 `/` 串接路徑片段,忽略空字串。 */
function join(...parts) {
  return parts.filter(p => p !== '' && p != null).join('/').replace(/\/+/g, '/');
}

/** 取得副檔名(小寫、不含點)。 */
function ext(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** 底線或點開頭 = 草稿或系統檔,解析時略過(設定檔另外處理)。 */
function isHidden(name) {
  return name.startsWith('.') || name.startsWith('_');
}

/** 保留名稱:這些資料夾只放素材,不會被當成章節。 */
const RESERVED_DIRS = new Set(['media', 'assets', 'images', 'img', 'video', 'videos', 'node_modules']);

/** 不當成投影片的 MD 檔(說明文件)。 */
function isDocFile(name) {
  return /^(readme|agents|claude|license|changelog)(\..*)?$/i.test(name);
}

function isMarkdown(name) {
  return ext(name) === 'md' && !isHidden(name) && !isDocFile(name);
}

/**
 * 拆出排序前綴:`01-問題` → { order: 1, label: '問題' }。
 * 沒有前綴時 order 為 null,label 為原名(去掉副檔名)。
 */
function splitOrder(name) {
  const base = name.replace(/\.(md|ya?ml)$/i, '');
  // 日期前綴 `2026-11-筆記`、`2026-11-20 讀書會`:不是排序數字,而是日期
  const d = base.match(/^(\d{4}-\d{2}(?:-\d{2})?)[\s._-]+(.+)$/);
  if (d) return { order: null, date: d[1], label: d[2].trim() };
  const m = base.match(/^(\d+)[\s._-]+(.+)$/);
  return m ? { order: Number(m[1]), label: m[2].trim() } : { order: null, label: base };
}

/** 依前綴數字排序,沒有前綴的依名稱排在後面。 */
function byOrder(a, b) {
  const A = splitOrder(a.name), B = splitOrder(b.name);
  if (A.order != null && B.order != null && A.order !== B.order) return A.order - B.order;
  if (A.order != null && B.order == null) return -1;
  if (A.order == null && B.order != null) return 1;
  return a.name.localeCompare(b.name, 'zh-Hant', { numeric: true });
}

/** 連結是否為外部網址。 */
function isURL(s) {
  return /^(https?:)?\/\//i.test(s) || /^data:/i.test(s);
}

// ───────── app/core/media.js ─────────
// 判斷媒體類型:本機圖片 / 本機影片 / 線上嵌入(YouTube、Bilibili、Google Drive、Vimeo)/
// 互動網頁(GitHub Pages、CodePen、簡報資料夾裡的 .html 檔)。


const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp']);
const VIDEO = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv']);
const AUDIO = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);
const PAGE = new Set(['html', 'htm']);

/**
 * @returns {{ kind: 'image'|'video'|'audio'|'embed'|'page'|'unknown', src: string, provider?: string, embed?: string, thumb?: string, interactive?: boolean, remote: boolean }}
 */
function classifyMedia(src) {
  const s = src.trim();
  const remote = isURL(s);
  if (remote) {
    let m;
    if ((m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/))) {
      const t = s.match(/[?&](?:t|start)=(\d+)/);
      return { kind: 'embed', src: s, remote, provider: 'YouTube',
        embed: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&playsinline=1${t ? `&start=${t[1]}` : ''}`,
        thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
    }
    if ((m = s.match(/bilibili\.com\/video\/(BV[\w]+|av\d+)/i)) || (m = s.match(/b23\.tv\/(BV[\w]+)/i))) {
      const id = m[1];
      const q = id.startsWith('av') ? `aid=${id.slice(2)}` : `bvid=${id}`;
      const p = s.match(/[?&]p=(\d+)/);
      return { kind: 'embed', src: s, remote, provider: 'Bilibili',
        embed: `https://player.bilibili.com/player.html?${q}&page=${p ? p[1] : 1}&autoplay=0&high_quality=1` };
    }
    if ((m = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/))) {
      return { kind: 'embed', src: s, remote, provider: 'Google Drive', embed: `https://drive.google.com/file/d/${m[1]}/preview` };
    }
    if ((m = s.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
      return { kind: 'embed', src: s, remote, provider: 'Vimeo', embed: `https://player.vimeo.com/video/${m[1]}` };
    }
    // 互動網頁:CodePen 的作品(顯示執行結果)、GitHub Pages 上的網頁
    if ((m = s.match(/^https:\/\/codepen\.io\/([\w-]+)\/(?:pen|full|details|embed)\/([\w-]+)/i))) {
      return { kind: 'embed', src: s, remote, provider: 'CodePen', interactive: true,
        embed: `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result&editable=false` };
    }
    const path = s.split(/[?#]/)[0];
    if (/^https:\/\/[\w-]+\.github\.io(\/|$)/i.test(s) && !IMAGE.has(ext(path)) && !VIDEO.has(ext(path)) && !AUDIO.has(ext(path))) {
      return { kind: 'embed', src: s, remote, provider: 'GitHub Pages', interactive: true, embed: s };
    }
  }
  const e = ext(s.split(/[?#]/)[0]);
  if (!remote && PAGE.has(e)) return { kind: 'page', src: s, remote, provider: 'HTML', interactive: true };
  if (IMAGE.has(e)) return { kind: 'image', src: s, remote };
  if (VIDEO.has(e)) return { kind: 'video', src: s, remote };
  if (AUDIO.has(e)) return { kind: 'audio', src: s, remote };
  if (/^data:image\//.test(s)) return { kind: 'image', src: s, remote: true };
  return { kind: remote ? 'image' : 'unknown', src: s, remote };
}

/**
 * 素材路徑規則:
 *   media/a.jpg   → 相對於「簡報資料夾」(建議寫法,任何章節都通用)
 *   ./a.jpg       → 相對於這個 MD 檔所在的資料夾
 *   ../x/a.jpg    → 同上,可往上
 *   /a.jpg        → 相對於簡報資料夾
 */
function resolveMediaPath(src, { projectPath, filePath }) {
  if (isURL(src)) return src;
  const parts = [];
  let rel = src;
  if (rel.startsWith('./') || rel.startsWith('../')) {
    parts.push(...filePath.split('/').slice(0, -1));
  } else {
    parts.push(...projectPath.split('/').filter(Boolean));
    rel = rel.replace(/^\/+/, '');
  }
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return parts.join('/');
}

// ───────── app/core/color.js ─────────
// 顏色值白名單。設定檔與投影片裡的顏色會直接放進 style 屬性,
// 只接受下列格式,避免 `red;background:url(...)` 這類內容注入樣式。
//   #rgb  #rrggbb  #rrggbbaa   rgb()/rgba()/hsl()/hsla()(只含數字)   英文顏色名稱(red、teal…)

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC = /^(?:rgb|rgba|hsl|hsla)\(\s*[\d.\s,/%+-]+(?:deg)?[\d.\s,/%+-]*\)$/i;
const NAMED = /^[a-z]{3,24}$/i;

/** 合法就回傳整理過的顏色字串,否則回傳 null。 */
function safeColor(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v || v.length > 64) return null;
  return HEX.test(v) || FUNC.test(v) || NAMED.test(v) ? v : null;
}

// ───────── app/core/slide.js ─────────
// 把一個 MD 檔解析成一張或多張投影片的資料(還不是 HTML)。





/** 所有支援的版型。新增版型時,記得同步更新 製作專案指南.md 與 app/player/render.js。 */
const LAYOUTS = ['auto', 'text', 'center', 'split', 'split-left', 'full', 'quote', 'number', 'stats', 'timeline', 'columns', 'agenda', 'chart', 'title', 'section', 'end'];

const MEDIA_LINE = /^\s*!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)\s*$/;
const NOTE_LINE = /^\s*(?:note|notes|備註|講者備註)\s*[:：]\s*(.*)$/i; // i18n-ok:語法關鍵字,不是介面文字
const META_LINE = /^\s*<!--\s*([\w-]+)\s*:\s*(.*?)\s*-->\s*$/;

/**
 * @param {string} text 檔案內容
 * @param {{ path: string }} info
 * @returns {{ slides: object[], issues: {path:string, message:string}[] }}
 */
function parseSlideFile(text, { path }) {
  const issues = [];
  let src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  let fileMeta = {};

  // 檔案開頭的 front matter
  const fm = src.match(/^---\n([\s\S]*?)\n---[ \t]*(\n|$)/);
  if (fm) {
    try { fileMeta = parseYaml(fm[1]) || {}; }
    catch (e) { issues.push({ path, message: t('issue.frontMatter', { detail: e instanceof YamlError ? e.message : t('issue.frontMatterParse') }) }); }
    src = src.slice(fm[0].length);
  }

  const segments = splitSegments(src);
  const slides = [];
  segments.forEach((seg, index) => {
    if (!seg.trim() && segments.length > 1) return;
    slides.push(parseSegment(seg, { path, index, fileMeta, issues }));
  });
  if (!slides.length) slides.push(parseSegment('', { path, index: 0, fileMeta, issues }));
  return { slides, issues };
}

/** 依單獨一行的 `---` 切開(程式碼區塊裡的不算)。 */
function splitSegments(src) {
  const out = [[]];
  let fence = null;
  for (const line of src.split('\n')) {
    const f = line.match(/^\s*(```+|~~~+)/);
    if (f) fence = fence ? (line.trim().startsWith(fence) ? null : fence) : f[1];
    if (!fence && /^---\s*$/.test(line)) { out.push([]); continue; }
    out.at(-1).push(line);
  }
  return out.map(l => l.join('\n'));
}

function parseSegment(seg, { path, index, fileMeta, issues }) {
  const meta = { ...fileMeta };
  let lines = seg.split('\n');

  // 段落開頭的 <!-- key: value --> 設定(只影響這一張)
  while (lines.length && (lines[0].trim() === '' || META_LINE.test(lines[0]))) {
    const m = lines[0].match(META_LINE);
    if (m) meta[m[1]] = coerce(m[2]);
    lines.shift();
  }

  // 講者備註
  let notes = '';
  const n = lines.findIndex(l => NOTE_LINE.test(l));
  if (n >= 0) {
    const first = lines[n].match(NOTE_LINE)[1];
    notes = [first, ...lines.slice(n + 1)].join('\n').trim();
    lines = lines.slice(0, n);
  }

  // 單獨一行的圖片 / 影片 = 這張投影片的主要媒體
  const media = [];
  let fence = false;
  const bodyLines = [];
  for (const l of lines) {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    const m = !fence && l.match(MEDIA_LINE);
    if (m) media.push({ alt: m[1], caption: m[3] || m[1], ...classifyMedia(m[2]) });
    else bodyLines.push(l);
  }
  const body = bodyLines.join('\n').replace(/^\n+|\n+$/g, '');

  if (meta.color != null && !safeColor(meta.color)) {
    issues.push({ path, message: t('issue.slideColor', { value: meta.color }) });
    delete meta.color;
  }

  let layout = String(meta.layout || 'auto').toLowerCase();
  if (!LAYOUTS.includes(layout)) {
    issues.push({ path, message: t('issue.layout', { layout, list: LAYOUTS.join(', ') }) });
    layout = 'auto';
  }
  if (layout === 'auto') layout = autoLayout(body, media);

  const heading = body.match(/^#{1,3}\s+(.+)$/m);
  const firstLine = body.split('\n').find(l => l.trim())?.replace(/^\s*(>|[-*+]|\d+[.)])\s*/, '').replace(/[*_`~=#]/g, '').trim() || '';
  const title = String(meta.title || (heading ? heading[1].replace(/[*_`~=]/g, '').trim() : (media[0]?.caption || firstLine.slice(0, 40))));

  return { file: path, index, meta, layout, body, notes, media, title };
}

function autoLayout(body, media) {
  const text = body.trim();
  if (media.length && !text) return 'full';
  if (media.length) return 'split';
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length && lines.every(l => /^\s*>/.test(l) || /^\s*(—|--|──)/.test(l))) return 'quote';
  const big = lines[0]?.match(/^##\s+(.+)$/);
  if (big && big[1].length <= 14 && lines.length <= 3) return 'number';
  return 'text';
}

function coerce(v) {
  if (/^(true|false)$/i.test(v)) return /^true$/i.test(v);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v.replace(/^["']|["']$/g, '');
}

// ───────── app/core/library.js ─────────
// 書庫掃描:把「資料來源」轉成 書庫 → 主題 → 專案(簡報)→ 章節 → 投影片。
//
// 讀取分三層,只在需要時往下讀(本機資料可能在隨身碟上,越少讀越好):
//   1. scanLibrary()  只讀資料夾清單 + _site.yml / _topic.yml / deck.yml   → 目錄頁
//   2. loadCover()    進入畫面範圍的專案才讀:章節數、第一張投影片        → 封面卡片
//   3. loadDeck()     點進簡報才讀全部 MD                                 → 播放器
// 圖片與影片則由播放器在「快要看到時」才向來源要網址。
//
// 資料來源(source)只需要實作:
//   list(path)     → Promise<{ name, kind: 'file'|'dir' }[]>   path '' 代表根目錄
//   readText(path) → Promise<string>
//   mediaURL(path) → Promise<string>






const SCHEMA_VERSION = 1;
const PALETTE = ['#c0674a', '#5f8a64', '#4f73a6', '#b08a3a', '#8a5fa6', '#3f8f8f', '#b0566e', '#6b7a8f'];

const CONFIG = { site: '_site.yml', topic: '_topic.yml', deck: 'deck.yml' };

/** 同時最多幾個讀取,避免隨身碟或網路被塞爆。 */
function limiter(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= n || !queue.length) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  };
  return fn => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}
const limit = limiter(6);

async function listSafe(source, path) {
  try { return await source.list(path); } catch { return []; }
}

async function readYaml(source, path, issues) {
  let text;
  try { text = await limit(() => source.readText(path)); } catch { return null; }
  try { return parseYaml(text) || {}; }
  catch (e) {
    issues.push({ path, message: e instanceof YamlError ? e.message : String(e.message || e) });
    return {};
  }
}

const has = (entries, name, kind = 'file') => entries.some(e => e.name === name && e.kind === kind);
const dirs = entries => entries.filter(e => e.kind === 'dir' && !isHidden(e.name) && !RESERVED_DIRS.has(e.name.toLowerCase())).sort(byOrder);
const mds = entries => entries.filter(e => e.kind === 'file' && isMarkdown(e.name)).sort(byOrder);

/**
 * 判斷使用者開啟的資料夾是哪一層。
 * 規則(依序):deck.yml → 簡報;_topic.yml → 主題;_site.yml → 書庫;
 * 根目錄直接有 MD → 簡報;子資料夾有 deck.yml → 主題;子資料夾有 _topic.yml → 書庫;
 * 子資料夾直接有 MD → 簡報(子資料夾是章節);孫資料夾有 deck.yml → 書庫;其他 → 書庫。
 */
async function detectRootKind(source) {
  const root = await source.list('');
  if (has(root, CONFIG.deck)) return 'deck';
  if (has(root, CONFIG.topic)) return 'topic';
  if (has(root, CONFIG.site)) return 'library';
  if (mds(root).length) return 'deck';
  const children = dirs(root).slice(0, 8);
  const lists = await Promise.all(children.map(d => listSafe(source, d.name)));
  if (lists.some(l => has(l, CONFIG.deck))) return 'topic';
  if (lists.some(l => has(l, CONFIG.topic))) return 'library';
  if (lists.some(l => mds(l).length)) return 'deck';
  return 'library';
}

/** 第 1 層:目錄。只讀資料夾清單與設定檔。 */
async function scanLibrary(source) {
  const issues = [];
  const kind = await detectRootKind(source);
  const rootEntries = await source.list('');
  const label = source.label || t('lib.defaultLabel');

  if (kind === 'deck') {
    const project = await readProject(source, '', label, '_', issues);
    return finish({ kind, title: project.title, description: '', theme: project.theme, topics: [makeTopic('_', '', { name: label }, [project], 0)] });
  }
  if (kind === 'topic') {
    const conf = (await readYaml(source, CONFIG.topic, issues)) || {};
    const projects = await readProjects(source, '', rootEntries, conf, '_', issues);
    const topic = makeTopic('_', '', { name: label, ...conf, color: color(conf.color, null, CONFIG.topic, issues) }, projects, 0);
    return finish({ kind, title: topic.title, description: topic.description, theme: conf.theme, topics: [topic] });
  }

  const site = (await readYaml(source, CONFIG.site, issues)) || {};
  let topicDirs = dirs(rootEntries);
  topicDirs = applyOrder(topicDirs, site.topics);
  const topics = await Promise.all(topicDirs.map(async (d, i) => {
    const entries = await listSafe(source, d.name);
    const conf = (await readYaml(source, join(d.name, CONFIG.topic), issues)) || {};
    const projects = await readProjects(source, d.name, entries, conf, d.name, issues);
    return makeTopic(d.name, d.name, { ...conf, color: color(conf.color, null, join(d.name, CONFIG.topic), issues) }, projects, i);
  }));
  return finish({ kind, title: site.title || label, description: site.description || '', theme: site.theme, topics });

  function finish(lib) { return { ...lib, source: label, issues, scannedAt: Date.now() }; }
}

function applyOrder(list, order) {
  if (!Array.isArray(order) || !order.length) return list;
  const key = n => [n, splitOrder(n).label];
  const picked = [];
  for (const want of order.map(String)) {
    const hit = list.find(d => key(d.name).includes(want) && !picked.includes(d));
    if (hit) picked.push(hit);
  }
  return [...picked, ...list.filter(d => !picked.includes(d))];
}

function makeTopic(id, path, conf, projects, i) {
  const folder = path.split('/').pop() || conf.name || '';
  return {
    id, path,
    title: conf.name || conf.title || splitOrder(folder).label,
    description: conf.description || '',
    color: conf.color || PALETTE[i % PALETTE.length],
    projects,
  };
}

async function readProjects(source, topicPath, entries, topicConf, topicId, issues) {
  let list = dirs(entries);
  list = applyOrder(list, topicConf.order);
  const projects = await Promise.all(list.map(d => readProject(source, join(topicPath, d.name), d.name, topicId, issues)));
  if (!Array.isArray(topicConf.order)) {
    // 沒指定順序:有前綴的依前綴,其他依日期新到舊
    projects.sort((a, b) => {
      const A = splitOrder(a.folder).order, B = splitOrder(b.folder).order;
      if (A != null || B != null) return (A ?? 1e9) - (B ?? 1e9);
      return String(b.date || '').localeCompare(String(a.date || '')) || a.folder.localeCompare(b.folder, 'zh-Hant');
    });
  }
  return projects;
}

async function readProject(source, path, folder, topicId, issues) {
  const conf = (await readYaml(source, join(path, CONFIG.deck), issues)) || {};
  const label = splitOrder(folder).label;
  return {
    id: folder || '_', topicId, folder, path,
    hasConfig: Object.keys(conf).length > 0,
    title: str(conf.title) || label,
    subtitle: str(conf.subtitle),
    author: str(conf.author),
    date: conf.date != null ? String(conf.date) : (splitOrder(folder).date || ''),
    event: str(conf.event),
    tags: Array.isArray(conf.tags) ? conf.tags.map(String) : [],
    theme: str(conf.theme),
    accent: color(conf.accent, null, join(path, CONFIG.deck), issues) || safeColor(Array.isArray(conf.sections) && conf.sections[0]?.color) || '',
    coverImage: str(conf.cover_image || conf.coverImage),
    lang: detectDeckLang(conf.lang, conf.title, conf.subtitle, conf.kicker, folder, ...(Array.isArray(conf.sections) ? conf.sections.map(s => s && (s.title || s.folder)) : [])),
    brand: readBrand(conf.brand, join(path, CONFIG.deck), issues),
    config: conf,
  };
}

/** 字型名稱白名單:只允許文字、數字、空白、連字號、底線、點(不能放引號、括號、url())。 */
const FONT_NAME = /^[\p{L}\p{N} ._-]{1,60}$/u;

/** deck.yml 的 brand 欄位:logo、footer、font_display、font_body。不合法的字型名稱會回報並忽略。 */
function readBrand(b, path, issues) {
  if (!b || typeof b !== 'object') return null;
  const font = v => {
    if (v == null || v === '') return '';
    const names = String(v).split(',').map(s => s.trim()).filter(Boolean);
    if (!names.length || names.some(n => !FONT_NAME.test(n))) { issues.push({ path, message: t('issue.brandFont', { value: v }) }); return ''; }
    return names.map(n => `"${n}"`).join(', ');
  };
  return { logo: str(b.logo), footer: str(b.footer), fontDisplay: font(b.font_display), fontBody: font(b.font_body) };
}

const str = v => (v == null ? '' : String(v));

/** 設定檔裡的顏色:不合法就回報並改用預設值。 */
function color(value, fallback, path, issues) {
  if (value == null || value === '') return fallback;
  const c = safeColor(value);
  if (!c) issues.push({ path, message: t('issue.color', { value }) });
  return c || fallback;
}

/** 重新讀取一份簡報的 deck.yml(即時重新載入用)。 */
async function refreshProject(source, project) {
  return readProject(source, project.path, project.folder, project.topicId, []);
}

/** 第 2 層:封面。只列出專案資料夾,必要時讀第一張投影片。 */
async function loadCover(source, project) {
  const entries = await listSafe(source, project.path);
  const sectionDirs = dirs(entries);
  const info = { sections: sectionDirs.length || (mds(entries).length ? 1 : 0), firstSlide: null };
  if (project.hasConfig && project.config.title) return info; // 有標題就用自動產生的標題頁當封面,不必再讀
  let file = mds(entries)[0] && join(project.path, mds(entries)[0].name);
  if (!file && sectionDirs[0]) {
    const inner = await listSafe(source, join(project.path, sectionDirs[0].name));
    if (mds(inner)[0]) file = join(project.path, sectionDirs[0].name, mds(inner)[0].name);
  }
  if (file) {
    try { info.firstSlide = parseSlideFile(await limit(() => source.readText(file)), { path: file }).slides[0]; } catch { /* 封面讀不到就用預設 */ }
  }
  return info;
}

/** 第 3 層:整份簡報。 */
async function loadDeck(source, project) {
  const issues = [];
  const conf = project.config || {};
  const entries = await source.list(project.path);
  const confSections = Array.isArray(conf.sections) ? conf.sections.filter(s => s && typeof s === 'object') : [];

  // 章節順序一律依資料夾前綴;deck.yml 的 sections 只覆寫標題、顏色、隱藏等屬性
  const sectionDirs = dirs(entries);

  const sections = [];
  const rootFiles = mds(entries);
  if (rootFiles.length) sections.push({ folder: '', path: project.path, files: rootFiles.map(f => join(project.path, f.name)), intro: sectionDirs.length > 0 });
  await Promise.all(sectionDirs.map(async d => {
    const path = join(project.path, d.name);
    const files = mds(await source.list(path)).map(f => join(path, f.name));
    sections.push({ folder: d.name, path, files });
  }));
  const orderOf = s => s.folder === '' ? -1 : sectionDirs.findIndex(d => d.name === s.folder);
  sections.sort((a, b) => orderOf(a) - orderOf(b));

  const autoCovers = conf.section_covers !== false && conf.sectionCovers !== false;
  let colorIndex = 0;
  const built = [];
  for (const s of sections) {
    const c = confSections.find(x => x.folder === s.folder || x.folder === splitOrder(s.folder).label) || {};
    if (c.hidden) continue;
    const texts = await Promise.all(s.files.map(f => limit(() => source.readText(f)).then(text => [f, text], () => [f, null])));
    const slides = [];
    for (const [f, text] of texts) {
      if (text == null) { issues.push({ path: f, message: t('issue.readFailed') }); continue; }
      const r = parseSlideFile(text, { path: f });
      issues.push(...r.issues);
      slides.push(...r.slides.filter(sl => !sl.meta.hidden));
    }
    const title = c.title || (s.folder ? splitOrder(s.folder).label : '');
    const auto = s.folder ? PALETTE[colorIndex++ % PALETTE.length] : project.accent || PALETTE[PALETTE.length - 1];
    const secColor = color(c.color, auto, join(project.path, CONFIG.deck), issues);
    const section = { id: s.folder || '_intro', folder: s.folder, path: s.path, title, subtitle: str(c.subtitle), color: secColor, slides };
    if (autoCovers && s.folder && sections.filter(x => x.folder).length > 1 && c.cover !== false) {
      slides.unshift({ file: s.path, index: -1, meta: {}, layout: 'section', body: '', notes: str(c.notes), media: [], title, auto: true });
    }
    if (slides.length) built.push(section);
  }

  // 自動標題頁與結尾頁
  if (conf.cover !== false && conf.cover !== 'none') {
    // 標題頁放在第一個章節的最前面,不另外成一疊
    const titleSlide = { file: project.path, index: -1, meta: {}, layout: 'title', body: '', notes: str(conf.cover_notes), media: [], title: project.title, auto: true };
    if (built[0]) built[0].slides.unshift(titleSlide);
  }
  if (conf.end) {
    const last = built.at(-1);
    if (last) last.slides.push({ file: project.path, index: -1, meta: {}, layout: 'end', body: '', notes: str(conf.end_notes), media: [], title: String(conf.end), auto: true });
  }

  if (!built.some(s => s.slides.some(sl => !sl.auto))) issues.push({ path: project.path, message: t('issue.noSlides') });
  if (conf.mdslide && Number(conf.mdslide) > SCHEMA_VERSION) issues.push({ path: join(project.path, CONFIG.deck), message: t('issue.newerSchema', { version: conf.mdslide }) });

  const layout = typeof conf.layout === 'object' && conf.layout ? conf.layout : { stage: conf.layout };
  return {
    ...project,
    sections: built,
    stage: str(layout.stage || layout.default || 'pile'),
    transition: str(layout.transition || 'shuffle'),
    issues,
  };
}

/** 給播放器用:把所有章節攤平成一個陣列,並標上章節索引。 */
function flatten(deck) {
  const out = [];
  deck.sections.forEach((sec, si) => sec.slides.forEach((s, i) => out.push({ ...s, sec: si, i, count: sec.slides.length })));
  return out;
}

// ───────── app/core/chart.js ─────────
// 圖表資料解析與座標軸級距。render.js(畫圖)與 check.js(檢查)共用,純函式、零依賴。

/**
 * 把表格裡的一格轉成數字。支援千分位、全形負號(−)、%、單位後綴(點、億、張…)與常見貨幣前綴。
 * 無法解析(空白、N/A、—、文字)時回傳 null。
 */
const MISSING = /^(n\/?a|na|null|none|—|–|-|－|無|缺)$/i; // i18n-ok:缺值的寫法

function parseNumber(cell) {
  let s = String(cell ?? '').trim();
  if (!s || MISSING.test(s)) return null;
  s = s.replace(/^(NT\$|US\$|HK\$|NTD|USD|\$|¥|€|£)\s*/i, '');
  const m = s.match(/^([+\-−–－]?)\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*([^\d].*)?$/);
  if (!m) return null;
  const n = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return m[1] && m[1] !== '+' ? -n : n;
}

/**
 * 從投影片內文取出第一個表格。第一欄是標籤,其餘欄是數列。
 * @returns {null | { labels: string[], series: { name: string, values: (number|null)[] }[], before: string, after: string, bad: { row: number, col: number, text: string }[] }}
 */
function parseChartTable(body) {
  const lines = String(body).split('\n');
  const start = lines.findIndex((l, k) => l.includes('|') && /^\s*\|?\s*:?-{2,}/.test(lines[k + 1] || ''));
  if (start < 0) return null;
  let end = start + 2;
  while (end < lines.length && lines[end].includes('|') && lines[end].trim()) end++;
  const row = l => l.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
  const header = row(lines[start]);
  const rows = lines.slice(start + 2, end).map(row);
  const bad = [];
  const series = header.slice(1).map((name, k) => ({
    name,
    values: rows.map((r, ri) => {
      const v = parseNumber(r[k + 1]);
      if (v == null && String(r[k + 1] ?? '').trim() && !MISSING.test(String(r[k + 1]).trim())) bad.push({ row: ri + 1, col: k + 2, text: String(r[k + 1]) });
      return v;
    }),
  }));
  return { labels: rows.map(r => r[0] ?? ''), series, before: lines.slice(0, start).join('\n'), after: lines.slice(end).join('\n'), bad };
}

/**
 * 座標軸範圍:一定包含 0,級距為 1/2/5×10ⁿ,選「不超過 6 格」中最細的級距。
 * @returns {{ lo: number, hi: number, step: number, ticks: number[] }}
 */
function niceScale(min, max) {
  let lo = Math.min(0, min), hi = Math.max(0, max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (lo === hi) hi = lo + 1;
  const range = hi - lo;
  let step = 1;
  for (let e = Math.floor(Math.log10(range / 6)) - 1; ; e++) {
    const hit = [1, 2, 5].map(m => m * 10 ** e).find(s => Math.ceil(hi / s - 1e-9) - Math.floor(lo / s + 1e-9) <= 6);
    if (hit) { step = hit; break; }
  }
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const ticks = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(Number(v.toFixed(decimals)));
  return { lo: ticks[0], hi: ticks.at(-1), step, ticks };
}

// ───────── app/core/highlight.js ─────────
// 程式碼上色:精簡的 tokenizer,支援 js / ts / python / json / bash / sql。
// 輸出一律先跳脫 HTML,只加上 <span class="tk-…">;不認得的語言就原樣跳脫輸出。

const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const KEYWORDS = {
  js: 'await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield async',
  python: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield print self',
  bash: 'if then else elif fi for while do done case esac in function return export local echo cd exit set unset source sudo',
  sql: 'select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order having limit offset as distinct null is in like between union all case when then else end primary key',
  json: 'true false null',
};
KEYWORDS.ts = KEYWORDS.js + ' interface type enum implements private public protected readonly declare namespace keyof any number string boolean void never unknown';

const ALIASES = { javascript: 'js', mjs: 'js', jsx: 'js', typescript: 'ts', tsx: 'ts', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', postgres: 'sql', mysql: 'sql' };

const COMMENT = {
  js: String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`, ts: String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`,
  python: '#[^\\n]*', bash: '#[^\\n]*', sql: '--[^\\n]*', json: null,
};
const STRING = {
  js: String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\x60(?:\\.|[^\x60\\])*\x60`,
  python: String.raw`"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'`,
  bash: String.raw`"(?:\\.|[^"\\])*"|'[^']*'`,
  sql: String.raw`'(?:''|[^'])*'`,
  json: String.raw`"(?:\\.|[^"\\\n])*"`,
};
STRING.ts = STRING.js;

const cache = new Map();
function tokenizer(lang) {
  if (cache.has(lang)) return cache.get(lang);
  const parts = [];
  if (COMMENT[lang]) parts.push(`(?<c>${COMMENT[lang]})`);
  parts.push(`(?<s>${STRING[lang]})`);
  parts.push(String.raw`(?<n>\b\d+(?:\.\d+)?\b)`);
  parts.push(String.raw`(?<w>[A-Za-z_$][\w$]*)`);
  const re = new RegExp(parts.join('|'), 'g');
  const kw = new Set(KEYWORDS[lang].split(' '));
  const t = { re, kw, ci: lang === 'sql' };
  cache.set(lang, t);
  return t;
}

/** 回傳上色後(已跳脫)的 HTML。lang 不支援時回傳單純跳脫的文字。 */
function highlight(code, lang) {
  const key = ALIASES[String(lang || '').toLowerCase()] || String(lang || '').toLowerCase();
  if (!KEYWORDS[key]) return esc(code);
  const { re, kw, ci } = tokenizer(key);
  let out = '', last = 0;
  re.lastIndex = 0;
  for (let m; (m = re.exec(code));) {
    out += esc(code.slice(last, m.index));
    const g = m.groups;
    if (g.c) out += `<span class="tk-c">${esc(g.c)}</span>`;
    else if (g.s) out += `<span class="tk-s">${esc(g.s)}</span>`;
    else if (g.n) out += `<span class="tk-n">${g.n}</span>`;
    else if (g.w && kw.has(ci ? g.w.toLowerCase() : g.w)) out += `<span class="tk-k">${esc(g.w)}</span>`;
    else out += esc(m[0]);
    last = re.lastIndex;
  }
  return out + esc(code.slice(last));
}

// ───────── app/core/markdown.js ─────────
// 精簡 Markdown 轉 HTML,零依賴。只處理簡報會用到的語法,所有原始 HTML 一律跳脫(安全)。
//
// 區塊:標題、段落、清單(巢狀、有序、核取)、引言、程式碼區塊、表格、分隔線
// 行內:**粗體** *斜體* ~~刪除~~ ==螢光== `程式碼` [連結](網址) ![圖](路徑) 腳註[^1]
// 腳註定義:單獨一行 [^1]: 內容,會依引用順序編號,放在內容最後(小字)。
// 與 GitHub 不同處:段落中的單一換行會保留成換行(簡報通常是逐行排版)。


const FOOTNOTE_DEF = /^\[\^([^\]\s]+)\]:\s*(.*)$/;
const FOOTNOTE_REF = /\[\^([^\]\s]+)\](?!:)/g;

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const defaultImage = (src, alt) => `<img data-media="${escapeHTML(src)}" alt="${escapeHTML(alt)}">`;

/**
 * @param {string} src
 * @param {{ image?: (src: string, alt: string) => string }} [opts]
 */
function renderMarkdown(src, opts = {}) {
  const { body, defs } = splitFootnotes(src.replace(/\r\n?/g, '\n').split('\n'));
  const ctx = { image: opts.image || defaultImage, notes: { defs, order: [] } };
  let html = renderBlocks(body, ctx);
  if (ctx.notes.order.length) {
    html += '<div class="footnotes">' + ctx.notes.order.map((id, k) =>
      `<p class="source"><sup>${k + 1}</sup> ${inline(defs.get(id), { image: ctx.image })}</p>`).join('') + '</div>';
  }
  return html;
}

/** 把腳註定義行([^id]: 內容)抽出來;程式碼區塊裡的不算。 */
function splitFootnotes(lines) {
  const defs = new Map(), body = [];
  let fence = false;
  for (const l of lines) {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    const m = !fence && l.match(FOOTNOTE_DEF);
    if (m) defs.set(m[1], m[2]); else body.push(l);
  }
  return { body, defs };
}

/** 找出有引用但沒有定義的腳註(給檢查工具用)。 */
function undefinedFootnotes(src) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const { body, defs } = splitFootnotes(lines);
  const missing = new Set();
  let fence = false;
  for (const l of body) {
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; continue; }
    if (fence) continue;
    for (const m of l.replace(/`[^`]*`/g, '').matchAll(FOOTNOTE_REF)) if (!defs.has(m[1])) missing.add(m[1]);
  }
  return [...missing];
}

function renderInline(text, opts = {}) {
  return inline(text, { image: opts.image || defaultImage });
}

function renderBlocks(lines, ctx) {
  let html = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // 程式碼區塊
    const fence = line.match(/^\s*(```+|~~~+)\s*([\w+-]*)/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      const lang = fence[2] ? ` data-lang="${escapeHTML(fence[2])}"` : '';
      html += `<pre${lang}><code>${highlight(body.join('\n'), fence[2])}</code></pre>`; // highlight 會先跳脫 HTML
      continue;
    }

    // 標題
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) { html += `<h${h[1].length}>${inline(h[2], ctx)}</h${h[1].length}>`; i++; continue; }

    // 分隔線
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { html += '<hr>'; i++; continue; }

    // 引言
    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      html += `<blockquote>${renderBlocks(body, ctx)}</blockquote>`;
      continue;
    }

    // 表格
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = cells(line);
      const aligns = cells(lines[i + 1]).map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : '');
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      const al = k => aligns[k] ? ` style="text-align:${aligns[k]}"` : '';
      html += '<table><thead><tr>' + head.map((c, k) => `<th${al(k)}>${inline(c, ctx)}</th>`).join('') + '</tr></thead><tbody>'
        + rows.map(r => '<tr>' + head.map((_, k) => `<td${al(k)}>${inline(r[k] ?? '', ctx)}</td>`).join('') + '</tr>').join('')
        + '</tbody></table>';
      continue;
    }

    // 清單
    if (listMarker(line)) {
      const block = [];
      while (i < lines.length && (lines[i].trim() === '' ? (i + 1 < lines.length && (listMarker(lines[i + 1]) || /^\s{2,}/.test(lines[i + 1]))) : (listMarker(lines[i]) || /^\s{2,}/.test(lines[i])))) block.push(lines[i++]);
      html += renderList(block, ctx);
      continue;
    }

    // 段落
    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines, i)) para.push(lines[i++].trim());
    html += `<p>${para.map(l => inline(l, ctx)).join('<br>')}</p>`;
  }
  return html;
}

function isBlockStart(lines, i) {
  const l = lines[i];
  return /^\s*(```|~~~)/.test(l) || /^#{1,6}\s/.test(l) || /^\s*>/.test(l) || !!listMarker(l)
    || (l.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]));
}

function listMarker(line) {
  const m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
  return m ? { indent: m[1].length, ordered: /\d/.test(m[2]), start: parseInt(m[2], 10), text: m[3] } : null;
}

function renderList(block, ctx) {
  const first = listMarker(block[0]);
  const base = first.indent;
  const items = [];
  for (const l of block) {
    const m = listMarker(l);
    if (m && m.indent <= base + 1) items.push({ text: m.text, children: [] });
    else if (items.length) items.at(-1).children.push(l.slice(Math.min(base + 2, l.search(/\S|$/))));
  }
  const tag = first.ordered ? 'ol' : 'ul';
  const start = first.ordered && first.start !== 1 ? ` start="${first.start}"` : '';
  return `<${tag}${start}>` + items.map(it => {
    let text = it.text, cls = '';
    const task = text.match(/^\[([ xX])\]\s+(.*)$/);
    if (task) { cls = ` class="task${task[1] !== ' ' ? ' done' : ''}"`; text = task[2]; }
    const kids = it.children.filter(c => c.trim()).length ? renderBlocks(it.children, ctx) : '';
    return `<li${cls}>${inline(text, ctx)}${kids}</li>`;
  }).join('') + `</${tag}>`;
}

function cells(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
}

// 網址可以含一層成對括號,例如 https://en.wikipedia.org/wiki/Foo_(bar)
const URL_PART = '((?:[^()\\s<>]|\\([^()\\s<>]*\\))+)';
const IMAGE_RE = new RegExp(`!\\[([^\\]]*)\\]\\(\\s*<?${URL_PART}>?(?:\\s+"[^"]*")?\\s*\\)`, 'g');
const LINK_RE = new RegExp(`\\[((?:[^\\[\\]]|\\[[^\\]]*\\])+)\\]\\(\\s*<?${URL_PART}>?(?:\\s+"[^"]*")?\\s*\\)`, 'g');
const BARE_URL_RE = /\bhttps?:\/\/[^\s<>\u0000]+/g;
const SAFE_HREF = /^(https?:|mailto:|#|\.{0,2}\/)/i;

/** slots 由巢狀呼叫共用,連結文字裡的圖片才不會變成 undefined。 */
function inline(text, ctx, slots = []) {
  const keep = html => `\u0000${slots.push(html) - 1}\u0000`;
  let s = text;
  s = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${escapeHTML(c)}</code>`));
  if (ctx.notes) {
    s = s.replace(FOOTNOTE_REF, (_, id) => {
      if (!ctx.notes.defs.has(id)) return keep('<sup class="fn missing">?</sup>');
      let n = ctx.notes.order.indexOf(id) + 1;
      if (!n) n = ctx.notes.order.push(id);
      return keep(`<sup class="fn">${n}</sup>`);
    });
  }
  s = s.replace(IMAGE_RE, (_, alt, src) => keep(ctx.image(src, alt)));
  s = s.replace(LINK_RE, (_, label, href) => {
    const safe = SAFE_HREF.test(href) || !/^[a-z][a-z0-9+.-]*:/i.test(href);
    return keep(`<a href="${safe ? escapeHTML(href) : '#'}" target="_blank" rel="noopener">${inline(label, ctx, slots)}</a>`);
  });
  s = s.replace(BARE_URL_RE, url => keep(escapeHTML(url))); // 裸網址不做粗體、斜體處理
  s = escapeHTML(s);
  const W = '\\p{L}\\p{N}_';
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
       .replace(new RegExp(`(^|[^${W}])__(?=\\S)([\\s\\S]*?\\S)__(?![${W}])`, 'gu'), '$1<strong>$2</strong>')
       .replace(/(^|[^*])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
       .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
       .replace(/==(?=\S)([\s\S]*?\S)==/g, '<mark>$1</mark>');
  // 還原佔位(可能有多層)
  for (let i = 0; i < 5 && s.includes('\u0000'); i++) s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => slots[n]);
  return s;
}

// ───────── app/core/check.js ─────────
// 檢查書庫或單份簡報是否符合規則。網站的「檢查」按鈕、scripts/check.mjs、
// 書庫裡的單檔版 mdslide-check.mjs 都用這一份,規則只在這裡維護。
// 只使用資料來源介面(list / readText),瀏覽器與 Node 都能跑。






const MAX_SLIDES = 45;

/** 檔案是否存在:列出上一層資料夾來確認(本機來源會快取清單,不會重複讀)。 */
async function exists(source, path) {
  const i = path.lastIndexOf('/');
  try {
    const entries = await source.list(i < 0 ? '' : path.slice(0, i));
    return entries.some(e => e.name === path.slice(i + 1) && e.kind === 'file');
  } catch { return false; }
}

/**
 * 檢查一份簡報。
 * @returns {{ title, date, hasConfig, total, noted, layouts: string[], sections: {title, count}[], slides: {layout, title, notes: boolean, auto: boolean}[], problems: {path, message}[] }}
 */
async function checkDeck(source, project) {
  const deck = await loadDeck(source, project);
  const problems = [...deck.issues];
  const all = deck.sections.flatMap(s => s.slides);

  for (const sl of all) {
    if (sl.layout === 'chart') {
      const tbl = parseChartTable(sl.body);
      if (!tbl) problems.push({ path: sl.file, message: t('check.noTable') });
      else for (const b of tbl.bad) problems.push({ path: sl.file, message: t('check.badCell', b) });
    }
    for (const id of undefinedFootnotes(sl.body)) problems.push({ path: sl.file, message: t('check.missingFootnote', { id }) });
    for (const m of sl.media) {
      if (m.remote) continue;
      const path = resolveMediaPath(m.src, { projectPath: project.path, filePath: sl.file });
      if (!(await exists(source, path))) problems.push({ path: sl.file, message: t('check.missingMedia', { src: m.src, path: path || t('check.deckFolder') }) });
    }
    const bg = sl.meta?.background;
    if (bg && !/^(https?:|data:)/.test(String(bg))) {
      const path = resolveMediaPath(String(bg), { projectPath: project.path, filePath: sl.file });
      if (!(await exists(source, path))) problems.push({ path: sl.file, message: t('check.missingBg', { src: bg }) });
    }
  }
  if (project.coverImage && !(await exists(source, resolveMediaPath(project.coverImage, { projectPath: project.path, filePath: project.path + '/deck.yml' })))) {
    problems.push({ path: project.path || t('check.deckFolder'), message: t('check.missingCover', { src: project.coverImage }) });
  }
  if (project.brand?.logo && !/^(https?:|data:)/.test(project.brand.logo) && !(await exists(source, resolveMediaPath(project.brand.logo, { projectPath: project.path, filePath: project.path + '/deck.yml' })))) {
    problems.push({ path: project.path || t('check.deckFolder'), message: t('check.missingLogo', { src: project.brand.logo }) });
  }
  if (all.length > MAX_SLIDES) problems.push({ path: project.path || t('check.deckFolder'), message: t('check.tooMany', { n: all.length }) });

  return {
    title: deck.title,
    date: deck.date,
    hasConfig: project.hasConfig,
    total: all.length,
    noted: all.filter(s => s.notes).length,
    layouts: [...new Set(all.map(s => s.layout))],
    sections: deck.sections.map(s => ({ title: s.title || t('check.opening'), count: s.slides.length })),
    slides: all.map(s => ({ layout: s.layout, title: s.title, notes: !!s.notes, auto: !!s.auto })),
    problems,
  };
}

/**
 * 檢查整個資料夾(書庫、主題或單份簡報都可以)。
 * @param {(done: number, total: number, title: string) => void} [onProgress]
 */
async function checkLibrary(source, onProgress) {
  const lib = await scanLibrary(source);
  const total = lib.topics.reduce((n, tp) => n + tp.projects.length, 0);
  let done = 0;
  const topics = [];
  for (const tp of lib.topics) {
    const decks = [];
    for (const p of tp.projects) {
      onProgress?.(done, total, p.title);
      try { decks.push({ id: p.id, ...(await checkDeck(source, p)) }); }
      catch (e) { decks.push({ id: p.id, title: p.title, total: 0, noted: 0, layouts: [], sections: [], slides: [], problems: [{ path: p.path, message: t('check.unreadable', { error: e.message || e }) }] }); }
      done++;
    }
    topics.push({ id: tp.id, title: tp.title, decks });
  }
  onProgress?.(done, total, '');
  const problems = [...lib.issues, ...topics.flatMap(tp => tp.decks.flatMap(d => d.problems))];
  return { kind: lib.kind, title: lib.title, topics, problems };
}


/** 把檢查結果排成純文字報告(給命令列用)。 */
function formatReport(report, { verbose = false } = {}) {
  const out = [t('check.report.title', { title: report.title, kind: t('check.kind.' + report.kind) })];
  for (const tp of report.topics) {
    if (report.kind === 'library') out.push('', t('check.report.topic', { title: tp.title }));
    if (!tp.decks.length) out.push(t('check.report.empty'));
    for (const d of tp.decks) {
      out.push(t('check.report.deck', { title: d.title, date: d.date ? t('check.report.date', { date: d.date }) : '', sections: d.sections.length, total: d.total, layouts: d.layouts.length, noted: d.noted, noConfig: d.hasConfig === false ? t('check.report.noConfig') : '' }));
      if (!verbose) continue;
      let k = 0;
      for (const s of d.sections) {
        out.push(t('check.report.section', s));
        for (const sl of d.slides.slice(k, k + s.count)) out.push(`        - [${sl.layout}] ${sl.title || t('check.report.untitled')}${sl.notes ? '  📝' : ''}${sl.auto ? t('check.report.auto') : ''}`);
        k += s.count;
      }
    }
  }
  if (report.problems.length) {
    out.push('', t('check.report.problems', { n: report.problems.length }));
    for (const i of report.problems) out.push(`  - ${i.path}:${i.message}`);
  } else {
    out.push('', t('check.report.ok'));
  }
  return out.join('\n');
}

// ───────── scripts/node-source.mjs ─────────
// Node 版資料來源:讓建置腳本與檢查工具使用和瀏覽器完全相同的解析器(app/core)。

// 用命名空間匯入,避免打包成單檔時與 app/core 的同名函式衝突


function nodeSource(root) {
  const abs = nodePath.resolve(root);
  return {
    label: nodePath.basename(abs),
    root: abs,
    async list(path) {
      const entries = await fsp.readdir(nodePath.join(abs, path), { withFileTypes: true });
      return entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => ({ name: e.name, kind: e.isDirectory() ? 'dir' : 'file' }));
    },
    async readText(path) { return fsp.readFile(nodePath.join(abs, path), 'utf8'); },
    async mediaURL(path) { return path; },
  };
}

/**
 * 命令列的輸出語言:--lang 參數 → 環境變數(LC_ALL、LC_MESSAGES、LANG)→ 作業系統語系 → 繁中。
 * Windows 通常沒有 LANG,所以會用作業系統語系(繁中 Windows 會得到 zh-TW)。
 */
function detectNodeLang(argv = process.argv) {
  const i = argv.indexOf('--lang');
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  const eq = argv.find(a => a.startsWith('--lang='));
  if (eq) return eq.slice(7);
  for (const k of ['LC_ALL', 'LC_MESSAGES', 'LANG']) {
    const v = process.env[k];
    if (v && !/^(C|POSIX)(\.|$)/i.test(v)) return v;
  }
  try { return Intl.DateTimeFormat().resolvedOptions().locale; } catch { return 'zh-Hant'; }
}

/** 走訪整棵樹,回傳 { 路徑: 清單 }(給 catalog.json 用)。 */
async function walkTree(source, path = '', tree = {}) {
  const entries = await source.list(path);
  tree[path] = entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) if (e.kind === 'dir') await walkTree(source, path ? `${path}/${e.name}` : e.name, tree);
  return tree;
}

// ───────── 命令列 ─────────
setLang(detectNodeLang());
const __args = process.argv.slice(2);
const __dir = __args.find((a, i) => !a.startsWith('--') && __args[i - 1] !== '--lang') || __toPath(new URL('.', import.meta.url));
const __report = await checkLibrary(nodeSource(__dir));
console.log(formatReport(__report, { verbose: process.argv.includes('--slides') }));
if (__report.problems.length) process.exitCode = 1;

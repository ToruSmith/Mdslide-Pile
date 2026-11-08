// 精簡 Markdown 轉 HTML,零依賴。只處理簡報會用到的語法,所有原始 HTML 一律跳脫(安全)。
//
// 區塊:標題、段落、清單(巢狀、有序、核取)、引言、程式碼區塊、表格、分隔線
// 行內:**粗體** *斜體* ~~刪除~~ ==螢光== `程式碼` [連結](網址) ![圖](路徑)
// 與 GitHub 不同處:段落中的單一換行會保留成換行(簡報通常是逐行排版)。

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const defaultImage = (src, alt) => `<img data-media="${escapeHTML(src)}" alt="${escapeHTML(alt)}">`;

/**
 * @param {string} src
 * @param {{ image?: (src: string, alt: string) => string }} [opts]
 */
export function renderMarkdown(src, opts = {}) {
  const ctx = { image: opts.image || defaultImage };
  return renderBlocks(src.replace(/\r\n?/g, '\n').split('\n'), ctx);
}

export function renderInline(text, opts = {}) {
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
      html += `<pre${lang}><code>${escapeHTML(body.join('\n'))}</code></pre>`;
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

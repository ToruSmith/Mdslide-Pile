// 投影片資料 → HTML 字串。縮圖(thumb)與放大(full)共用同一份輸出;
// 媒體一律先輸出佔位屬性 data-media / data-embed,由 hydrate.js 在需要時才載入。

import { renderMarkdown, renderInline, escapeHTML as esc } from '../core/markdown.js';
import { resolveMediaPath, classifyMedia } from '../core/media.js';
import { PALETTE } from '../core/library.js';
import { parseChartTable, niceScale } from '../core/chart.js';
import { safeColor } from '../core/color.js';
import { t } from '../core/i18n.js';

const NOW_MARK = /\s*\((now|現在|目前)\)\s*$/; // i18n-ok:語法關鍵字

const pad = n => String(n).padStart(2, '0');

/**
 * @param {object} slide  core/slide.js 的投影片資料(已加上 sec、i)
 * @param {object} ctx    { deck, mode: 'thumb'|'full', globalIndex, total }
 */
export function renderSlide(slide, ctx) {
  const { deck } = ctx;
  const section = deck.sections[slide.sec] || { title: '', color: deck.accent || PALETTE[0] };
  const pathCtx = { projectPath: deck.path, filePath: slide.file };
  const image = (src, alt) => `<img data-media="${esc(resolveMediaPath(src, pathCtx))}" alt="${esc(alt)}">`;
  const md = s => renderMarkdown(s, { image });
  const lang = deck.lang || 'zh-Hant';
  const tl = key => t(key, null, lang); // 自動文字跟著簡報語言
  const layout = slide.layout;
  const meta = slide.meta || {};
  const c = safeColor(meta.color) || safeColor(section.color) || safeColor(deck.accent) || PALETTE[0];

  let inner = '';
  switch (layout) {
    case 'title': inner = titleSlide(deck, ctx, image); break;
    case 'section': inner = sectionSlide(slide, section, deck); break;
    case 'end': inner = /^#\s/m.test(slide.body) ? `<div class="md">${md(slide.body)}</div>` : `<h1>${esc(slide.title || tl('slide.thanks'))}</h1>${slide.body ? `<div class="md">${md(slide.body)}</div>` : ''}`; break;
    case 'split': case 'split-left':
      inner = `<div class="md">${md(slide.body)}</div>${mediaFigure(slide.media[0], ctx, pathCtx, meta, true, tl)}`; break;
    case 'full':
      inner = mediaFigure(slide.media[0], ctx, pathCtx, meta, !slide.body.trim(), tl) + (slide.body.trim() ? `<div class="overlay"><div class="md">${md(slide.body)}</div></div>` : ''); break;
    case 'stats': inner = statsSlide(slide.body, md); break;
    case 'timeline': inner = timelineSlide(slide.body, md, meta); break;
    case 'columns': inner = columnsSlide(slide.body, md); break;
    case 'agenda': inner = agendaSlide(slide, deck, md, tl); break;
    case 'chart': inner = chartSlide(slide.body, md, meta, c, slide.title); break;
    default: inner = `<div class="md">${md(slide.body)}</div>`;
  }

  const showFoot = meta.footer !== false && !['title', 'section', 'end'].includes(layout);
  const sec = section.title || '';
  const brand = deck.brand || {};
  const logo = brand.logo ? `<img class="logo" data-media="${esc(resolveMediaPath(brand.logo, { projectPath: deck.path, filePath: deck.path + '/deck.yml' }))}" alt="">` : '';
  const foot = showFoot ? `<div class="foot"><span class="foot-brand">${logo}${esc(brand.footer || sec || deck.title)}</span><span class="page">${ctx.globalIndex + 1} / ${ctx.total}</span></div>` : '';
  // 品牌字型:只接受已驗證的字型名稱(library.js),接在主題字型前面
  const fonts = (brand.fontDisplay ? `;--brand-display:${brand.fontDisplay},` : '') + (brand.fontBody ? `;--brand-body:${brand.fontBody},` : '');
  const bg = meta.background ? ` data-bg="${esc(resolveMediaPath(String(meta.background), pathCtx))}"` : '';
  inner = inner.replace(/<p>((?:資料來源|來源|資料截至|註|備考|Source|Sources|Data as of|Note)\s*[:：]?)/g, '<p class="source">$1'); // i18n-ok:語法關鍵字
  // 緊湊:字縮小約兩成、留白收窄,給資料多的投影片用。每張的設定優先,其次是 deck.yml(normal 可以取消整份的設定)
  const size = String(meta.size ?? deck.size ?? '').toLowerCase();
  const compact = size === 'compact' && !['title', 'section'].includes(layout) ? ' compact' : '';
  const extra = (layout === 'title' && deck.coverImage ? ' has-image' : '') + compact + (meta.class ? ' ' + esc(meta.class) : '');
  return `<div class="slide l-${layout}${extra}" lang="${esc(lang)}" style="--c:${esc(c)}${esc(fonts)}"${bg}>${inner}${foot}</div>`;
}

function titleSlide(deck, ctx, image) {
  const meta = [deck.author, deck.event, deck.date].filter(Boolean).map(s => `<span>${esc(s)}</span>`).join('');
  const kicker = deck.config?.kicker ? `<div class="kicker">${esc(deck.config.kicker)}</div>` : '';
  const cover = deck.coverImage ? `<figure class="media cover">${image(deck.coverImage, '')}</figure>` : '<div class="deco"><i></i><i></i><i></i></div>';
  const sub = deck.subtitle ? `<div class="sub">${renderInline(deck.subtitle)}</div>` : '';
  return `${kicker}<h1>${renderInline(deck.title)}</h1>${sub}${meta ? `<div class="meta">${meta}</div>` : ''}${cover}`;
}

function sectionSlide(slide, section, deck) {
  const n = deck.sections.indexOf(section);
  const numbered = deck.sections.filter(s => s.folder);
  const k = numbered.indexOf(section) + 1;
  return `<div class="num">${pad(k || n + 1)}</div><h1>${esc(section.title)}</h1>${section.subtitle ? `<div class="sub">${esc(section.subtitle)}</div>` : ''}`;
}

function mediaFigure(m, ctx, pathCtx, meta, showCaption = true, tl = key => t(key)) {
  if (!m) return `<figure class="media"><div class="missing">${esc(tl('slide.noMedia'))}</div></figure>`;
  const fit = meta.fit === 'contain' ? ' contain' : '';
  const cap = showCaption && m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : '';
  // 互動網頁:放大時才載入;另外提供「在新分頁開啟」
  const open = href => ctx.mode === 'full' ? href : '';
  if (m.kind === 'embed') {
    const thumb = m.thumb ? `<img data-thumb="${esc(m.thumb)}" alt="">` : ''; // 由 hydrate.js 載入,失敗時移除
    const label = m.interactive ? `<div class="page-tag">${esc(tl('slide.interactive'))}</div>` : '<div class="play"></div>';
    const link = m.interactive ? open(`<a class="open-page" href="${esc(m.src)}" target="_blank" rel="noopener">${esc(tl('slide.openPage'))}</a>`) : '';
    return `<figure class="media${m.interactive ? ' page' : ''}" data-embed="${esc(m.embed)}"${m.interactive ? ' data-interactive="1"' : ''}><div class="poster">${thumb}${label}<div class="provider">${esc(m.provider)}</div></div>${link}${ctx.mode === 'full' ? '' : cap}</figure>`;
  }
  const path = resolveMediaPath(m.src, pathCtx);
  if (m.kind === 'page') {
    const name = path.split('/').pop();
    return `<figure class="media page" data-page="${esc(path)}"><div class="poster"><div class="page-tag">${esc(tl('slide.interactive'))}</div><div class="provider">${esc(name)}</div></div>${open(`<button class="open-page" data-open-page="${esc(path)}">${esc(tl('slide.openPage'))}</button>`)}${ctx.mode === 'full' ? '' : cap}</figure>`;
  }
  if (m.kind === 'video') return `<figure class="media${fit}"><video data-media="${esc(path)}" muted playsinline loop preload="none"></video>${cap}</figure>`;
  if (m.kind === 'audio') return `<figure class="media"><div class="poster"><div class="play"></div><div class="provider">AUDIO</div></div><audio data-media="${esc(path)}" preload="none"></audio>${cap}</figure>`;
  return `<figure class="media${fit}"><img data-media="${esc(path)}" alt="${esc(m.alt)}">${cap}</figure>`;
}

/** 清單項目「**數字** 說明」→ 數字卡。清單之外的文字放在下方。 */
function statsSlide(body, md) {
  const { head, items, rest } = splitList(body);
  const n = Math.min(Math.max(items.length, 1), 4);
  const colW = (1056 - 32 * (n - 1)) / n;
  const base = [0, 120, 104, 88, 72][n];
  const parsed = items.map(item => { const m = item.match(/^\*\*(.+?)\*\*\s*(.*)$/); return { value: m ? m[1] : item, label: m ? m[2] : '' }; });
  // 依最長的數值決定字級(所有卡片同一大小),避免「−5,510 點」這類較長的數值換行或超出
  const units = v => [...v].reduce((u, ch) => u + (/[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.6), 0);
  const size = Math.floor(Math.min(base, ...parsed.map(p => (colW * 0.96) / Math.max(units(p.value), 1))));
  const stats = parsed.map(p => `<div class="stat"><b style="font-size:${size}px">${renderInline(p.value)}</b><span>${renderInline(p.label)}</span></div>`);
  return `<div class="md">${md(head)}</div><div class="stats" style="--n:${n}">${stats.join('')}</div>${rest.trim() ? `<div class="after md">${md(rest)}</div>` : ''}`;
}

/** 清單項目「**時間** 事件」;子項目變成小字說明;項目結尾加 (now) 會被標成目前位置。 */
function timelineSlide(body, md, meta) {
  const { head, items, children, rest } = splitList(body);
  const nodes = items.map((item, k) => {
    const now = NOW_MARK.test(item);
    item = item.replace(NOW_MARK, '');
    const m = item.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    const small = children[k]?.length ? `<small>${children[k].map(renderInline).join('<br>')}</small>` : '';
    return `<div class="tl-item${now ? ' now' : ''}"><b>${renderInline(m ? m[1] : '')}</b><span>${renderInline(m ? m[2] : item)}${small}</span></div>`;
  });
  return `<div class="md">${md(head)}</div><div class="tl" style="--n:${Math.max(nodes.length, 1)}">${nodes.join('')}</div>${rest.trim() ? `<div class="after md">${md(rest)}</div>` : ''}`;
}

/** 以單獨一行的 +++ 分欄;第一段若只有標題,就當成整張的標題。 */
function columnsSlide(body, md) {
  const parts = body.split(/^\+\+\+\s*$/m);
  let head = '';
  if (parts.length > 1 && /^#{1,2}\s[^\n]+$/.test(parts[0].trim())) head = parts.shift();
  else if (parts.length > 1 && !parts[0].trim()) parts.shift();
  return `<div class="md">${md(head)}</div><div class="cols" style="--n:${parts.length}">${parts.map(p => `<div class="col md">${md(p.trim())}</div>`).join('')}</div>`;
}

function agendaSlide(slide, deck, md, tl) {
  const secs = deck.sections.filter(s => s.folder);
  const head = slide.body.trim() ? md(slide.body) : `<h1>${esc(tl('slide.agenda'))}</h1>`;
  const items = secs.map((s, k) => `<div class="ag" style="--sc:${esc(safeColor(s.color) || PALETTE[0])}"><b>${pad(k + 1)}</b><span>${esc(s.title)}${s.subtitle ? `<small>${esc(s.subtitle)}</small>` : ''}</span></div>`);
  return `<div class="md">${head}</div><div class="agenda" style="--cols:${secs.length > 3 ? 2 : 1}">${items.join('')}</div>`;
}

/** 表格 → 圖表(chart: bar | hbar | line)。第一欄是標籤,其餘欄是數列;支援負值與缺值。 */
function chartSlide(body, md, meta, color, title) {
  const tbl = parseChartTable(body);
  if (!tbl) return `<div class="md">${md(body)}</div>`;
  const colors = [color, ...PALETTE.filter(p => p.toLowerCase() !== String(color).toLowerCase())];
  const type = String(meta.chart || 'bar');
  const unit = meta.unit ? String(meta.unit) : '';
  const draw = type === 'line' ? lineChart : type === 'hbar' ? hbarChart : barChart;
  const svg = draw(tbl.labels, tbl.series, colors, unit, title);
  const legend = tbl.series.length > 1 ? `<div class="legend">${tbl.series.map((s, k) => `<span><i style="background:${colors[k % colors.length]}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<div class="md">${md(tbl.before)}</div>${svg}${legend}${tbl.after.trim() ? `<div class="caption md">${md(tbl.after)}</div>` : ''}`;
}

const W = 1056, H = 440;
const fmt = (v, unit) => v == null ? '–' : `${Number.isInteger(v) ? v.toLocaleString('en-US') : Number(v.toFixed(2))}${unit}`;
const svgOpen = title => `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"><title>${esc(title || '')}</title>`;
const allValues = series => series.flatMap(s => s.values).filter(v => v != null);

function barChart(labels, series, colors, unit, title) {
  const sc = niceScale(Math.min(...allValues(series), 0), Math.max(...allValues(series), 0));
  const left = 72, bottom = 56, top = 34, plotH = H - bottom - top, plotW = W - left;
  const Y = v => top + plotH - ((v - sc.lo) / (sc.hi - sc.lo)) * plotH;
  const band = plotW / Math.max(labels.length, 1);
  const gap = 12, gw = Math.min(band * 0.7, 72 * series.length + gap * (series.length - 1)), bw = (gw - gap * (series.length - 1)) / series.length;
  let s = svgOpen(title);
  for (const v of sc.ticks) s += `<line class="grid" x1="${left}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${left - 14}" y="${Y(v) + 7}" text-anchor="end" font-size="20" opacity=".55">${esc(fmt(v, ''))}</text>`;
  labels.forEach((lab, i) => {
    const x0 = left + band * i + (band - gw) / 2;
    series.forEach((se, j) => {
      const v = se.values[i], x = x0 + j * (bw + gap);
      if (v == null) { s += `<text x="${x + bw / 2}" y="${Y(0) - 10}" text-anchor="middle" font-size="22" opacity=".6">–</text>`; return; }
      const y = Math.min(Y(v), Y(0)), h = Math.abs(Y(v) - Y(0));
      s += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="6" fill="${colors[j % colors.length]}"/>`;
      s += `<text x="${x + bw / 2}" y="${v < 0 ? Y(v) + 28 : Y(v) - 10}" text-anchor="middle" font-size="22" font-weight="700">${esc(fmt(v, unit))}</text>`;
    });
    s += `<text x="${left + band * i + band / 2}" y="${H - 16}" text-anchor="middle" font-size="22">${esc(lab)}</text>`;
  });
  return s + `<line class="axis" x1="${left}" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke-width="2"/></svg>`;
}

function hbarChart(labels, series, colors, unit, title) {
  const vals = series[0]?.values || [];
  const sc = niceScale(Math.min(...vals.filter(v => v != null), 0), Math.max(...vals.filter(v => v != null), 0));
  const left = 220, right = 110, plotW = W - left - right, rowH = Math.min(H / Math.max(labels.length, 1), 76);
  const X = v => left + ((v - sc.lo) / (sc.hi - sc.lo)) * plotW;
  let s = svgOpen(title);
  labels.forEach((lab, i) => {
    const v = vals[i], y = i * rowH + (H - rowH * labels.length) / 2, bh = rowH * 0.64, by = y + rowH * 0.18, ty = y + rowH / 2 + 8;
    s += `<text x="${left - 20}" y="${ty}" text-anchor="end" font-size="24">${esc(lab)}</text>`;
    s += `<rect x="${left}" y="${by}" width="${plotW}" height="${bh}" rx="8" fill="${colors[0]}" opacity=".12"/>`;
    if (v == null) { s += `<text x="${X(0) + 14}" y="${ty}" font-size="24" opacity=".6">–</text>`; return; }
    const x = Math.min(X(v), X(0)), w = Math.abs(X(v) - X(0));
    s += `<rect x="${x}" y="${by}" width="${w}" height="${bh}" rx="8" fill="${colors[0]}"/>`;
    s += v < 0
      ? `<text x="${X(v) - 12}" y="${ty}" text-anchor="end" font-size="24" font-weight="700">${esc(fmt(v, unit))}</text>`
      : `<text x="${X(v) + 14}" y="${ty}" font-size="24" font-weight="700">${esc(fmt(v, unit))}</text>`;
  });
  if (sc.lo < 0) s += `<line class="axis" x1="${X(0)}" x2="${X(0)}" y1="0" y2="${H}" stroke-width="2"/>`;
  return s + '</svg>';
}

function lineChart(labels, series, colors, unit, title) {
  const sc = niceScale(Math.min(...allValues(series), 0), Math.max(...allValues(series), 0));
  const left = 72, bottom = 56, top = 34, plotH = H - bottom - top, plotW = W - left - 40;
  const X = i => left + 20 + (labels.length > 1 ? (plotW * i) / (labels.length - 1) : plotW / 2);
  const Y = v => top + plotH - ((v - sc.lo) / (sc.hi - sc.lo)) * plotH;
  let s = svgOpen(title);
  for (const v of sc.ticks) s += `<line class="grid" x1="${left}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${left - 14}" y="${Y(v) + 7}" text-anchor="end" font-size="20" opacity=".55">${esc(fmt(v, ''))}</text>`;
  series.forEach((se, j) => {
    const col = colors[j % colors.length];
    // 缺值處斷開線段
    let seg = [];
    const flush = () => { if (seg.length > 1) s += `<polyline fill="none" stroke="${col}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" points="${seg.join(' ')}"/>`; seg = []; };
    se.values.forEach((v, i) => { if (v == null) flush(); else seg.push(`${X(i)},${Y(v)}`); });
    flush();
    se.values.forEach((v, i) => { if (v != null) s += `<circle cx="${X(i)}" cy="${Y(v)}" r="9" fill="${col}"/>`; });
    const li = se.values.map(v => v != null).lastIndexOf(true);
    if (li >= 0) { const lv = se.values[li]; s += `<text x="${X(li)}" y="${lv < 0 ? Y(lv) + 34 : Y(lv) - 20}" text-anchor="middle" font-size="22" font-weight="700">${esc(fmt(lv, unit))}</text>`; }
  });
  labels.forEach((lab, i) => { s += `<text x="${X(i)}" y="${H - 16}" text-anchor="middle" font-size="22">${esc(lab)}</text>`; });
  return s + `<line class="axis" x1="${left}" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke-width="2"/></svg>`;
}

/** 把內文拆成:清單前的文字、第一層清單項目(含子項目)、清單後的文字。 */
function splitList(body) {
  const lines = body.split('\n');
  const isItem = l => /^[-*+]\s+/.test(l) || /^\d+[.)]\s+/.test(l);
  const first = lines.findIndex(isItem);
  if (first < 0) return { head: body, items: [], children: [], rest: '' };
  const items = [], children = [];
  let k = first;
  for (; k < lines.length; k++) {
    const l = lines[k];
    if (isItem(l)) { items.push(l.replace(/^([-*+]|\d+[.)])\s+/, '')); children.push([]); }
    else if (/^\s+([-*+]|\d+[.)])\s+/.test(l) && items.length) children.at(-1).push(l.trim().replace(/^([-*+]|\d+[.)])\s+/, ''));
    else if (!l.trim()) continue;
    else break;
  }
  return { head: lines.slice(0, first).join('\n'), items, children, rest: lines.slice(k).join('\n') };
}

export { classifyMedia };

/**
 * 投影片內容是否超出畫面(會被切掉或壓到頁尾)。slideEl 必須已經在畫面上(可以在看不見的位置)。
 * 回傳超出的像素(以 1280×720 為準),沒有超出回傳 0。
 */
export function measureOverflow(slideEl) {
  const box = slideEl.getBoundingClientRect();
  if (!box.height) return 0;
  const k = box.height / 720; // 縮圖或預覽可能有縮放
  const foot = slideEl.querySelector(':scope > .foot');
  const limit = foot ? foot.getBoundingClientRect().top - 6 * k : box.bottom;
  let over = 0;
  for (const child of slideEl.children) {
    if (child === foot || child.matches('figure.media, .overlay')) continue;
    // 子元素本身可能被撐高,也可能內容溢出它的框(overflow: hidden 的情況)
    const r = child.getBoundingClientRect();
    const bottom = Math.max(r.bottom, r.top + child.scrollHeight * (r.height / (child.offsetHeight || r.height || 1)));
    over = Math.max(over, bottom - limit);
  }
  return over > 4 * k ? Math.round(over / k) : 0;
}

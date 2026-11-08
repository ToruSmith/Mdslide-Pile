// 投影片資料 → HTML 字串。縮圖(thumb)與放大(full)共用同一份輸出;
// 媒體一律先輸出佔位屬性 data-media / data-embed,由 hydrate.js 在需要時才載入。

import { renderMarkdown, renderInline, escapeHTML as esc } from '../core/markdown.js';
import { resolveMediaPath, classifyMedia } from '../core/media.js';
import { PALETTE } from '../core/library.js';

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
  const layout = slide.layout;
  const meta = slide.meta || {};
  const c = meta.color || section.color || deck.accent || PALETTE[0];

  let inner = '';
  switch (layout) {
    case 'title': inner = titleSlide(deck, ctx, image); break;
    case 'section': inner = sectionSlide(slide, section, deck); break;
    case 'end': inner = /^#\s/m.test(slide.body) ? `<div class="md">${md(slide.body)}</div>` : `<h1>${esc(slide.title || '謝謝')}</h1>${slide.body ? `<div class="md">${md(slide.body)}</div>` : ''}`; break;
    case 'split': case 'split-left':
      inner = `<div class="md">${md(slide.body)}</div>${mediaFigure(slide.media[0], ctx, pathCtx, meta)}`; break;
    case 'full':
      inner = mediaFigure(slide.media[0], ctx, pathCtx, meta, !slide.body.trim()) + (slide.body.trim() ? `<div class="overlay"><div class="md">${md(slide.body)}</div></div>` : ''); break;
    case 'stats': inner = statsSlide(slide.body, md); break;
    case 'timeline': inner = timelineSlide(slide.body, md, meta); break;
    case 'columns': inner = columnsSlide(slide.body, md); break;
    case 'agenda': inner = agendaSlide(slide, deck, md); break;
    case 'chart': inner = chartSlide(slide.body, md, meta, c); break;
    default: inner = `<div class="md">${md(slide.body)}</div>`;
  }

  const showFoot = meta.footer !== false && !['title', 'section', 'end'].includes(layout);
  const sec = section.title || '';
  const foot = showFoot ? `<div class="foot"><span>${esc(sec || deck.title)}</span><span class="page">${ctx.globalIndex + 1} / ${ctx.total}</span></div>` : '';
  const bg = meta.background ? ` data-bg="${esc(resolveMediaPath(String(meta.background), pathCtx))}"` : '';
  const extra = (layout === 'title' && deck.coverImage ? ' has-image' : '') + (meta.class ? ' ' + esc(meta.class) : '');
  return `<div class="slide l-${layout}${extra}" style="--c:${esc(c)}"${bg}>${inner}${foot}</div>`;
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

function mediaFigure(m, ctx, pathCtx, meta, showCaption = true) {
  if (!m) return '<figure class="media"><div class="missing">沒有媒體</div></figure>';
  const fit = meta.fit === 'contain' ? ' contain' : '';
  const cap = showCaption && m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : '';
  if (m.kind === 'embed') {
    const thumb = m.thumb ? `<img src="${esc(m.thumb)}" alt="" loading="lazy" onerror="this.remove()">` : '';
    return `<figure class="media" data-embed="${esc(m.embed)}"><div class="poster">${thumb}<div class="play"></div><div class="provider">${esc(m.provider)}</div></div>${ctx.mode === 'full' ? '' : cap}</figure>`;
  }
  const path = resolveMediaPath(m.src, pathCtx);
  if (m.kind === 'video') return `<figure class="media${fit}"><video data-media="${esc(path)}" muted playsinline loop preload="none"></video>${cap}</figure>`;
  if (m.kind === 'audio') return `<figure class="media"><div class="poster"><div class="play"></div><div class="provider">AUDIO</div></div><audio data-media="${esc(path)}" preload="none"></audio>${cap}</figure>`;
  return `<figure class="media${fit}"><img data-media="${esc(path)}" alt="${esc(m.alt)}">${cap}</figure>`;
}

/** 清單項目「**數字** 說明」→ 數字卡。清單之外的文字放在下方。 */
function statsSlide(body, md) {
  const { head, items, rest } = splitList(body);
  const stats = items.map(t => {
    const m = t.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    return `<div class="stat"><b>${renderInline(m ? m[1] : t)}</b><span>${renderInline(m ? m[2] : '')}</span></div>`;
  });
  return `<div class="md">${md(head)}</div><div class="stats" style="--n:${Math.min(Math.max(stats.length, 1), 4)}">${stats.join('')}</div>${rest.trim() ? `<div class="after md">${md(rest)}</div>` : ''}`;
}

/** 清單項目「**時間** 事件」;子項目變成小字說明;項目結尾加 (now) 會被標成目前位置。 */
function timelineSlide(body, md, meta) {
  const { head, items, children, rest } = splitList(body);
  const nodes = items.map((t, k) => {
    const now = /\s*\((now|現在|目前)\)\s*$/.test(t);
    t = t.replace(/\s*\((now|現在|目前)\)\s*$/, '');
    const m = t.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    const small = children[k]?.length ? `<small>${children[k].map(renderInline).join('<br>')}</small>` : '';
    return `<div class="tl-item${now ? ' now' : ''}"><b>${renderInline(m ? m[1] : '')}</b><span>${renderInline(m ? m[2] : t)}${small}</span></div>`;
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

function agendaSlide(slide, deck, md) {
  const secs = deck.sections.filter(s => s.folder);
  const head = slide.body.trim() ? md(slide.body) : '<h1>大綱</h1>';
  const items = secs.map((s, k) => `<div class="ag" style="--sc:${esc(s.color)}"><b>${pad(k + 1)}</b><span>${esc(s.title)}${s.subtitle ? `<small>${esc(s.subtitle)}</small>` : ''}</span></div>`);
  return `<div class="md">${head}</div><div class="agenda" style="--cols:${secs.length > 3 ? 2 : 1}">${items.join('')}</div>`;
}

/** 表格 → 長條圖(chart: bar | hbar | line)。第一欄是標籤,其餘欄是數列。 */
function chartSlide(body, md, meta, color) {
  const lines = body.split('\n');
  const start = lines.findIndex((l, k) => l.includes('|') && /^\s*\|?\s*:?-{2,}/.test(lines[k + 1] || ''));
  if (start < 0) return `<div class="md">${md(body)}</div>`;
  let end = start + 2;
  while (end < lines.length && lines[end].includes('|') && lines[end].trim()) end++;
  const row = l => l.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
  const header = row(lines[start]);
  const rows = lines.slice(start + 2, end).map(row);
  const series = header.slice(1).map((name, k) => ({ name, values: rows.map(r => parseFloat(String(r[k + 1] ?? '').replace(/[^\d.-]/g, '')) || 0) }));
  const labels = rows.map(r => r[0]);
  const before = lines.slice(0, start).join('\n'), after = lines.slice(end).join('\n');
  const colors = [color, ...PALETTE.filter(p => p.toLowerCase() !== String(color).toLowerCase())];
  const type = String(meta.chart || 'bar');
  const unit = meta.unit ? String(meta.unit) : '';
  const svg = type === 'line' ? lineChart(labels, series, colors, unit) : type === 'hbar' ? hbarChart(labels, series, colors, unit) : barChart(labels, series, colors, unit);
  const legend = series.length > 1 ? `<div class="legend">${series.map((s, k) => `<span><i style="background:${colors[k % colors.length]}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<div class="md">${md(before)}</div>${svg}${legend}${after.trim() ? `<div class="caption md">${md(after)}</div>` : ''}`;
}

const W = 1056, H = 440;
const nice = v => { const p = 10 ** Math.floor(Math.log10(v || 1)); return Math.ceil(v / p) * p; };
const fmt = (v, unit) => `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`;

function barChart(labels, series, colors, unit) {
  const max = nice(Math.max(...series.flatMap(s => s.values), 1));
  const left = 64, bottom = 56, top = 34, plotH = H - bottom - top, plotW = W - left;
  const band = plotW / labels.length, gw = Math.min(band * 0.7, 72 * series.length + 12 * (series.length - 1)), bw = (gw - 12 * (series.length - 1)) / series.length;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  for (let k = 0; k <= 4; k++) { const y = top + plotH - (plotH * k) / 4; s += `<line class="grid" x1="${left}" x2="${W}" y1="${y}" y2="${y}"/><text x="${left - 14}" y="${y + 7}" text-anchor="end" font-size="20" opacity=".55">${fmt((max * k) / 4, '')}</text>`; }
  labels.forEach((lab, i) => {
    const x0 = left + band * i + (band - gw) / 2;
    series.forEach((se, j) => {
      const v = se.values[i], h = (v / max) * plotH, x = x0 + j * (bw + 12), y = top + plotH - h;
      s += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="6" fill="${colors[j % colors.length]}"/>`;
      s += `<text x="${x + bw / 2}" y="${y - 10}" text-anchor="middle" font-size="22" font-weight="700">${esc(fmt(v, unit))}</text>`;
    });
    s += `<text x="${left + band * i + band / 2}" y="${H - 16}" text-anchor="middle" font-size="22">${esc(lab)}</text>`;
  });
  return s + `<line class="axis" x1="${left}" x2="${W}" y1="${top + plotH}" y2="${top + plotH}" stroke-width="2"/></svg>`;
}

function hbarChart(labels, series, colors, unit) {
  const max = nice(Math.max(...series[0].values, 1));
  const left = 220, plotW = W - left - 110, rowH = Math.min(H / labels.length, 76);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  labels.forEach((lab, i) => {
    const v = series[0].values[i], w = (v / max) * plotW, y = i * rowH + (H - rowH * labels.length) / 2;
    s += `<text x="${left - 20}" y="${y + rowH / 2 + 8}" text-anchor="end" font-size="24">${esc(lab)}</text>`;
    s += `<rect x="${left}" y="${y + rowH * 0.18}" width="${plotW}" height="${rowH * 0.64}" rx="8" fill="${colors[0]}" opacity=".12"/>`;
    s += `<rect x="${left}" y="${y + rowH * 0.18}" width="${w}" height="${rowH * 0.64}" rx="8" fill="${colors[0]}"/>`;
    s += `<text x="${left + w + 14}" y="${y + rowH / 2 + 8}" font-size="24" font-weight="700">${esc(fmt(v, unit))}</text>`;
  });
  return s + '</svg>';
}

function lineChart(labels, series, colors, unit) {
  const max = nice(Math.max(...series.flatMap(s => s.values), 1));
  const left = 64, bottom = 56, top = 34, plotH = H - bottom - top, plotW = W - left - 40;
  const X = i => left + 20 + (labels.length > 1 ? (plotW * i) / (labels.length - 1) : plotW / 2);
  const Y = v => top + plotH - (v / max) * plotH;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
  for (let k = 0; k <= 4; k++) { const y = top + plotH - (plotH * k) / 4; s += `<line class="grid" x1="${left}" x2="${W}" y1="${y}" y2="${y}"/><text x="${left - 14}" y="${y + 7}" text-anchor="end" font-size="20" opacity=".55">${fmt((max * k) / 4, '')}</text>`; }
  series.forEach((se, j) => {
    const col = colors[j % colors.length];
    s += `<polyline fill="none" stroke="${col}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" points="${se.values.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}"/>`;
    se.values.forEach((v, i) => { s += `<circle cx="${X(i)}" cy="${Y(v)}" r="9" fill="${col}"/>`; });
    const lv = se.values.at(-1);
    s += `<text x="${X(se.values.length - 1)}" y="${Y(lv) - 20}" text-anchor="middle" font-size="22" font-weight="700">${esc(fmt(lv, unit))}</text>`;
  });
  labels.forEach((lab, i) => { s += `<text x="${X(i)}" y="${H - 16}" text-anchor="middle" font-size="22">${esc(lab)}</text>`; });
  return s + `<line class="axis" x1="${left}" x2="${W}" y1="${top + plotH}" y2="${top + plotH}" stroke-width="2"/></svg>`;
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

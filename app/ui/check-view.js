// 「檢查」面板:顯示 app/core/check.js 的結果。目錄頁與播放器共用。

import { escapeHTML as esc } from '../core/markdown.js';

/**
 * @param {HTMLElement} host 面板要放在哪個元素裡
 * @param {(onProgress) => Promise<object>} run 回傳 checkLibrary 格式的報告
 */
export function openCheckPanel(host, run) {
  host.querySelector('.check-panel')?.remove();
  const panel = document.createElement('div');
  panel.className = 'check-panel';
  panel.innerHTML = `<div class="check-card" role="dialog" aria-label="檢查結果">
    <header><h2>檢查</h2><button class="check-close" title="關閉(Esc)">×</button></header>
    <div class="check-body"><div class="check-progress"><i></i></div><p class="check-status">讀取中…</p></div>
  </div>`;
  host.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add('on'));

  const close = () => { window.removeEventListener('keydown', onKey, true); panel.classList.remove('on'); setTimeout(() => panel.remove(), 250); };
  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } else if (!e.target.closest?.('.check-panel')) e.stopImmediatePropagation(); };
  window.addEventListener('keydown', onKey, true); // 面板開著時,按鍵不傳給播放器
  panel.addEventListener('click', e => { if (e.target === panel || e.target.closest('.check-close')) close(); });

  const body = panel.querySelector('.check-body');
  run((done, total, title) => {
    const bar = body.querySelector('.check-progress i');
    if (bar) bar.style.transform = `scaleX(${total ? done / total : 0})`;
    const st = body.querySelector('.check-status');
    if (st) st.textContent = title ? `檢查中(${done + 1}/${total}):${title}` : '整理結果…';
  }).then(report => { body.innerHTML = renderReport(report); }, err => {
    body.innerHTML = `<p class="check-bad">檢查失敗:${esc(err.message || String(err))}</p>`;
  });
  return close;
}

function renderReport(r) {
  const decks = r.topics.flatMap(t => t.decks);
  const slides = decks.reduce((n, d) => n + d.total, 0);
  const ok = !r.problems.length;
  const summary = `<div class="check-summary ${ok ? 'good' : 'bad'}">
    <b>${ok ? '✓ 沒有發現問題' : `⚠ ${r.problems.length} 個問題`}</b>
    <span>${decks.length} 份簡報 · ${slides} 張投影片</span></div>`;
  const problems = ok ? '' : `<h3>問題</h3><ul class="check-problems">${r.problems.map(p => `<li><code>${esc(p.path)}</code>${esc(p.message)}</li>`).join('')}</ul>`;
  const rows = r.topics.map(t => `
    ${r.kind === 'library' ? `<h3>${esc(t.title)}</h3>` : ''}
    ${t.decks.length ? t.decks.map(d => `
      <details class="check-deck">
        <summary>
          <span class="t">${d.problems.length ? '⚠ ' : ''}${esc(d.title)}</span>
          <span class="n">${d.sections.length} 章</span>
          <span class="n">${d.total} 張</span>
          <span class="n">${d.layouts.length} 種版型</span>
          <span class="n ${d.noted < d.total ? 'warn' : ''}">備註 ${d.noted}/${d.total}</span>
        </summary>
        <ol>${d.slides.map(s => `<li><em>${esc(s.layout)}</em>${esc(s.title || '(無標題)')}${s.notes ? ' <small>📝</small>' : ''}${s.auto ? ' <small>自動</small>' : ''}</li>`).join('')}</ol>
      </details>`).join('') : '<p class="check-empty">還沒有簡報</p>'}`).join('');
  return `${summary}${problems}<h3 class="check-h">簡報</h3>${rows}
    <p class="check-foot">規則:製作專案指南.md · 版型建議至少 4 種、每張都有講者備註。修改檔案後再按一次「檢查」即可。</p>`;
}

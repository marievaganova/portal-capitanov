// Аннотации: просмотр и удаление после обработки.

(function () {
  if (!window.Auth.requireAdmin()) return;

  const $ = (s) => document.querySelector(s);
  const state = { annotations: [], titles: new Map() };

  init();

  async function init() {
    await loadAll();
    populateContentFilter();
    $('#flt-type').addEventListener('change', applyFilters);
    $('#flt-content').addEventListener('change', applyFilters);
    applyFilters();
  }

  async function loadAll() {
    const [annRes, artRes, evRes] = await Promise.all([
      window.sb.from('annotations').select('*').order('created_at', { ascending: false }),
      window.sb.from('articles').select('id, title'),
      window.sb.from('events').select('id, title'),
    ]);
    state.annotations = annRes.data || [];
    (artRes.data || []).forEach((a) => state.titles.set('article:' + a.id, a.title));
    (evRes.data  || []).forEach((e) => state.titles.set('event:'   + e.id, e.title));
  }

  function populateContentFilter() {
    const options = [];
    state.titles.forEach((title, key) => {
      const [type, id] = key.split(':');
      const label = (type === 'article' ? 'Статья: ' : 'Мероприятие: ') + title;
      options.push(`<option value="${key}">${App.escapeHtml(label)}</option>`);
    });
    $('#flt-content').insertAdjacentHTML('beforeend', options.join(''));
  }

  function applyFilters() {
    const type    = $('#flt-type').value;
    const content = $('#flt-content').value;
    let rows = state.annotations;
    if (type) rows = rows.filter((a) => a.annotation_type === type);
    if (content) {
      const [ct, cid] = content.split(':');
      rows = rows.filter((a) => a.content_type === ct && a.content_id === cid);
    }
    renderList(rows);
  }

  function renderList(rows) {
    const tbody = $('#list-body');
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="padding: 24px; text-align: center;">Аннотаций нет.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((a) => {
      const title = state.titles.get(a.content_type + ':' + a.content_id) || '—';
      const link = a.content_type === 'article'
        ? `article.html?id=${encodeURIComponent(a.content_id)}`
        : `event.html?id=${encodeURIComponent(a.content_id)}`;
      const tg = a.author_tg ? a.author_tg.replace(/^@/, '') : '';
      return `
        <tr>
          <td class="muted" style="white-space: nowrap;">${App.formatDate(a.created_at)}</td>
          <td><span class="badge">${App.escapeHtml(App.ANNOTATION_TYPE_LABELS[a.annotation_type] || a.annotation_type)}</span></td>
          <td><a href="${link}" target="_blank" style="color: var(--color-accent);">${App.escapeHtml(title)}</a></td>
          <td>${App.escapeHtml(a.author_name || '')}${tg ? ` <span class="muted">@${App.escapeHtml(tg)}</span>` : ''}</td>
          <td style="max-width: 420px; white-space: pre-wrap;">${App.escapeHtml(a.body || '')}${a.reference_text ? `<div class="muted text-xs mt-1">↳ ${App.escapeHtml(a.reference_text)}</div>` : ''}</td>
          <td><button type="button" class="btn-ghost text-sm" data-del="${a.id}">Удалить</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => del(b.dataset.del))
    );
  }

  async function del(id) {
    if (!confirm('Удалить аннотацию?')) return;
    const { error } = await window.sb.from('annotations').delete().eq('id', id);
    if (error) { console.error(error); App.toast('Ошибка удаления'); return; }
    App.toast('Удалено');
    state.annotations = state.annotations.filter((a) => a.id !== id);
    applyFilters();
  }
})();

// CRUD спикеров.

(function () {
  if (!window.Auth.requireAdmin()) return;

  const $ = (s) => document.querySelector(s);
  const state = { speakers: [], currentId: null };

  init();

  async function init() {
    await load();
    $('#btn-new').addEventListener('click', () => openEditor(null));
    $('#btn-back').addEventListener('click', closeEditor);
    $('#speaker-form').addEventListener('submit', save);
    $('#f-delete').addEventListener('click', del);
    renderList();
  }

  async function load() {
    const { data } = await window.sb.from('speakers').select('*').order('created_at', { ascending: false });
    state.speakers = data || [];
  }

  function renderList() {
    const tbody = $('#list-body');
    if (state.speakers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted" style="padding: 24px; text-align: center;">Спикеров пока нет.</td></tr>`;
      return;
    }
    tbody.innerHTML = state.speakers.map((s) => {
      const tg = s.tg_handle ? s.tg_handle.replace(/^@/, '') : '';
      return `
        <tr>
          <td>${App.escapeHtml(s.name || '')}</td>
          <td>${tg ? `<a href="https://t.me/${App.escapeHtml(tg)}" target="_blank" style="color: var(--color-accent);">@${App.escapeHtml(tg)}</a>` : '—'}</td>
          <td class="muted" style="white-space: nowrap;">${App.formatDate(s.created_at)}</td>
          <td><button type="button" class="btn-ghost text-sm" data-edit="${s.id}">Открыть</button></td>
        </tr>
      `;
    }).join('');
    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openEditor(b.dataset.edit))
    );
  }

  function openEditor(id) {
    state.currentId = id;
    const s = id ? state.speakers.find((x) => x.id === id) : null;
    $('#edit-title').textContent = s ? 'Редактировать спикера' : 'Новый спикер';
    $('#f-name').value  = s ? s.name || '' : '';
    $('#f-tg').value    = s ? s.tg_handle || '' : '';
    $('#f-photo').value = s ? s.photo_url || '' : '';
    $('#f-bio').value   = s ? s.bio_md || '' : '';
    $('#f-delete').style.display = s ? 'inline-flex' : 'none';
    $('#f-error').classList.remove('is-visible');
    $('#list-view').style.display = 'none';
    $('#edit-view').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function closeEditor() {
    state.currentId = null;
    $('#edit-view').style.display = 'none';
    $('#list-view').style.display = 'block';
    renderList();
  }

  async function save(e) {
    e.preventDefault();
    $('#f-error').classList.remove('is-visible');
    const name = $('#f-name').value.trim();
    if (!name) { $('#f-error').classList.add('is-visible'); return; }

    const tgRaw = $('#f-tg').value.trim();
    const payload = {
      name,
      tg_handle: tgRaw ? window.Auth.normalizeHandle(tgRaw) : null,
      photo_url: $('#f-photo').value.trim() || null,
      bio_md:    $('#f-bio').value || '',
    };

    const btn = $('#f-save');
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    const q = state.currentId
      ? window.sb.from('speakers').update(payload).eq('id', state.currentId).select().single()
      : window.sb.from('speakers').insert(payload).select().single();
    const { data, error } = await q;
    btn.disabled = false; btn.textContent = 'Сохранить';

    if (error) { console.error(error); App.toast('Ошибка сохранения'); return; }
    App.toast('Сохранено');
    if (state.currentId) {
      const idx = state.speakers.findIndex((x) => x.id === state.currentId);
      if (idx >= 0) state.speakers[idx] = data;
    } else {
      state.speakers.unshift(data);
      state.currentId = data.id;
      $('#edit-title').textContent = 'Редактировать спикера';
      $('#f-delete').style.display = 'inline-flex';
    }
  }

  async function del() {
    if (!state.currentId) return;
    if (!confirm('Удалить спикера? Мероприятия с ним останутся, но поле спикера сбросится.')) return;
    const { error } = await window.sb.from('speakers').delete().eq('id', state.currentId);
    if (error) { console.error(error); App.toast('Ошибка удаления'); return; }
    App.toast('Удалено');
    state.speakers = state.speakers.filter((x) => x.id !== state.currentId);
    closeEditor();
  }
})();

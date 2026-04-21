// CRUD мероприятий.

(function () {
  if (!window.Auth.requireAdmin()) return;

  const $ = (s) => document.querySelector(s);
  const state = { events: [], categories: [], speakers: [], currentId: null, materials: [] };

  init();

  async function init() {
    await Promise.all([loadCategories(), loadSpeakers(), loadEvents()]);
    populateSelects();
    bindListControls();
    bindEditControls();
    applyFilter();
  }

  async function loadCategories() {
    const { data } = await window.sb.from('categories').select('*').order('sort_order');
    state.categories = data || [];
  }
  async function loadSpeakers() {
    const { data } = await window.sb.from('speakers').select('id, name').order('name');
    state.speakers = data || [];
  }
  async function loadEvents() {
    const { data } = await window.sb.from('events')
      .select('*, categories(name), speakers(name)')
      .order('event_date', { ascending: false, nullsFirst: false });
    state.events = data || [];
  }

  function populateSelects() {
    $('#f-category').innerHTML = `<option value="">— не выбрана —</option>` +
      state.categories.map((c) => `<option value="${c.id}">${App.escapeHtml(c.name)}</option>`).join('');
    $('#f-speaker').innerHTML = `<option value="">— нет спикера —</option>` +
      state.speakers.map((s) => `<option value="${s.id}">${App.escapeHtml(s.name)}</option>`).join('');
  }

  function bindListControls() {
    $('#flt-search').addEventListener('input', applyFilter);
    $('#btn-new').addEventListener('click', () => openEditor(null));
  }

  function applyFilter() {
    const q = $('#flt-search').value.trim().toLowerCase();
    const rows = q ? state.events.filter((e) => (e.title || '').toLowerCase().includes(q)) : state.events;
    renderList(rows);
  }

  function renderList(rows) {
    const tbody = $('#list-body');
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="padding: 24px; text-align: center;">Ничего не нашлось.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((e) => `
      <tr>
        <td>${App.escapeHtml(e.title)}</td>
        <td class="muted" style="white-space: nowrap;">${App.formatDate(e.event_date) || '—'}</td>
        <td class="muted">${App.escapeHtml(App.EVENT_FORMAT_LABELS[e.format] || '—')}</td>
        <td class="muted">${App.escapeHtml(e.speakers ? e.speakers.name : '—')}</td>
        <td class="num">${e.likes || 0}</td>
        <td><button type="button" class="btn-ghost text-sm" data-edit="${e.id}">Открыть</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openEditor(b.dataset.edit))
    );
  }

  function bindEditControls() {
    $('#btn-back').addEventListener('click', closeEditor);
    $('#materials-add').addEventListener('click', () => {
      state.materials.push('');
      renderMaterials();
    });
    $('#event-form').addEventListener('submit', save);
    $('#f-delete').addEventListener('click', del);
  }

  function openEditor(id) {
    state.currentId = id;
    const e = id ? state.events.find((x) => x.id === id) : null;

    $('#edit-title').textContent = e ? 'Редактировать мероприятие' : 'Новое мероприятие';
    $('#f-title').value    = e ? e.title || '' : '';
    $('#f-date').value     = e && e.event_date ? e.event_date : '';
    $('#f-format').value   = e ? e.format || '' : '';
    $('#f-category').value = e ? (e.category_id || '') : '';
    $('#f-speaker').value  = e ? (e.speaker_id || '') : '';
    $('#f-tags').value     = e && Array.isArray(e.tags) ? e.tags.join(', ') : '';
    $('#f-video').value    = e ? e.video_url || '' : '';
    $('#f-workbook').value = e ? e.workbook_url || '' : '';
    $('#f-summary').value  = e ? e.summary_md || '' : '';
    state.materials        = e && Array.isArray(e.materials_urls) ? [...e.materials_urls] : [];
    renderMaterials();

    $('#f-delete').style.display = e ? 'inline-flex' : 'none';
    $('#f-error').classList.remove('is-visible');
    $('#list-view').style.display = 'none';
    $('#edit-view').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function closeEditor() {
    state.currentId = null;
    $('#edit-view').style.display = 'none';
    $('#list-view').style.display = 'block';
    applyFilter();
  }

  function renderMaterials() {
    const root = $('#materials-list');
    if (state.materials.length === 0) {
      root.innerHTML = `<div class="muted text-sm">Материалов нет. Нажми «+ Добавить ссылку».</div>`;
      return;
    }
    root.innerHTML = state.materials.map((url, i) => `
      <div class="flex gap-2 items-center">
        <input type="url" class="input" value="${App.escapeHtml(url)}" data-mat-idx="${i}" placeholder="https://…" />
        <button type="button" class="btn-ghost text-sm" data-mat-del="${i}">Удалить</button>
      </div>
    `).join('');
    root.querySelectorAll('[data-mat-idx]').forEach((inp) => {
      inp.addEventListener('input', () => {
        state.materials[+inp.dataset.matIdx] = inp.value;
      });
    });
    root.querySelectorAll('[data-mat-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.materials.splice(+btn.dataset.matDel, 1);
        renderMaterials();
      });
    });
  }

  async function save(e) {
    e.preventDefault();
    $('#f-error').classList.remove('is-visible');

    const title = $('#f-title').value.trim();
    if (!title) { $('#f-error').classList.add('is-visible'); return; }

    const tagsRaw = $('#f-tags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const materials = state.materials.map((u) => (u || '').trim()).filter(Boolean);

    const payload = {
      title,
      event_date:     $('#f-date').value || null,
      format:         $('#f-format').value || null,
      category_id:    $('#f-category').value || null,
      speaker_id:     $('#f-speaker').value || null,
      tags,
      video_url:      $('#f-video').value.trim() || null,
      workbook_url:   $('#f-workbook').value.trim() || null,
      materials_urls: materials,
      summary_md:     $('#f-summary').value || '',
    };

    const btn = $('#f-save');
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    const q = state.currentId
      ? window.sb.from('events').update(payload).eq('id', state.currentId).select('*, categories(name), speakers(name)').single()
      : window.sb.from('events').insert(payload).select('*, categories(name), speakers(name)').single();
    const { data, error } = await q;
    btn.disabled = false; btn.textContent = 'Сохранить';

    if (error) { console.error(error); App.toast('Ошибка сохранения'); return; }
    App.toast('Сохранено');

    if (state.currentId) {
      const idx = state.events.findIndex((x) => x.id === state.currentId);
      if (idx >= 0) state.events[idx] = data;
    } else {
      state.events.unshift(data);
      state.currentId = data.id;
      $('#edit-title').textContent = 'Редактировать мероприятие';
      $('#f-delete').style.display = 'inline-flex';
    }
  }

  async function del() {
    if (!state.currentId) return;
    if (!confirm('Удалить мероприятие безвозвратно?')) return;
    const { error } = await window.sb.from('events').delete().eq('id', state.currentId);
    if (error) { console.error(error); App.toast('Ошибка удаления'); return; }
    App.toast('Удалено');
    state.events = state.events.filter((x) => x.id !== state.currentId);
    closeEditor();
  }
})();

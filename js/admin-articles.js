// CRUD статей: список с фильтрами, форма с markdown-превью.

(function () {
  if (!window.Auth.requireAdmin()) return;

  const $ = (s) => document.querySelector(s);
  const state = { articles: [], categories: [], currentId: null, attachments: [] };

  const ATTACHMENT_TYPES = [
    { value: 'pdf',   label: 'PDF'   },
    { value: 'docx',  label: 'DOCX'  },
    { value: 'xlsx',  label: 'XLSX'  },
    { value: 'pptx',  label: 'PPTX'  },
    { value: 'zip',   label: 'ZIP'   },
    { value: 'other', label: 'Другое' },
  ];

  init();

  async function init() {
    await Promise.all([loadCategories(), loadArticles()]);
    populateCategoryFilters();
    bindListControls();
    bindEditControls();
    applyFilters();
  }

  async function loadCategories() {
    const { data } = await window.sb.from('categories').select('*').order('sort_order');
    state.categories = data || [];
  }

  async function loadArticles() {
    const { data, error } = await window.sb
      .from('articles').select('*, categories(name)').order('updated_at', { ascending: false });
    if (error) { console.error(error); return; }
    state.articles = data || [];
  }

  function populateCategoryFilters() {
    const opts = state.categories.map((c) => `<option value="${c.id}">${App.escapeHtml(c.name)}</option>`);
    $('#flt-category').insertAdjacentHTML('beforeend', opts.join(''));
    $('#f-category').innerHTML = `<option value="">— не выбрана —</option>` + opts.join('');
  }

  function bindListControls() {
    $('#flt-search').addEventListener('input', applyFilters);
    $('#flt-category').addEventListener('change', applyFilters);
    $('#flt-status').addEventListener('change', applyFilters);
    $('#btn-new').addEventListener('click', () => openEditor(null));
  }

  function applyFilters() {
    const q    = $('#flt-search').value.trim().toLowerCase();
    const cat  = $('#flt-category').value;
    const st   = $('#flt-status').value;
    let rows = state.articles;
    if (q)   rows = rows.filter((a) => (a.title || '').toLowerCase().includes(q));
    if (cat) rows = rows.filter((a) => a.category_id === cat);
    if (st)  rows = rows.filter((a) => a.status === st);
    renderList(rows);
  }

  function renderList(rows) {
    const tbody = $('#list-body');
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted" style="padding: 24px; text-align: center;">Ничего не нашлось.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((a) => `
      <tr>
        <td>${App.escapeHtml(a.title)}</td>
        <td class="muted">${App.escapeHtml(a.categories ? a.categories.name : '—')}</td>
        <td>${a.status === 'published'
          ? '<span class="badge badge-green">Опубликовано</span>'
          : '<span class="badge badge-gray">Черновик</span>'}</td>
        <td class="num">${a.views || 0}</td>
        <td class="num">${a.likes || 0}</td>
        <td class="muted" style="white-space: nowrap;">${App.formatDate(a.updated_at)}</td>
        <td><button type="button" class="btn-ghost text-sm" data-edit="${a.id}">Открыть</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => openEditor(b.dataset.edit))
    );
  }

  // ---- Редактор -----------------------------------------------------------
  function bindEditControls() {
    $('#btn-back').addEventListener('click', closeEditor);
    const body = $('#f-body');
    body.addEventListener('input', renderPreview);

    // tabs on mobile
    document.querySelectorAll('.md-editor-tabs button').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.md-editor-tabs button').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        const grid = $('#md-grid');
        grid.classList.toggle('show-source', b.dataset.tab === 'source');
        grid.classList.toggle('show-preview', b.dataset.tab === 'preview');
        if (b.dataset.tab === 'preview') renderPreview();
      });
    });

    $('#article-form').addEventListener('submit', saveArticle);
    $('#f-delete').addEventListener('click', deleteArticle);

    $('#attachment-add').addEventListener('click', () => {
      state.attachments.push({ name: '', url: '', type: 'pdf' });
      renderAttachments();
    });
  }

  function renderAttachments() {
    const root = $('#attachments-list');
    if (state.attachments.length === 0) {
      root.innerHTML = `<div class="muted text-sm">Файлов нет. Нажми «+ Добавить файл», если нужно приложить шаблон или PDF.</div>`;
      return;
    }
    const typeOptions = (selected) => ATTACHMENT_TYPES
      .map((t) => `<option value="${t.value}"${t.value === selected ? ' selected' : ''}>${t.label}</option>`)
      .join('');

    root.innerHTML = state.attachments.map((a, i) => `
      <div class="attachment-row" data-idx="${i}">
        <input type="text" class="input" placeholder="Название файла" data-att-field="name" value="${App.escapeHtml(a.name || '')}" />
        <input type="url"  class="input" placeholder="https://…"      data-att-field="url"  value="${App.escapeHtml(a.url  || '')}" />
        <select class="select" data-att-field="type">${typeOptions(a.type || 'pdf')}</select>
        <button type="button" class="btn-ghost text-sm" data-att-del="${i}">Удалить</button>
      </div>
    `).join('');

    root.querySelectorAll('[data-att-field]').forEach((el) => {
      el.addEventListener('input', (e) => {
        const row = e.target.closest('.attachment-row');
        const idx = +row.dataset.idx;
        state.attachments[idx][e.target.dataset.attField] = e.target.value;
      });
      el.addEventListener('change', (e) => {
        const row = e.target.closest('.attachment-row');
        const idx = +row.dataset.idx;
        state.attachments[idx][e.target.dataset.attField] = e.target.value;
      });
    });
    root.querySelectorAll('[data-att-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.attachments.splice(+btn.dataset.attDel, 1);
        renderAttachments();
      });
    });
  }

  function openEditor(id) {
    state.currentId = id;
    const a = id ? state.articles.find((x) => x.id === id) : null;

    $('#edit-title').textContent = a ? 'Редактировать статью' : 'Новая статья';
    $('#f-title').value    = a ? a.title || '' : '';
    $('#f-category').value = a ? (a.category_id || '') : '';
    $('#f-tags').value     = a && Array.isArray(a.tags) ? a.tags.join(', ') : '';
    $('#f-status').value   = a ? (a.status || 'draft') : 'draft';
    $('#f-body').value     = a ? a.body_md || '' : '';
    state.attachments      = a && Array.isArray(a.attachments) ? a.attachments.map((x) => ({ ...x })) : [];
    $('#f-delete').style.display = a ? 'inline-flex' : 'none';
    $('#f-error').classList.remove('is-visible');

    $('#list-view').style.display = 'none';
    $('#edit-view').style.display = 'block';
    renderPreview();
    renderAttachments();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function closeEditor() {
    state.currentId = null;
    $('#edit-view').style.display = 'none';
    $('#list-view').style.display = 'block';
  }

  function renderPreview() {
    $('#f-preview').innerHTML = App.renderMarkdown($('#f-body').value || '_пусто_');
  }

  async function saveArticle(e) {
    e.preventDefault();
    $('#f-error').classList.remove('is-visible');

    const title = $('#f-title').value.trim();
    const body  = $('#f-body').value;
    if (!title || !body.trim()) {
      $('#f-error').classList.add('is-visible');
      return;
    }

    const tagsRaw = $('#f-tags').value.trim();
    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const validTypes = new Set(ATTACHMENT_TYPES.map((t) => t.value));
    const attachments = state.attachments
      .map((a) => ({
        name: String(a.name || '').trim(),
        url:  String(a.url  || '').trim(),
        type: validTypes.has(a.type) ? a.type : 'other',
      }))
      .filter((a) => a.name && a.url);

    const payload = {
      title,
      body_md: body,
      category_id: $('#f-category').value || null,
      tags,
      status: $('#f-status').value,
      attachments,
    };

    const btn = $('#f-save');
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    let res;
    if (state.currentId) {
      res = await window.sb.from('articles').update(payload).eq('id', state.currentId).select().single();
    } else {
      res = await window.sb.from('articles').insert(payload).select().single();
    }
    btn.disabled = false; btn.textContent = 'Сохранить';

    if (res.error) { console.error(res.error); App.toast('Ошибка сохранения'); return; }
    App.toast('Сохранено');

    // Обновляем локальный кэш
    const saved = res.data;
    const cat = state.categories.find((c) => c.id === saved.category_id);
    saved.categories = cat ? { name: cat.name } : null;
    if (state.currentId) {
      const idx = state.articles.findIndex((x) => x.id === state.currentId);
      if (idx >= 0) state.articles[idx] = saved;
    } else {
      state.articles.unshift(saved);
    }
    state.currentId = saved.id;
    $('#f-delete').style.display = 'inline-flex';
    $('#edit-title').textContent = 'Редактировать статью';
    applyFilters();
  }

  async function deleteArticle() {
    if (!state.currentId) return;
    if (!confirm('Удалить статью безвозвратно?')) return;

    const { error } = await window.sb.from('articles').delete().eq('id', state.currentId);
    if (error) { console.error(error); App.toast('Ошибка удаления'); return; }
    App.toast('Удалено');
    state.articles = state.articles.filter((x) => x.id !== state.currentId);
    closeEditor();
    applyFilters();
  }
})();

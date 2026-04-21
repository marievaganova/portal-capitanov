// Главная страница: поиск, пиллы категорий, фильтр типа контента, карточки статей и мероприятий.

(function () {
  const state = {
    articles:   [],
    events:     [],
    categories: [],
    query:      '',
    categoryId: null,
    type:       'all',
  };

  const $ = (sel) => document.querySelector(sel);

  window.Auth.requireCaptain().then((ok) => { if (ok) init(); });

  async function init() {
    bindControls();
    await loadData();
    renderCategoryPills();
    applyFilters();
  }

  async function loadData() {
    const [articlesRes, eventsRes, categoriesRes] = await Promise.all([
      window.sb.from('articles')
        .select('id, title, body_md, category_id, tags, likes, updated_at, created_at')
        .eq('status', 'published'),
      window.sb.from('events')
        .select('id, title, event_date, format, category_id, tags, likes, updated_at, created_at, speakers(name)'),
      window.sb.from('categories').select('id, name, slug, sort_order').order('sort_order'),
    ]);
    state.articles   = articlesRes.data   || [];
    state.events     = eventsRes.data     || [];
    state.categories = categoriesRes.data || [];
  }

  function bindControls() {
    const input = $('#search-input');
    input.addEventListener('input', (e) => {
      state.query = e.target.value;
      applyFilters();
    });

    document.querySelectorAll('.type-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-pill').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.type = btn.dataset.type;
        applyFilters();
      });
    });
  }

  function renderCategoryPills() {
    const root = $('#category-pills');
    const pills = [
      { id: null, name: 'Все' },
      ...state.categories.map((c) => ({ id: c.id, name: c.name })),
    ];
    root.innerHTML = pills.map((p, i) => `
      <button class="pill category-pill ${i === 0 ? 'is-active' : ''}" data-id="${p.id ?? ''}">
        ${App.escapeHtml(p.name)}
      </button>
    `).join('');

    root.querySelectorAll('.category-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.category-pill').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.categoryId = btn.dataset.id || null;
        applyFilters();
      });
    });
  }

  function categoryNameById(id) {
    if (!id) return '';
    const c = state.categories.find((x) => x.id === id);
    return c ? c.name : '';
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();

    const matchQuery = (item) => {
      if (!q) return true;
      if (String(item.title || '').toLowerCase().includes(q)) return true;
      if (Array.isArray(item.tags) && item.tags.some((t) => String(t).toLowerCase().includes(q))) return true;
      return false;
    };
    const matchCategory = (item) =>
      !state.categoryId || item.category_id === state.categoryId;

    let articles = state.articles.filter(matchQuery).filter(matchCategory);
    let events   = state.events  .filter(matchQuery).filter(matchCategory);

    if (state.type === 'article') events   = [];
    if (state.type === 'event')   articles = [];

    const combined = [
      ...articles.map((x) => ({ ...x, _type: 'article' })),
      ...events  .map((x) => ({ ...x, _type: 'event'   })),
    ].sort((a, b) => {
      const ad = new Date(a.updated_at || a.created_at || 0).getTime();
      const bd = new Date(b.updated_at || b.created_at || 0).getTime();
      return bd - ad;
    });

    renderResults(combined);
  }

  function renderResults(items) {
    const grid  = $('#results');
    const count = $('#results-count');
    const empty = $('#empty-state');

    if (items.length === 0) {
      grid.innerHTML = '';
      count.textContent = '';
      const hasQuery    = state.query.trim().length > 0;
      const hasFilter   = hasQuery || state.categoryId || state.type !== 'all';

      // Когда фильтр активен — показываем "ничего не нашлось". Без фильтров
      // (пустая библиотека или открытая "Все/Все") ничего не показываем:
      // нижний блок "Не нашёл ответ?" уже закрывает этот сценарий.
      if (hasFilter) {
        empty.style.display = 'block';
        empty.innerHTML = `
          <div class="empty-title">Ничего не нашлось</div>
          <div>Попробуй другие слова или задай вопрос напрямую.</div>
        `;
      } else {
        empty.style.display = 'none';
      }
      return;
    }

    empty.style.display = 'none';
    count.textContent = `Найдено: ${items.length}`;
    grid.innerHTML = items.map((item) =>
      item._type === 'article' ? renderArticleCard(item) : renderEventCard(item)
    ).join('');
  }

  function renderArticleCard(a) {
    const cat = categoryNameById(a.category_id);
    const preview = App.plainPreview(a.body_md, 120);
    return `
      <a href="article.html?id=${encodeURIComponent(a.id)}" class="card card-article block" style="text-decoration: none;">
        <div class="flex items-center justify-between mb-3 gap-2">
          ${cat ? `<span class="badge">${App.escapeHtml(cat)}</span>` : '<span></span>'}
          <span class="text-xs muted">Статья</span>
        </div>
        <h3 class="font-display text-lg mb-2" style="font-weight: 600; color: var(--color-text);">
          ${App.escapeHtml(a.title)}
        </h3>
        <p class="text-sm muted mb-4" style="min-height: 2.7em;">${App.escapeHtml(preview)}</p>
        <div class="flex items-center gap-2 text-sm muted">
          ${App.heartIcon(false)}
          <span>${a.likes || 0}</span>
        </div>
      </a>
    `;
  }

  function renderEventCard(e) {
    const cat       = categoryNameById(e.category_id);
    const formatLbl = App.EVENT_FORMAT_LABELS[e.format] || '';
    const speaker   = e.speakers && e.speakers.name ? e.speakers.name : '';
    const date      = App.formatDate(e.event_date);

    return `
      <a href="event.html?id=${encodeURIComponent(e.id)}" class="card block" style="text-decoration: none; padding: 0; overflow: hidden;">
        <div style="background: var(--color-accent-soft); aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center;">
          <div style="width: 56px; height: 56px; border-radius: 999px; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(26,26,255,0.15);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--color-accent)">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
        <div style="padding: 20px;">
          <div class="flex items-center gap-2 mb-3 flex-wrap">
            ${formatLbl ? `<span class="badge badge-blue">${App.escapeHtml(formatLbl)}</span>` : ''}
            ${cat ? `<span class="badge">${App.escapeHtml(cat)}</span>` : ''}
            ${date ? `<span class="text-xs muted">${App.escapeHtml(date)}</span>` : ''}
          </div>
          <h3 class="font-display text-lg mb-2" style="font-weight: 600; color: var(--color-text);">
            ${App.escapeHtml(e.title)}
          </h3>
          ${speaker ? `<p class="text-sm muted mb-4">${App.escapeHtml(speaker)}</p>` : '<p class="text-sm muted mb-4">&nbsp;</p>'}
          <div class="flex items-center gap-2 text-sm muted">
            ${App.heartIcon(false)}
            <span>${e.likes || 0}</span>
          </div>
        </div>
      </a>
    `;
  }
})();

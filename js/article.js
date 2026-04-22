// Страница статьи: загрузка, markdown, лайк, форма аннотации, связанные статьи.

(function () {
  const params   = new URLSearchParams(window.location.search);
  const id       = params.get('id');
  const $        = (s) => document.querySelector(s);

  const state = {
    article: null,
    liked:   false,
    categoryName: '',
  };

  window.Auth.requireCaptain().then((ok) => { if (ok) init(); });

  async function init() {
    if (!id) return showError('Не указан id статьи.');

    try {
      const { data, error } = await window.sb
        .from('articles')
        .select('id, title, body_md, tags, likes, status, updated_at, category_id, attachments, categories(name)')
        .eq('id', id)
        .single();

      if (error || !data) return showError('Статья не найдена или снята с публикации.');
      if (data.status !== 'published') return showError('Статья снята с публикации.');

      state.article = data;
      state.categoryName = data.categories ? data.categories.name : '';

      // Инкремент просмотров — фоном, без ожидания
      window.sb.rpc('increment_views', { article_id: id }).then(({ error: e }) => {
        if (e) console.warn('increment_views failed', e);
      });

      render();
      renderAttachments();
      setupLike();
      setupAnnotationForm();
      loadRelated();
    } catch (e) {
      console.error(e);
      showError('Что-то пошло не так при загрузке.');
    }
  }

  function render() {
    $('#article-loading').style.display = 'none';
    $('#article-root').style.display = 'block';

    $('#article-title').textContent = state.article.title;
    $('#article-updated').textContent = state.article.updated_at
      ? `Обновлено ${App.formatDate(state.article.updated_at)}`
      : '';

    const meta = $('#article-meta');
    meta.innerHTML = state.categoryName
      ? `<span class="badge">${App.escapeHtml(state.categoryName)}</span>`
      : '';

    $('#article-body').innerHTML = App.renderMarkdown(state.article.body_md);
    document.title = `${state.article.title} — Портал капитанов`;
  }

  const ATTACHMENT_ICONS = {
    pdf:   '📄',
    docx:  '📝',
    xlsx:  '📊',
    pptx:  '📑',
    zip:   '📦',
    other: '📎',
  };

  function renderAttachments() {
    const list = Array.isArray(state.article.attachments) ? state.article.attachments : [];
    const clean = list.filter((a) => a && a.url && a.name);
    if (clean.length === 0) return;

    $('#attachments-section').style.display = 'block';
    $('#attachments-list').innerHTML = clean.map((a) => {
      const icon = ATTACHMENT_ICONS[a.type] || ATTACHMENT_ICONS.other;
      const typeLabel = a.type && a.type !== 'other' ? a.type.toUpperCase() : '';
      return `
        <li>
          <a class="attachment-link" href="${App.escapeHtml(a.url)}" target="_blank" rel="noopener">
            <span class="attachment-icon" aria-hidden="true">${icon}</span>
            <span class="attachment-name">${App.escapeHtml(a.name)}</span>
            ${typeLabel ? `<span class="attachment-type">${App.escapeHtml(typeLabel)}</span>` : ''}
          </a>
        </li>
      `;
    }).join('');
  }

  function showError(msg) {
    $('#article-loading').style.display = 'none';
    const el = $('#article-error');
    el.style.display = 'block';
    el.innerHTML = `<div class="empty-title">Упс</div><div>${App.escapeHtml(msg)}</div>
      <div style="margin-top: 16px;"><a href="library.html" class="btn btn-secondary">В библиотеку</a></div>`;
  }

  // ---- Лайк ----------------------------------------------------------------
  async function setupLike() {
    const handle = window.Auth.getCurrentHandle();
    state.liked = await App.hasLike('article', state.article.id, handle);
    updateLikeUi();

    $('#like-btn').addEventListener('click', async () => {
      const btn = $('#like-btn');
      btn.disabled = true;
      try {
        const res = await App.toggleLike('article', state.article.id, handle, state.article.likes);
        state.liked = res.liked;
        state.article.likes = res.likes;
        updateLikeUi();
      } catch (e) {
        console.error(e);
        App.toast('Не получилось. Попробуй ещё раз.');
      } finally {
        btn.disabled = false;
      }
    });
  }
  function updateLikeUi() {
    $('#like-icon').innerHTML = App.heartIcon(state.liked);
    $('#like-count').textContent = state.article.likes || 0;
    $('#like-btn').classList.toggle('is-liked', state.liked);
  }

  // ---- Форма аннотации -----------------------------------------------------
  function setupAnnotationForm() {
    const form     = $('#annotation-form');
    const errorEl  = $('#ann-error');
    const submit   = $('#ann-submit');
    const thanks   = $('#ann-thanks');
    const trigger  = $('#ann-trigger');
    const triggerWrap = $('#ann-trigger-wrap');
    const section  = $('#ann-section');
    const closeBtn = $('#ann-close');

    const open = () => {
      triggerWrap.style.display = 'none';
      section.style.display = 'block';
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => $('#ann-body').focus(), 300);
    };
    const close = () => {
      section.style.display = 'none';
      triggerWrap.style.display = 'block';
      thanks.style.display = 'none';
    };
    trigger.addEventListener('click', open);
    closeBtn.addEventListener('click', close);

    // автозаполнение
    const handle = window.Auth.getCurrentHandle();
    if (handle) $('#ann-tg').value = handle;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.classList.remove('is-visible');

      const payload = {
        content_type:    'article',
        content_id:      state.article.id,
        annotation_type: $('#ann-type').value,
        reference_text:  $('#ann-ref').value.trim() || null,
        body:            $('#ann-body').value.trim(),
        author_name:     $('#ann-name').value.trim(),
        author_tg:       window.Auth.normalizeHandle($('#ann-tg').value),
      };

      if (!payload.body || !payload.author_name || !payload.author_tg) {
        errorEl.classList.add('is-visible');
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Отправляем…';
      const { error } = await window.sb.from('annotations').insert(payload);
      submit.disabled = false;
      submit.textContent = 'Отправить';

      if (error) {
        console.error(error);
        App.toast('Не получилось отправить. Попробуй ещё раз.');
        return;
      }

      form.reset();
      if (handle) $('#ann-tg').value = handle;
      thanks.style.display = 'block';
      setTimeout(() => { close(); }, 2500);
    });
  }

  // ---- Связанные статьи ----------------------------------------------------
  async function loadRelated() {
    const tags = Array.isArray(state.article.tags) ? state.article.tags.filter(Boolean) : [];
    if (tags.length === 0) return;

    const { data, error } = await window.sb
      .from('articles')
      .select('id, title, category_id, categories(name), likes')
      .eq('status', 'published')
      .neq('id', state.article.id)
      .overlaps('tags', tags)
      .limit(3);
    if (error || !data || data.length === 0) return;

    $('#related-section').style.display = 'block';
    $('#related-list').innerHTML = data.map((a) => `
      <a href="article.html?id=${encodeURIComponent(a.id)}" class="card card-article block" style="text-decoration: none;">
        ${a.categories && a.categories.name ? `<span class="badge mb-2 inline-block">${App.escapeHtml(a.categories.name)}</span>` : ''}
        <h3 class="font-display text-base mt-2 mb-2" style="font-weight: 600; color: var(--color-text);">
          ${App.escapeHtml(a.title)}
        </h3>
        <div class="flex items-center gap-2 text-sm muted">
          ${App.heartIcon(false)}<span>${a.likes || 0}</span>
        </div>
      </a>
    `).join('');
  }
})();

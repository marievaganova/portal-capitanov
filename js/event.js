// Страница мероприятия: видео-embed, спикер, материалы, резюме, лайк, аннотация.

(function () {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  const $      = (s) => document.querySelector(s);

  const state = {
    event: null,
    speaker: null,
    categoryName: '',
    liked: false,
  };

  window.Auth.requireCaptain().then((ok) => { if (ok) init(); });

  async function init() {
    if (!id) return showError('Не указан id мероприятия.');
    try {
      const { data, error } = await window.sb
        .from('events')
        .select(`
          id, title, event_date, format, tags, likes, video_url, materials_urls,
          workbook_url, summary_md, category_id,
          categories(name),
          speakers(id, name, tg_handle, photo_url, bio_md)
        `)
        .eq('id', id)
        .single();
      if (error || !data) return showError('Мероприятие не найдено.');

      state.event        = data;
      state.speaker      = data.speakers || null;
      state.categoryName = data.categories ? data.categories.name : '';

      render();
      setupLike();
      setupAnnotationForm();
    } catch (e) {
      console.error(e);
      showError('Что-то пошло не так при загрузке.');
    }
  }

  function showError(msg) {
    $('#event-loading').style.display = 'none';
    const el = $('#event-error');
    el.style.display = 'block';
    el.innerHTML = `<div class="empty-title">Упс</div><div>${App.escapeHtml(msg)}</div>
      <div style="margin-top: 16px;"><a href="library.html" class="btn btn-secondary">В библиотеку</a></div>`;
  }

  function render() {
    $('#event-loading').style.display = 'none';
    $('#event-root').style.display = 'block';

    const e = state.event;
    document.title = `${e.title} — Портал капитанов`;
    $('#event-title').textContent = e.title;

    // meta: дата, формат, категория
    const metaEl = $('#event-meta');
    const parts = [];
    const formatLbl = App.EVENT_FORMAT_LABELS[e.format];
    if (formatLbl)  parts.push(`<span class="badge badge-blue">${App.escapeHtml(formatLbl)}</span>`);
    if (state.categoryName) parts.push(`<span class="badge">${App.escapeHtml(state.categoryName)}</span>`);
    const dateStr = App.formatDate(e.event_date);
    if (dateStr) parts.push(`<span class="text-sm muted">${App.escapeHtml(dateStr)}</span>`);
    metaEl.innerHTML = parts.join('');

    // video
    $('#event-video').innerHTML = App.buildVideoEmbed(e.video_url);

    // speaker
    if (state.speaker) {
      $('#speaker-section').style.display = 'block';
      $('#speaker-name').textContent = state.speaker.name || '';
      if (state.speaker.tg_handle) {
        const h = state.speaker.tg_handle.replace(/^@/, '');
        $('#speaker-tg').innerHTML = `<a href="https://t.me/${App.escapeHtml(h)}" target="_blank" rel="noopener" class="underline" style="color: var(--color-accent);">@${App.escapeHtml(h)}</a>`;
      }
      $('#speaker-bio').innerHTML = App.renderMarkdown(state.speaker.bio_md || '');
      if (state.speaker.photo_url) {
        const img = $('#speaker-photo');
        img.src = state.speaker.photo_url;
        img.alt = state.speaker.name || '';
        img.style.display = 'block';
      } else {
        const fb = $('#speaker-photo-fallback');
        fb.textContent = initials(state.speaker.name || '');
        fb.style.display = 'flex';
      }
    }

    // materials
    const materialLinks = [];
    if (Array.isArray(e.materials_urls)) {
      e.materials_urls.filter(Boolean).forEach((u) => materialLinks.push({ label: 'Материал', url: u }));
    }
    if (e.workbook_url) materialLinks.unshift({ label: 'Воркбук', url: e.workbook_url });

    if (materialLinks.length > 0) {
      $('#materials-section').style.display = 'block';
      $('#materials-list').innerHTML = materialLinks.map((m) => `
        <li>
          <a href="${App.escapeHtml(m.url)}" target="_blank" rel="noopener"
             class="inline-flex items-center gap-2 text-sm" style="color: var(--color-accent);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <span>${App.escapeHtml(truncateUrl(m.url))}</span>
          </a>
        </li>
      `).join('');
    }

    // summary
    if (e.summary_md && e.summary_md.trim()) {
      $('#summary-section').style.display = 'block';
      $('#event-summary').innerHTML = App.renderMarkdown(e.summary_md);
    }
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  }
  function truncateUrl(url) {
    try {
      const u = new URL(url);
      const path = u.pathname.length > 24 ? u.pathname.slice(0, 24) + '…' : u.pathname;
      return u.hostname + path;
    } catch { return url.length > 40 ? url.slice(0, 40) + '…' : url; }
  }

  // ---- Лайк ----------------------------------------------------------------
  async function setupLike() {
    const handle = window.Auth.getCurrentHandle();
    state.liked = await App.hasLike('event', state.event.id, handle);
    updateLikeUi();
    $('#like-btn').addEventListener('click', async () => {
      const btn = $('#like-btn');
      btn.disabled = true;
      try {
        const res = await App.toggleLike('event', state.event.id, handle, state.event.likes);
        state.liked = res.liked;
        state.event.likes = res.likes;
        updateLikeUi();
      } catch (e) {
        console.error(e);
        App.toast('Не получилось. Попробуй ещё раз.');
      } finally { btn.disabled = false; }
    });
  }
  function updateLikeUi() {
    $('#like-icon').innerHTML = App.heartIcon(state.liked);
    $('#like-count').textContent = state.event.likes || 0;
  }

  // ---- Форма аннотации -----------------------------------------------------
  function setupAnnotationForm() {
    const form    = $('#annotation-form');
    const errorEl = $('#ann-error');
    const submit  = $('#ann-submit');
    const thanks  = $('#ann-thanks');

    const handle = window.Auth.getCurrentHandle();
    if (handle) $('#ann-tg').value = handle;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.classList.remove('is-visible');

      const payload = {
        content_type:    'event',
        content_id:      state.event.id,
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
      setTimeout(() => { thanks.style.display = 'none'; }, 6000);
    });
  }
})();

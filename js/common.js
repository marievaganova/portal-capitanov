// Общие утилиты: экранирование, форматирование, markdown, видео-embed, тосты, лайки.
// Подключать после supabase-config.js и auth.js.

(function () {
  // ---- экранирование -------------------------------------------------------
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---- даты ----------------------------------------------------------------
  const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  // ---- метки форматов / типов ---------------------------------------------
  const EVENT_FORMAT_LABELS = {
    workshop: 'Воркшоп',
    tg_live:  'TG-эфир',
    meetup:   'Встреча',
    talk:     'Мини-доклад',
  };
  const REQUEST_TYPE_LABELS = {
    case:             'Кейс на разбор',
    question:         'Вопрос',
    speaker_proposal: 'Предложение выступления',
  };
  const ANNOTATION_TYPE_LABELS = {
    outdated:            'Устарело',
    not_applicable:      'Не применимо',
    suggest_alternative: 'Предлагаю другой подход',
    other:               'Другое',
  };
  const REQUEST_STATUS_LABELS = {
    new:         'Новый',
    in_progress: 'В работе',
    answered:    'Отвечен',
    closed:      'Закрыт',
  };
  const REQUEST_STATUS_BADGE = {
    new:         'badge-blue',
    in_progress: 'badge-yellow',
    answered:    'badge-green',
    closed:      'badge-gray',
  };

  // ---- markdown с sanitize -------------------------------------------------
  function renderMarkdown(md) {
    if (!md) return '';
    if (!window.marked || !window.DOMPurify) {
      console.warn('marked/DOMPurify не загружены — показываю plain text');
      return escapeHtml(md);
    }
    const raw = window.marked.parse(md, { breaks: true, gfm: true });
    return window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  }

  // Обрезает markdown для превью (убирает разметку, режет на N символов).
  function plainPreview(md, n = 120) {
    if (!md) return '';
    const stripped = String(md)
      .replace(/`{3}[\s\S]*?`{3}/g, ' ')       // блоки кода
      .replace(/`[^`]*`/g, ' ')                // инлайн-код
      .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')    // картинки
      .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')  // ссылки → текст
      .replace(/[#>*_~\-]+/g, ' ')             // маркеры md
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped.length <= n) return stripped;
    return stripped.slice(0, n).replace(/[\s,;:.!?]+$/, '') + '…';
  }

  // ---- видео-embed: YouTube / Kinescope / RuTube --------------------------
  function buildVideoEmbed(url) {
    if (!url) return '';
    let embedUrl = null;

    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');

      // YouTube
      if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
        const id = u.searchParams.get('v');
        if (id) embedUrl = `https://www.youtube.com/embed/${id}`;
        else {
          const m = u.pathname.match(/^\/(embed|shorts)\/([^\/?#]+)/);
          if (m) embedUrl = `https://www.youtube.com/embed/${m[2]}`;
        }
      } else if (host === 'youtu.be') {
        const id = u.pathname.split('/').filter(Boolean)[0];
        if (id) embedUrl = `https://www.youtube.com/embed/${id}`;
      }

      // Kinescope
      else if (host === 'kinescope.io' || host.endsWith('.kinescope.io')) {
        const parts = u.pathname.split('/').filter(Boolean);
        const id = parts[0] === 'embed' ? parts[1] : parts[0];
        if (id) embedUrl = `https://kinescope.io/embed/${id}`;
      }

      // RuTube
      else if (host === 'rutube.ru' || host.endsWith('.rutube.ru')) {
        let m = u.pathname.match(/^\/video\/([^\/?#]+)/);
        if (m) embedUrl = `https://rutube.ru/play/embed/${m[1]}/`;
        else {
          m = u.pathname.match(/^\/play\/embed\/([^\/?#]+)/);
          if (m) embedUrl = `https://rutube.ru/play/embed/${m[1]}/`;
        }
      }
    } catch (_) { /* не URL — провалится в fallback */ }

    if (!embedUrl) {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="underline" style="color: var(--color-accent);">Смотреть видео</a>`;
    }

    return `
      <div class="video-embed" style="position: relative; padding-bottom: 56.25%; height: 0; border-radius: 12px; overflow: hidden; background: #000;">
        <iframe
          src="${escapeHtml(embedUrl)}"
          title="Видео"
          allowfullscreen
          allow="autoplay; encrypted-media; picture-in-picture"
          style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;"
          loading="lazy"
        ></iframe>
      </div>
    `;
  }

  // ---- тост ---------------------------------------------------------------
  let toastTimer = null;
  function toast(message) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  // ---- иконка сердца (SVG) -------------------------------------------------
  function heartIcon(filled) {
    const fill = filled ? 'var(--color-accent)' : 'none';
    const stroke = filled ? 'var(--color-accent)' : '#666';
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    `;
  }

  // ---- лайки ---------------------------------------------------------------
  // contentType: 'article' | 'event'
  async function hasLike(contentType, contentId, handle) {
    if (!handle) return false;
    const { data, error } = await window.sb
      .from('likes')
      .select('id')
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .eq('tg_handle', handle)
      .limit(1);
    if (error) { console.error(error); return false; }
    return Array.isArray(data) && data.length > 0;
  }

  async function toggleLike(contentType, contentId, handle, currentLikes) {
    if (!handle) throw new Error('no handle');
    const table = contentType === 'article' ? 'articles' : 'events';
    const liked = await hasLike(contentType, contentId, handle);

    if (liked) {
      const del = await window.sb.from('likes').delete()
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .eq('tg_handle', handle);
      if (del.error) throw del.error;
      const next = Math.max(0, (currentLikes || 0) - 1);
      const upd = await window.sb.from(table).update({ likes: next }).eq('id', contentId);
      if (upd.error) throw upd.error;
      return { liked: false, likes: next };
    } else {
      const ins = await window.sb.from('likes').insert({
        content_type: contentType,
        content_id:   contentId,
        tg_handle:    handle,
      });
      if (ins.error && ins.error.code !== '23505') throw ins.error; // 23505 = unique violation (уже лайкнул параллельно)
      const next = (currentLikes || 0) + 1;
      const upd = await window.sb.from(table).update({ likes: next }).eq('id', contentId);
      if (upd.error) throw upd.error;
      return { liked: true, likes: next };
    }
  }

  // ---- статистика ----------------------------------------------------------
  function medianOf(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  function formatHours(h) {
    if (h === null || h === undefined || isNaN(h)) return '';
    if (h < 1)   return `${Math.max(1, Math.round(h * 60))} мин`;
    if (h < 24)  return `${Math.round(h)} ч`;
    return `${Math.round((h / 24) * 10) / 10} дн`;
  }

  window.App = {
    escapeHtml,
    formatDate,
    renderMarkdown,
    plainPreview,
    buildVideoEmbed,
    toast,
    heartIcon,
    hasLike,
    toggleLike,
    medianOf,
    formatHours,
    EVENT_FORMAT_LABELS,
    REQUEST_TYPE_LABELS,
    ANNOTATION_TYPE_LABELS,
    REQUEST_STATUS_LABELS,
    REQUEST_STATUS_BADGE,
  };
})();

// Админская шапка с навигацией и счётчиком новых запросов.
// На странице должно быть <div id="admin-nav-root" data-active="dashboard|requests|..."></div>

(function () {
  async function render() {
    const root = document.getElementById('admin-nav-root');
    if (!root) return;

    const active = (root.dataset.active || '').trim();
    const linkClass = (name) => 'nav-link' + (active === name ? ' is-active' : '');

    root.innerHTML = `
      <header class="site-header admin-header">
        <div class="site-header-inner">
          <a class="site-logo" href="admin-dashboard.html">
            <span class="site-logo-mark"></span>
            <span class="site-logo-text">Портал капитанов</span>
            <span class="admin-badge">Админка</span>
          </a>
          <nav class="site-nav">
            <a href="admin-dashboard.html"   class="${linkClass('dashboard')}">Дашборд</a>
            <a href="admin-requests.html"    class="${linkClass('requests')}">Запросы<span id="nav-requests-count" class="nav-count-badge" style="display:none;">0</span></a>
            <a href="admin-articles.html"    class="${linkClass('articles')}">Статьи</a>
            <a href="admin-events.html"      class="${linkClass('events')}">Мероприятия</a>
            <a href="admin-speakers.html"    class="${linkClass('speakers')}">Спикеры</a>
            <a href="admin-annotations.html" class="${linkClass('annotations')}">Аннотации</a>
            <a href="admin-users.html"       class="${linkClass('users')}">Whitelist</a>
          </nav>
          <div class="site-user">
            <a href="library.html" class="btn-ghost">К сайту</a>
            <button type="button" class="btn-ghost" id="admin-logout">Выйти</button>
          </div>
        </div>
      </header>
    `;

    document.getElementById('admin-logout').addEventListener('click', () => {
      window.Auth.setAdmin(false);
      window.location.href = 'admin.html';
    });

    // Счётчик новых запросов
    try {
      const { count } = await window.sb
        .from('requests').select('id', { count: 'exact', head: true })
        .eq('status', 'new');
      const badge = document.getElementById('nav-requests-count');
      if (count && count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      }
    } catch (_) { /* ignore */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else { render(); }
})();

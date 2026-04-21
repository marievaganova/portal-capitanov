// Рендер шапки навигации на публичных страницах.
// На странице должно быть <div id="nav-root" data-active="library|ask"></div>

(function () {
  function render() {
    const root = document.getElementById('nav-root');
    if (!root) return;

    const active = (root.dataset.active || '').trim();
    const handle = (window.Auth && window.Auth.getCurrentHandle()) || '';

    const linkClass = (name) =>
      'nav-link' + (active === name ? ' is-active' : '');

    root.innerHTML = `
      <header class="site-header">
        <div class="site-header-inner">
          <a class="site-logo" href="library.html">
            <span class="site-logo-mark"></span>
            <span class="site-logo-text">Портал капитанов</span>
          </a>
          <nav class="site-nav">
            <a href="library.html" class="${linkClass('library')}">Библиотека</a>
            <a href="ask.html"     class="${linkClass('ask')}">Обращение</a>
          </nav>
          <div class="site-user">
            <span class="site-user-handle" id="nav-user-handle">${escapeHtml(handle)}</span>
            <button type="button" class="btn-ghost" id="nav-logout">Выйти</button>
          </div>
        </div>
      </header>
    `;

    const btn = document.getElementById('nav-logout');
    if (btn) btn.addEventListener('click', () => window.Auth.logout());
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();

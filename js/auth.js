// Авторизация капитанов и владельца.
// Пользовательская сессия — просто TG-хэндл в localStorage.
// Админ-сессия — флаг admin_auth=true в localStorage, выставляется после ввода пароля.

(function () {
  const HANDLE_KEY      = 'captain_handle';
  const ADMIN_AUTH_KEY  = 'admin_auth';
  const OWNER_HANDLE    = '@my_metodolog';

  // --- нормализация хэндлов -------------------------------------------------
  function normalizeHandle(raw) {
    if (!raw) return '';
    const t = String(raw).trim().toLowerCase().replace(/\s+/g, '');
    if (!t) return '';
    return t.startsWith('@') ? t : '@' + t;
  }

  // --- проверка по whitelist ------------------------------------------------
  async function isAllowed(handle) {
    const h = normalizeHandle(handle);
    if (!h || h === '@') return false;
    const { data, error } = await window.sb
      .from('allowed_users')
      .select('tg_handle')
      .ilike('tg_handle', h)
      .limit(1);
    if (error) {
      console.error('isAllowed error', error);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  }

  // --- базовые операции с сессией капитана ----------------------------------
  function getCurrentHandle() {
    return localStorage.getItem(HANDLE_KEY) || '';
  }
  function setCurrentHandle(handle) {
    localStorage.setItem(HANDLE_KEY, normalizeHandle(handle));
  }
  function clearSession() {
    localStorage.removeItem(HANDLE_KEY);
    localStorage.removeItem(ADMIN_AUTH_KEY);
  }
  function logout() {
    clearSession();
    window.location.href = 'index.html';
  }

  // --- гард для публичных страниц -------------------------------------------
  // Вставлять в начало JS-файла защищённой страницы:
  //   Auth.requireCaptain().then(ok => { if (!ok) return; ... });
  async function requireCaptain() {
    const h = getCurrentHandle();
    if (!h) {
      window.location.href = 'index.html';
      return false;
    }
    // Проверяем, не удалили ли хэндл из whitelist, пока он был залогинен.
    const ok = await isAllowed(h);
    if (!ok) {
      clearSession();
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }

  // --- админ ----------------------------------------------------------------
  function isAdmin() {
    return localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
  }
  function setAdmin(flag) {
    if (flag) localStorage.setItem(ADMIN_AUTH_KEY, 'true');
    else      localStorage.removeItem(ADMIN_AUTH_KEY);
  }
  function requireAdmin() {
    if (!isAdmin()) {
      window.location.href = 'admin.html';
      return false;
    }
    return true;
  }
  function checkAdminPassword(password) {
    return typeof window.ADMIN_PASSWORD === 'string'
        && password === window.ADMIN_PASSWORD;
  }

  window.Auth = {
    normalizeHandle,
    isAllowed,
    getCurrentHandle,
    setCurrentHandle,
    clearSession,
    logout,
    requireCaptain,
    isAdmin,
    setAdmin,
    requireAdmin,
    checkAdminPassword,
    OWNER_HANDLE,
  };
})();

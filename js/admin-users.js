// Whitelist: список, добавление одного/массово, удаление.

(function () {
  if (!window.Auth.requireAdmin()) return;

  const $ = (s) => document.querySelector(s);
  const state = { users: [] };

  init();

  async function init() {
    await load();
    $('#add-one-form').addEventListener('submit', addOne);
    $('#add-bulk-form').addEventListener('submit', addBulk);
    $('#flt-search').addEventListener('input', renderList);
    renderList();
  }

  async function load() {
    const { data } = await window.sb.from('allowed_users').select('*').order('created_at', { ascending: false });
    state.users = data || [];
  }

  function renderList() {
    const q = $('#flt-search').value.trim().toLowerCase();
    const rows = q
      ? state.users.filter((u) => u.tg_handle.toLowerCase().includes(q))
      : state.users;
    $('#count').textContent = `(${state.users.length})`;

    const tbody = $('#list-body');
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="muted" style="padding: 24px; text-align: center;">Никого нет.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((u) => {
      const clean = u.tg_handle.replace(/^@/, '');
      return `
        <tr>
          <td><a href="https://t.me/${App.escapeHtml(clean)}" target="_blank" style="color: var(--color-accent);">${App.escapeHtml(u.tg_handle)}</a></td>
          <td class="muted" style="white-space: nowrap;">${App.formatDate(u.created_at)}</td>
          <td><button type="button" class="btn-ghost text-sm" data-del="${u.id}">Удалить</button></td>
        </tr>
      `;
    }).join('');
    tbody.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => del(b.dataset.del))
    );
  }

  async function addOne(e) {
    e.preventDefault();
    const raw = $('#add-one-input').value;
    const handle = window.Auth.normalizeHandle(raw);
    if (!handle || handle === '@') return;
    await insertHandles([handle]);
    $('#add-one-input').value = '';
  }

  async function addBulk(e) {
    e.preventDefault();
    const raw = $('#add-bulk-input').value;
    const handles = raw.split(/\n+/)
      .map((h) => window.Auth.normalizeHandle(h))
      .filter((h) => h && h !== '@');
    if (handles.length === 0) return;
    await insertHandles(handles);
    $('#add-bulk-input').value = '';
  }

  async function insertHandles(handles) {
    // Убираем дубли + уже существующих
    const existing = new Set(state.users.map((u) => u.tg_handle));
    const unique = Array.from(new Set(handles)).filter((h) => !existing.has(h));
    if (unique.length === 0) { App.toast('Все уже в списке'); return; }

    const { data, error } = await window.sb.from('allowed_users')
      .insert(unique.map((h) => ({ tg_handle: h })))
      .select();

    if (error) { console.error(error); App.toast('Ошибка добавления'); return; }
    state.users = [...(data || []), ...state.users];
    renderList();
    App.toast(`Добавлено: ${unique.length}`);
  }

  async function del(id) {
    const u = state.users.find((x) => x.id === id);
    if (!u) return;
    if (!confirm(`Удалить ${u.tg_handle} из whitelist? После этого он потеряет доступ.`)) return;
    const { error } = await window.sb.from('allowed_users').delete().eq('id', id);
    if (error) { console.error(error); App.toast('Ошибка удаления'); return; }
    state.users = state.users.filter((x) => x.id !== id);
    renderList();
    App.toast('Удалён');
  }
})();

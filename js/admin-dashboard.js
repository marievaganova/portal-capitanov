// Дашборд админки: метрики + распределение + топ-5 статей.

(function () {
  if (!window.Auth.requireAdmin()) return;

  const $ = (s) => document.querySelector(s);

  init();

  async function init() {
    await Promise.all([loadRequestMetrics(), loadTopArticles()]);
  }

  async function loadRequestMetrics() {
    const { data: requests, error } = await window.sb
      .from('requests')
      .select('id, type, status, created_at, answered_at, closed_at');
    if (error) { console.error(error); return; }

    const total = requests.length;
    const byStatus = groupBy(requests, (r) => r.status);
    const newCount = (byStatus.new || []).length;

    // Медиана времени от создания до answered_at (в часах, округлённо)
    const answeredTimes = requests
      .filter((r) => r.answered_at && r.created_at)
      .map((r) => (new Date(r.answered_at) - new Date(r.created_at)) / 3_600_000);
    const median = medianOf(answeredTimes);

    // % закрытых без ответа: closed с answered_at IS NULL, от всех закрытых
    const closed = requests.filter((r) => r.status === 'closed');
    const closedNoMeet = closed.filter((r) => !r.answered_at).length;
    const pctClosedNoMeet = closed.length
      ? Math.round((closedNoMeet / closed.length) * 100)
      : 0;

    $('#m-total').textContent = total;
    $('#m-new').textContent = newCount;
    $('#m-median').textContent = median !== null ? formatHours(median) : '—';
    $('#m-closed-no-meet').textContent = closed.length ? pctClosedNoMeet + '%' : '—';

    // Распределение по типу
    const byType = groupBy(requests, (r) => r.type);
    const typeRows = ['case', 'question', 'speaker_proposal'].map((t) => {
      const all = byType[t] || [];
      const fresh = all.filter((r) => r.status === 'new').length;
      return `<tr>
        <td>${App.REQUEST_TYPE_LABELS[t]}</td>
        <td class="num">${all.length}</td>
        <td class="num">${fresh}</td>
      </tr>`;
    });
    $('#by-type-body').innerHTML = typeRows.join('') || '<tr><td colspan="3" class="muted">Запросов пока нет.</td></tr>';
  }

  async function loadTopArticles() {
    const [viewsRes, likesRes] = await Promise.all([
      window.sb.from('articles').select('id, title, views, likes').order('views', { ascending: false }).limit(5),
      window.sb.from('articles').select('id, title, views, likes').order('likes', { ascending: false }).limit(5),
    ]);

    $('#top-views-body').innerHTML = renderTopRows(viewsRes.data || [], 'views');
    $('#top-likes-body').innerHTML = renderTopRows(likesRes.data || [], 'likes');
  }

  function renderTopRows(rows, field) {
    if (rows.length === 0) {
      return '<tr><td colspan="2" class="muted">Статей пока нет.</td></tr>';
    }
    return rows.map((a) => `
      <tr>
        <td><a href="article.html?id=${encodeURIComponent(a.id)}" style="color: var(--color-accent);">${App.escapeHtml(a.title)}</a></td>
        <td class="num">${a[field] || 0}</td>
      </tr>
    `).join('');
  }

  // utils
  function groupBy(arr, keyFn) {
    return arr.reduce((acc, item) => {
      const k = keyFn(item);
      (acc[k] ||= []).push(item);
      return acc;
    }, {});
  }
  function medianOf(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  function formatHours(h) {
    if (h < 1)   return `${Math.max(1, Math.round(h * 60))} мин`;
    if (h < 24)  return `${Math.round(h)} ч`;
    return `${Math.round(h / 24 * 10) / 10} дн`;
  }
})();

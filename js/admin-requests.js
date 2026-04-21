// Очередь запросов: таблица, фильтры, раскрытие карточки, смена статуса.

(function () {
  if (!window.Auth.requireAdmin()) return;

  const $ = (s) => document.querySelector(s);
  const state = { all: [], currentId: null };

  init();

  async function init() {
    await load();
    $('#flt-status').addEventListener('change', applyFilters);
    $('#flt-type').addEventListener('change', applyFilters);
    applyFilters();
  }

  async function load() {
    const { data, error } = await window.sb
      .from('requests').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    state.all = data || [];
  }

  function applyFilters() {
    const status = $('#flt-status').value;
    const type   = $('#flt-type').value;
    let rows = state.all;
    if (status) rows = rows.filter((r) => r.status === status);
    if (type)   rows = rows.filter((r) => r.type === type);
    renderTable(rows);
  }

  function renderTable(rows) {
    const tbody = $('#requests-body');
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted" style="padding: 32px; text-align: center;">
        Новых запросов нет. Отличная работа!
      </td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((r) => {
      const typeIcon = ({ case: '🔍', question: '❓', speaker_proposal: '🎤' })[r.type] || '•';
      const status = r.status || 'new';
      const badgeClass = App.REQUEST_STATUS_BADGE[status] || 'badge-gray';
      return `
        <tr>
          <td class="muted" style="white-space: nowrap;">${App.formatDate(r.created_at)}</td>
          <td>${typeIcon} ${App.escapeHtml(App.REQUEST_TYPE_LABELS[r.type] || r.type)}</td>
          <td>${App.escapeHtml(r.capitan_name || '')}</td>
          <td>${tgLink(r.tg_handle)}</td>
          <td class="muted">${App.escapeHtml(r.city || '—')}</td>
          <td><span class="badge ${badgeClass}">${App.REQUEST_STATUS_LABELS[status]}</span></td>
          <td><button type="button" class="btn-ghost text-sm" data-open="${r.id}">Открыть</button></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-open]').forEach((btn) =>
      btn.addEventListener('click', () => openDetail(btn.dataset.open))
    );
  }

  function tgLink(h) {
    if (!h) return '—';
    const clean = String(h).replace(/^@/, '');
    return `<a href="https://t.me/${App.escapeHtml(clean)}" target="_blank" rel="noopener" style="color: var(--color-accent);">@${App.escapeHtml(clean)}</a>`;
  }

  // ---- детали -------------------------------------------------------------
  function openDetail(id) {
    state.currentId = id;
    const r = state.all.find((x) => x.id === id);
    if (!r) return;

    const fieldsByType = {
      case: [
        ['Контекст', r.context],
        ['Сложность', r.difficulty],
        ['Что пробовал', r.tried],
        ['Желаемый результат', r.desired_result],
      ],
      question: [['Текст вопроса', r.question_text]],
      speaker_proposal: [
        ['Тема', r.proposed_topic],
        ['Предполагаемый спикер', r.proposed_speaker],
        ['Формат', App.EVENT_FORMAT_LABELS[r.proposed_format] || r.proposed_format],
        ['Зачем капитанам', r.proposal_description],
      ],
    }[r.type] || [];

    const detailHtml = fieldsByType.map(([label, val]) => `
      <div class="mb-4">
        <div class="field-label" style="margin-bottom: 4px;">${App.escapeHtml(label)}</div>
        <div style="white-space: pre-wrap;">${App.escapeHtml(val || '—')}</div>
      </div>
    `).join('');

    const body = $('#detail-body');
    body.innerHTML = `
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <div class="text-xs muted mb-1">${App.escapeHtml(App.REQUEST_TYPE_LABELS[r.type] || r.type)} · ${App.formatDate(r.created_at)}</div>
          <h2 class="font-display text-xl" style="font-weight: 600;">${App.escapeHtml(r.capitan_name)}</h2>
          <div class="text-sm mt-1">${tgLink(r.tg_handle)}${r.city ? ' · ' + App.escapeHtml(r.city) : ''}</div>
        </div>
        <button type="button" id="detail-close" class="btn-ghost">Закрыть</button>
      </div>
      <hr class="divider" />
      ${detailHtml}
      <hr class="divider" />
      <div class="mb-4">
        <label class="field-label" for="d-notes">Мои пометки</label>
        <textarea id="d-notes" class="textarea">${App.escapeHtml(r.my_notes || '')}</textarea>
      </div>
      <div class="flex flex-wrap items-end gap-3 mb-2">
        <div>
          <label class="field-label" for="d-status">Статус</label>
          <select id="d-status" class="select" style="min-width: 180px;">
            ${['new','in_progress','answered','closed'].map((s) => `
              <option value="${s}" ${r.status === s ? 'selected' : ''}>${App.REQUEST_STATUS_LABELS[s]}</option>
            `).join('')}
          </select>
        </div>
        <button type="button" id="d-save" class="btn btn-primary">Сохранить</button>
      </div>
      <div class="text-xs muted mt-2">
        ${r.answered_at ? 'Отвечен: ' + App.formatDate(r.answered_at) + ' · ' : ''}
        ${r.closed_at ? 'Закрыт: ' + App.formatDate(r.closed_at) : ''}
      </div>
    `;

    $('#detail-modal').style.display = 'flex';
    document.getElementById('detail-close').addEventListener('click', closeDetail);
    document.getElementById('d-save').addEventListener('click', saveDetail);
  }

  function closeDetail() {
    $('#detail-modal').style.display = 'none';
    state.currentId = null;
  }

  async function saveDetail() {
    const id = state.currentId;
    if (!id) return;
    const r = state.all.find((x) => x.id === id);
    const newStatus = document.getElementById('d-status').value;
    const notes = document.getElementById('d-notes').value;

    const patch = { status: newStatus, my_notes: notes };
    if (newStatus === 'answered' && !r.answered_at) patch.answered_at = new Date().toISOString();
    if (newStatus === 'closed'   && !r.closed_at)   patch.closed_at   = new Date().toISOString();

    const btn = document.getElementById('d-save');
    btn.disabled = true;
    btn.textContent = 'Сохраняем…';
    const { error } = await window.sb.from('requests').update(patch).eq('id', id);
    btn.disabled = false;
    btn.textContent = 'Сохранить';

    if (error) { console.error(error); App.toast('Ошибка сохранения'); return; }
    App.toast('Сохранено');
    Object.assign(r, patch);
    closeDetail();
    applyFilters();
  }
})();

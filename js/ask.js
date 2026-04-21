// Форма обращения: выбор типа, динамические поля, валидация, отправка в requests.

(function () {
  const $ = (s) => document.querySelector(s);

  const state = { type: null };

  window.Auth.requireCaptain().then((ok) => { if (ok) init(); });

  function init() {
    prefillFromSession();
    bindTypeCards();
    bindForm();
    bindSendAnother();
  }

  // -------------------------------------------------------------------------
  function prefillFromSession() {
    const handle = window.Auth.getCurrentHandle();
    if (handle) $('#r-tg').value = handle;
  }

  function bindTypeCards() {
    const cards = document.querySelectorAll('.type-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => selectType(card.dataset.type));
    });
  }

  function selectType(type) {
    state.type = type;
    document.querySelectorAll('.type-card').forEach((c) => {
      c.classList.toggle('is-selected', c.dataset.type === type);
      const radio = c.querySelector('input[type="radio"]');
      if (radio) radio.checked = c.dataset.type === type;
    });
    document.querySelectorAll('.type-fields').forEach((block) => {
      block.style.display = block.dataset.fields === type ? 'block' : 'none';
    });
    $('#type-hint').style.display = 'none';
    $('#form-submit').disabled = false;
  }

  // -------------------------------------------------------------------------
  function bindForm() {
    $('#request-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#form-error').classList.remove('is-visible');

      if (!state.type) return;

      const base = {
        type:         state.type,
        capitan_name: $('#r-name').value.trim(),
        tg_handle:    window.Auth.normalizeHandle($('#r-tg').value),
        city:         $('#r-city').value.trim() || null,
      };

      // обязательные: имя + хэндл всегда
      if (!base.capitan_name || !base.tg_handle || base.tg_handle === '@') {
        return showError();
      }

      let payload;
      if (state.type === 'case') {
        const context        = $('#r-context').value.trim();
        const difficulty     = $('#r-difficulty').value.trim();
        const tried          = $('#r-tried').value.trim();
        const desired_result = $('#r-desired').value.trim();
        if (!context || !difficulty || !tried || !desired_result) return showError();
        payload = { ...base, context, difficulty, tried, desired_result };
      } else if (state.type === 'question') {
        const question_text = $('#r-question').value.trim();
        if (!question_text) return showError();
        payload = { ...base, question_text };
      } else if (state.type === 'speaker_proposal') {
        const proposed_topic       = $('#r-topic').value.trim();
        const proposed_speaker     = $('#r-speaker').value.trim();
        const proposed_format      = $('#r-format').value;
        const proposal_description = $('#r-description').value.trim();
        if (!proposed_topic || !proposed_speaker || !proposed_format || !proposal_description) {
          return showError();
        }
        payload = { ...base, proposed_topic, proposed_speaker, proposed_format, proposal_description };
      }

      const btn = $('#form-submit');
      btn.disabled = true;
      btn.textContent = 'Отправляем…';

      const { error } = await window.sb.from('requests').insert(payload);

      if (error) {
        console.error(error);
        App.toast('Не получилось отправить. Попробуй ещё раз.');
        btn.disabled = false;
        btn.textContent = 'Отправить';
        return;
      }

      showThanks();
    });
  }

  function showError() {
    $('#form-error').classList.add('is-visible');
    $('#form-error').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showThanks() {
    $('#form-section').style.display = 'none';
    const thanks = $('#thanks-section');
    thanks.style.display = 'block';
    thanks.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindSendAnother() {
    $('#send-another').addEventListener('click', () => {
      const form = $('#request-form');
      form.reset();
      prefillFromSession();
      state.type = null;
      document.querySelectorAll('.type-card').forEach((c) => c.classList.remove('is-selected'));
      document.querySelectorAll('.type-fields').forEach((b) => { b.style.display = 'none'; });
      $('#type-hint').style.display = 'block';
      const submit = $('#form-submit');
      submit.disabled = true;
      submit.textContent = 'Отправить';
      $('#form-error').classList.remove('is-visible');
      $('#thanks-section').style.display = 'none';
      $('#form-section').style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();

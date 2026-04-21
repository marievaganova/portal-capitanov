// Подключение Supabase. Эти ключи публичные (anon/publishable) — их можно коммитить.
// Service-role ключ на фронтенд не попадает никогда.
(function () {
  const SUPABASE_URL = 'https://fisfizutyunfutphbvxk.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_8UG5Xjlfs0EAdo5vhiTjXQ_M4vkShIh';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase JS SDK не загружен до supabase-config.js');
    return;
  }

  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
})();

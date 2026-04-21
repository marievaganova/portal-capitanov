-- ============================================================================
-- Портал капитанов — начальная миграция
-- Выполнить один раз в Supabase SQL Editor (Project → SQL Editor → New query).
-- Идемпотентность: используются IF NOT EXISTS / DROP TRIGGER IF EXISTS, так что
-- повторный запуск миграции безопасен.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Категории (справочник)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Набор и старт', 'nabor-i-start', 1),
  ('Встречи и разборы', 'vstrechi-i-razbory', 2),
  ('Сложные ситуации', 'slozhnye-situatsii', 3),
  ('Роль капитана', 'rol-kapitana', 4),
  ('Формат десятки', 'format-desyatki', 5)
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Спикеры
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS speakers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tg_handle TEXT,
  photo_url TEXT,
  bio_md TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. Статьи базы знаний
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES categories(id),
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. Мероприятия
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE,
  format TEXT CHECK (format IN ('workshop', 'tg_live', 'meetup', 'talk')),
  category_id UUID REFERENCES categories(id),
  tags TEXT[] DEFAULT '{}',
  speaker_id UUID REFERENCES speakers(id),
  video_url TEXT,
  materials_urls TEXT[] DEFAULT '{}',
  workbook_url TEXT,
  summary_md TEXT,
  likes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. Обращения (три типа в одной таблице)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('case', 'question', 'speaker_proposal')),
  created_at TIMESTAMPTZ DEFAULT now(),
  capitan_name TEXT NOT NULL,
  tg_handle TEXT NOT NULL,
  city TEXT,
  context TEXT,
  difficulty TEXT,
  tried TEXT,
  desired_result TEXT,
  question_text TEXT,
  proposed_speaker TEXT,
  proposed_topic TEXT,
  proposed_format TEXT,
  proposal_description TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'answered', 'closed')),
  my_notes TEXT,
  answered_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 6. Аннотации (обратная связь на контент)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('article', 'event')),
  content_id UUID NOT NULL,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('outdated', 'not_applicable', 'suggest_alternative', 'other')),
  reference_text TEXT,
  body TEXT NOT NULL,
  author_name TEXT,
  author_tg TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. Лайки (дедупликация по tg_handle)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('article', 'event')),
  content_id UUID NOT NULL,
  tg_handle TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (content_type, content_id, tg_handle)
);

-- ----------------------------------------------------------------------------
-- 8. Whitelist капитанов
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allowed_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tg_handle TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Стартовый whitelist: владелец портала
INSERT INTO allowed_users (tg_handle) VALUES ('@my_metodolog')
ON CONFLICT (tg_handle) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Триггер updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_updated_at ON articles;
CREATE TRIGGER articles_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- Инкремент просмотров статьи (вызывается из JS через RPC)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_views(article_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE articles SET views = views + 1 WHERE id = article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Индексы для ускорения поиска и фильтров
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_tags ON articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category_id);
CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_annotations_content ON annotations(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_likes_content ON likes(content_type, content_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE speakers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_users  ENABLE ROW LEVEL SECURITY;

-- ---- SELECT (чтение) ----
DROP POLICY IF EXISTS "Public read categories"    ON categories;
CREATE POLICY "Public read categories"    ON categories    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read articles"      ON articles;
CREATE POLICY "Public read articles"      ON articles      FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read events"        ON events;
CREATE POLICY "Public read events"        ON events        FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read speakers"      ON speakers;
CREATE POLICY "Public read speakers"      ON speakers      FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read allowed_users" ON allowed_users;
CREATE POLICY "Public read allowed_users" ON allowed_users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read likes"         ON likes;
CREATE POLICY "Public read likes"         ON likes         FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read requests"      ON requests;
CREATE POLICY "Public read requests"      ON requests      FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read annotations"   ON annotations;
CREATE POLICY "Public read annotations"   ON annotations   FOR SELECT USING (true);

-- ---- INSERT (капитаны шлют обращения, аннотации, ставят лайки) ----
DROP POLICY IF EXISTS "Public insert requests"    ON requests;
CREATE POLICY "Public insert requests"    ON requests    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert annotations" ON annotations;
CREATE POLICY "Public insert annotations" ON annotations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert likes"       ON likes;
CREATE POLICY "Public insert likes"       ON likes       FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete likes"       ON likes;
CREATE POLICY "Public delete likes"       ON likes       FOR DELETE USING (true);

-- ---- ВЕСЬ CRUD для админки через anon key ----
-- На MVP защита админки — через пароль на фронтенде (js/admin-config.js).
-- Это упрощённая схема: технически продвинутый пользователь сможет писать
-- в БД напрямую через консоль с anon key. Для одного владельца-оунера на
-- старте нормально; при росте — вынести CRUD в Vercel Serverless Functions
-- с service_role key и заменить эти политики на auth.role() = 'service_role'.

DROP POLICY IF EXISTS "Admin write articles"      ON articles;
CREATE POLICY "Admin write articles"      ON articles      FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin write events"        ON events;
CREATE POLICY "Admin write events"        ON events        FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin write speakers"      ON speakers;
CREATE POLICY "Admin write speakers"      ON speakers      FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin write allowed_users" ON allowed_users;
CREATE POLICY "Admin write allowed_users" ON allowed_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin update requests"     ON requests;
CREATE POLICY "Admin update requests"     ON requests     FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin delete requests"     ON requests;
CREATE POLICY "Admin delete requests"     ON requests     FOR DELETE USING (true);

DROP POLICY IF EXISTS "Admin delete annotations"  ON annotations;
CREATE POLICY "Admin delete annotations"  ON annotations  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Admin update articles_counters" ON articles;
-- (UPDATE на articles уже покрыт политикой "Admin write articles" — лайки и
-- инкремент views тоже через неё)

DROP POLICY IF EXISTS "Admin update events_counters"   ON events;
-- (аналогично для events)

DROP POLICY IF EXISTS "Admin write categories"    ON categories;
CREATE POLICY "Admin write categories"    ON categories    FOR ALL USING (true) WITH CHECK (true);

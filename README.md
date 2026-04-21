# Портал капитанов

Веб-портал для капитанов десяток бизнес-сообщества «Аномалия».

## Стек

- Vanilla HTML/CSS/JS + Tailwind CSS (CDN)
- Supabase (PostgreSQL) — backend и БД
- Vercel — хостинг
- marked.js + DOMPurify — markdown-рендер
- Google Fonts: Oswald + Mulish

## Как запустить миграцию БД

1. Открой проект в Supabase → SQL Editor → New query.
2. Скопируй содержимое `supabase/migrations/0001_init.sql` в редактор.
3. Нажми **Run**.
4. Проверь: должны появиться 8 таблиц и 5 категорий.

```sql
-- быстрая проверка
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
SELECT name FROM categories ORDER BY sort_order;
SELECT tg_handle FROM allowed_users;
```

## Деплой

Репозиторий подключён к Vercel. Каждый push в `main` автоматически деплоится.

## Структура

```
.
├── index.html               # Экран авторизации
├── library.html             # Главная — библиотека
├── article.html             # Страница статьи
├── event.html               # Страница мероприятия
├── ask.html                 # Форма обращения
├── admin*.html              # Админка (7 страниц)
├── css/styles.css           # Кастомные стили поверх Tailwind
├── js/                      # Вся логика
├── img/                     # Статичные картинки
├── supabase/migrations/     # SQL-миграции
└── vercel.json              # Конфигурация Vercel
```

## Этапы разработки

- [x] Этап 1 — База данных (SQL-миграция)
- [ ] Этап 2 — Авторизация + каркас навигации
- [ ] Этап 3 — Библиотека + страницы статьи и мероприятия
- [ ] Этап 4 — Форма обращений
- [ ] Этап 5 — Админка (7 страниц)
- [ ] Этап 6 — Финализация (responsive, favicon, vercel.json, README)

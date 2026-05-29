# @iskcon/api

ISKCON Platform API — Cloudflare Worker (Hono + Zod + TypeScript) поверх **D1** (SQLite), **KV** (кэш) и **R2** (файлы, после активации).
Стек повторяет `apartsales/apps/api`, но БД — D1 вместо Supabase.

## Эндпоинты (v1)
- `GET  /v1/health` — проверка KV + D1
- `GET  /v1/centers` — локатор центров: фильтры `country,city,type,q` + гео `lat,lng,radius_km`
- `GET  /v1/centers/:slug` — профиль центра + расписание + божества
- `POST /v1/centers` — создать центр (auth; автор становится админом)
- `PATCH /v1/centers/:id` — обновить (auth + админ центра)
- `GET  /v1/calendar/festivals` — глобальный календарь Вайшнавов
- `GET  /v1/calendar/events` — локальные события (`?center=slug&from=&to=`)

## Ресурсы Cloudflare (уже созданы)
| Ресурс | prod | staging |
|---|---|---|
| D1 | `iskcon-db` (`6226aded-…`) | `iskcon-db-staging` (`7b7f1995-…`) |
| KV | `iskcon-cache` (`de827666…`) | `iskcon-cache-staging` (`cc34a928…`) |

Схема ядра применена к `iskcon-db`. Для staging: `bun run db:migrate:staging`.

## Локальная разработка
```bash
bun install
cd apps/api
wrangler dev            # http://localhost:8787
```

## Деплой
Рекомендуется **Cloudflare Git Integration** (как в apartsales):
Cloudflare → Workers & Pages → Create → Workers → Connect to Git →
репозиторий `billionsx/iskcon`, root dir `apps/api`. CF сам собирает и деплоит.

Альтернатива — вручную:
```bash
wrangler secret put JWT_SECRET --env production   # один раз
bun run deploy:prod
```

До привязки домена API доступен на `iskcon-api.<account>.workers.dev`.

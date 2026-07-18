# Переезд домена: gaurangers.com → brajs.com → iskcone.com

Канонический хост живёт в **одном месте** — `apps/web/src/routes.ts`,
константа `SITE_HOST` (ЗКН-Н087). Всё остальное выводится: origin, канонический
301, redirect_uri провайдеров входа, адрес отправителя писем, пробы CI, сброс
кэша зоны. Гейт `infra-audit.py::check_n087` не даёт вернуть домен строкой
и следит, что маршруты `wrangler.toml` покрывают все хосты реестра.

**Состояние на 18.07.2026:** канонический и единственный домен — **brajs.com**.
gaurangers.com снят с проекта: маршрутов воркера нет, домен ему не принадлежит.

Приложение живёт РОВНО на одном хосте. Любой другой хост, на котором воркер
вдруг исполнился, уводится на канонический 301-м. Списочное правило («редиректим
вот эти домены») оказалось хрупким: снимаешь домен с проекта, а `custom_domain`
в Cloudflare остаётся привязанным — и снятый хост начинает отдавать ВТОРУЮ живую
копию приложения. Теперь редиректится всё, что не канон, кроме служебного
`workers.dev` (на нём деплой проверяет свежесть бандла).

Когда прежний домен нужно СОХРАНИТЬ как 301-алиас (разошлись ссылки и QR-коды —
ЗКН-Н023, правило 6), он кладётся в `ALIAS_HOSTS` и получает маршруты в
`wrangler.toml`. Когда снимается совсем — переезжает в `RETIRED_HOSTS`, и гейт
следит, чтобы он не вернулся в маршруты случайно.

---

## Порядок жёсткий

Домен → почта → провайдеры входа. Не наоборот: `redirect_uri`, зарегистрированный
у Apple/Google/Яндекса/VK, обязан совпадать с **каноническим** хостом символ в
символ. Заводить их на gaurangers.com, чтобы через неделю переделывать на
brajs.com, — двойная работа и гарантированный `redirect_uri_mismatch`.

---

## Этап 1 · brajs.com в Cloudflare (делает основатель)

Пока зоны нет в аккаунте Cloudflare, привязать к ней воркер **нельзя**:
`wrangler deploy` упадёт на неизвестном custom_domain и уронит весь деплой.
Поэтому это первый шаг и он не мой.

1. У регистратора brajs.com **выключить DNSSEC** (иначе зона не активируется).
2. **https://dash.cloudflare.com** → кнопка **+ Add** → **Connect a domain**
   (в старом интерфейсе — *Add a Site*) → ввести `brajs.com` → **Continue**.
3. План — **Free** → Continue.
4. Cloudflare покажет два своих nameserver'а вида `xxx.ns.cloudflare.com`.
   Скопировать оба.
5. У регистратора brajs.com заменить nameservers на эти два. Других быть не должно.
6. Ждать статус зоны **Active** (обычно 15 минут — 2 часа, иногда до суток).
   Проверка: dash.cloudflare.com → brajs.com → статус в шапке.
7. Сообщить мне: «brajs.com активен».

Аккаунт Cloudflare должен быть **тот же**, где живёт воркер `iskcon-web`
(account_id `d5cbe19470dc38599873eabfe148e6d1`).

---

## Этап 2 · Переключение (делаю я, одним коммитом)

1. `apps/web/src/routes.ts`:
   ```ts
   export const SITE_HOST = "brajs.com";
   export const ALIAS_HOSTS = ["gaurangers.com"];
   ```
2. `apps/web/wrangler.toml` — четыре маршрута: `brajs.com`, `www.brajs.com`,
   `gaurangers.com`, `www.gaurangers.com`. Гейт Н087 проверит покрытие.
3. Деплой. После него:
   * `https://brajs.com` — сайт;
   * `https://gaurangers.com/что-угодно` → 301 → `https://brajs.com/что-угодно`;
   * пробы CI и сброс кэша зоны сами перешли на brajs.com (читают `SITE_HOST`).

Что при этом **не** ломается: в D1 домена нет вовсе (проверено: ни в
`content_items.hero_image`, ни в `app_config`). Сессии кабинета привязаны к хосту
cookie, но пользователей 0 — терять нечего.

---

## Этап 3 · Почта на brajs.com

`MAIL_HOST` — отдельная константа НАМЕРЕННО: почтовый домен считается рабочим
только после верификации, а это не тот же момент, что переезд сайта.

1. **Cloudflare → brajs.com → Email → Email Routing** → Get started →
   Cloudflare сам добавит MX и SPF в DNS зоны.
   В **Destination addresses** подтвердить `support@billionsx.com`
   (на него уходят отчёты и заказы).
2. **https://resend.com** → **Domains** → **Add Domain** → `brajs.com`.
3. Resend покажет TXT (SPF/DKIM) и, возможно, MX. Завести их:
   Cloudflare → brajs.com → **DNS** → **Add record**, каждая запись как показана,
   **Proxy status = DNS only** (серое облако).
4. Resend → **Verify**. Обычно 5–30 минут.
5. **API Keys** → **Create API Key** → права *Sending access* → ключ `re_…`
   показывается один раз.
6. Сказать мне «почта brajs.com подтверждена» → переключаю `MAIL_HOST` и кладу
   `resend_api_key` в `app_config`.

---

## Этап 4 · Провайдеры входа (после этапа 2)

Redirect URI для brajs.com — символ в символ, без `www`, без слэша на конце:

| провайдер | адрес |
|---|---|
| apple | `https://brajs.com/api/auth/oauth/apple/callback` |
| google | `https://brajs.com/api/auth/oauth/google/callback` |
| yandex | `https://brajs.com/api/auth/oauth/yandex/callback` |
| vk | `https://brajs.com/api/auth/oauth/vk/callback` |

Пошагово по каждой консоли — `docs/OAUTH_setup.md`. Домен там подставлять
brajs.com: в *Базовый домен* (VK), *Authorized domains* (Google),
*Domains and Subdomains* (Apple).

Apple дополнительно проверяет домен файлом
`/.well-known/apple-developer-domain-association.txt` — воркер отдаёт его из
`app_config` (ключ `apple_domain_association`) **до** канонизации, поэтому
проверка проходит и на brajs.com, и на любом следующем домене.

---

## Этап 5 · Второй бэкенд (не срочно)

`API_HOST` = `api.gaurangers.com` — отдельный воркер `apps/api` со своей зоной.
Воркер сайта ходит туда **сервер-к-серверу**, браузер этот адрес не видит,
поэтому переезд сайта его не ломает и торопиться некуда. Когда дойдут руки:
custom_domain `api.brajs.com` в `apps/api/wrangler.toml` → деплой api →
`API_HOST` в реестре.

---

## Переезд на iskcone.com

Тот же этап 1 для iskcone.com, затем:

```ts
export const SITE_HOST = "iskcone.com";
export const ALIAS_HOSTS = ["brajs.com", "gaurangers.com"];
```

плюс маршруты в `wrangler.toml` и новые redirect_uri в четырёх консолях.
Всё остальное — origin, 301 со всех прежних доменов, пробы CI, письма —
переезжает само.

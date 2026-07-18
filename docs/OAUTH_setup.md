# Ключи входа: Apple · Google · Яндекс ID · VK ID · Resend

Код входа целиком в проде. Не хватает только ключей провайдеров — их выдаёт
живой человек в консоли каждой компании. Этот файл — точный маршрут кликов.

**Куда кладутся ключи:** таблица D1 `app_config` (пара `key` / `value`), как
VAPID у пушей. Провайдер загорается в приложении **сразу**, без деплоя:
`GET /api/auth/providers` читает конфиг на каждом запросе.

> **Домен.** Рабочим доменом становится **brajs.com** (см. `docs/DOMAIN_migration.md`).
> Ключи провайдеров заводятся ПОСЛЕ переезда домена — `redirect_uri` обязан
> совпадать с каноническим хостом символ в символ, иначе `redirect_uri_mismatch`.
> Канонический хост всегда виден в `apps/web/src/routes.ts` → `SITE_HOST`.

**Redirect URI — один шаблон для всех:**

```
https://brajs.com/api/auth/oauth/<провайдер>/callback
```

| провайдер | точный адрес |
|---|---|
| apple | `https://brajs.com/api/auth/oauth/apple/callback` |
| google | `https://brajs.com/api/auth/oauth/google/callback` |
| yandex | `https://brajs.com/api/auth/oauth/yandex/callback` |
| vk | `https://brajs.com/api/auth/oauth/vk/callback` |

Символ в символ. Лишний `/` на конце или `www.` = ошибка `redirect_uri_mismatch`
и вход не работает. Домен указываем **без www**: воркер делает 301 с www на apex,
а проверялки провайдеров по редиректам не ходят.

---

## 1. VK ID — 10 минут, паспорт не нужен

1. Открыть **https://id.vk.com/about/business/go** → войти своим VK.
2. **Создать приложение**. Название: `ISKCON ONE LOVE`. Иконку — логотип.
3. Платформа — **Веб**.
   * *Базовый домен*: `brajs.com`
   * *Доверенный Redirect URL*: адрес из таблицы выше.
4. Вкладка **Авторизация** → в «Данные для регистрации» включить **Почта**.
5. Скопировать **ID приложения** — это `client_id`.

Секрет не нужен: используется PKCE (`code_challenge=S256`).

```
oauth_vk_client_id = <ID приложения>
```

---

## 2. Яндекс ID — 10 минут

1. Открыть **https://oauth.yandex.ru/client/new/id/** (именно `/id/` — это форма
   для «Входа с Яндекс ID»; форма без `/id/` — для доступа к API Яндекса).
2. *Название сервиса*: `ISKCON ONE LOVE`, иконка, контактная почта.
3. Платформы → **Веб-сервисы** → *Redirect URI*: адрес из таблицы выше.
4. **Доступ к данным** — три права:
   * `login:email` — адрес почты
   * `login:info` — имя и пол
   * `login:avatar` — портрет
5. Сохранить. На карточке приложения будут **ClientID** и **Client secret**.

```
oauth_yandex_client_id     = <ClientID>
oauth_yandex_client_secret = <Client secret>
```

---

## 3. Google — 15 минут

Консоль переименована в **Google Auth Platform** (разделы Branding / Audience /
Data Access / Clients). Старые инструкции в интернете ведут в исчезнувшие меню.

1. **https://console.cloud.google.com/projectcreate** → проект `iskcon-one-love`.
2. **https://console.cloud.google.com/auth/overview** → **Get started**:
   * *App name*: `ISKCON ONE LOVE`, *User support email*: свой ящик
   * *Audience*: **External** — единственный рабочий вариант для публичного
     сайта. Поменять потом нельзя, только новым проектом.
   * *Contact information*: свой ящик → Finish.
3. **https://console.cloud.google.com/auth/branding** → *Authorized domains*
   добавить `brajs.com`.
4. **https://console.cloud.google.com/auth/clients** → **Create client**:
   * *Application type*: **Web application**
   * *Name*: `gaurangers web`
   * *Authorized JavaScript origins*: `https://brajs.com`
   * *Authorized redirect URIs*: адрес из таблицы выше
   * **Create** → во всплывшем окне **Client ID** и **Client secret**.
5. **https://console.cloud.google.com/auth/audience** → **Publish app**.
   Пока приложение в Testing, войти могут только руками добавленные тест-юзеры.
   Мы просим только `openid email profile` — это несенситивные права, проверка
   Google для публикации не требуется.

```
oauth_google_client_id     = <Client ID>   (…apps.googleusercontent.com)
oauth_google_client_secret = <Client secret>  (GOCSPX-…)
```

---

## 4. Apple — 30 минут, нужен платный аккаунт разработчика ($99/год)

Порядок шагов жёсткий: App ID → Services ID → проверка домена → ключ.

1. **App ID.** https://developer.apple.com/account/resources/identifiers/list →
   **+** → *App IDs* → *App* → Description `ISKCON ONE LOVE`,
   Bundle ID `com.gaurangers.app` → в списке Capabilities включить
   **Sign In with Apple** → Register.
2. **Services ID.** Тот же раздел → **+** → *Services IDs* →
   Description `ISKCON ONE LOVE Web`, Identifier `com.gaurangers.web` → Register.
   > `com.gaurangers.web` — это и есть `client_id` для веба, **не** Bundle ID.
3. Открыть созданный Services ID → галочка **Sign In with Apple** → **Configure**:
   * *Primary App ID*: `com.gaurangers.app`
   * *Domains and Subdomains*: `brajs.com` (**без** www и без `https://`)
   * *Return URLs*: адрес apple из таблицы выше
4. **Проверка домена.** В том же окне — кнопка **Download** рядом с доменом:
   скачается `apple-developer-domain-association.txt`. Открыть его блокнотом,
   **прислать содержимое мне** — я кладу его в `app_config`, и воркер начинает
   отдавать файл по `https://brajs.com/.well-known/apple-developer-domain-association.txt`
   (маршрут уже в проде, до канонизации www→apex, потому что Apple по 301 не ходит).
   После этого — кнопка **Verify** → Continue → Save.
5. **Ключ.** https://developer.apple.com/account/resources/authkeys/list → **+** →
   Key Name `ISKCON ONE LOVE SignIn` → галочка **Sign in with Apple** →
   **Configure** → Primary App ID `com.gaurangers.app` → Save → Continue →
   Register → **Download**. Файл `AuthKey_XXXXXXXXXX.p8` скачивается **один раз**,
   второй раз его не выдадут. Рядом показан **Key ID** (10 знаков).
6. **Team ID** — 10 знаков в правом верхнем углу кабинета, под именем
   (или https://developer.apple.com/account → Membership details).

```
oauth_apple_client_id   = com.gaurangers.web        (Services ID)
oauth_apple_team_id     = <Team ID>                 (10 знаков)
oauth_apple_key_id      = <Key ID>                  (10 знаков)
oauth_apple_private_key = <всё содержимое .p8, вместе со строками BEGIN/END>
apple_domain_association = <содержимое apple-developer-domain-association.txt>
```

`client_secret` Apple мы не храним: воркер подписывает его сам (ES256 JWT из
.p8, живёт 5 минут) на каждый обмен кода.

---

## 5. Resend — письма с кодами

Нужен для восстановления пароля и подтверждения почты. Cloudflare Email Routing
(биндинг `SEB`) шлёт только на подтверждённые адреса аккаунта — произвольному
пользователю письмо им не отправить, поэтому Resend.

1. **https://resend.com** → регистрация.
2. **Domains** → **Add Domain** → `brajs.com` → регион EU.
3. Resend покажет DNS-записи (MX + TXT SPF + TXT DKIM). Добавить их в Cloudflare:
   dash.cloudflare.com → домен `brajs.com` → **DNS** → **Add record**,
   каждую запись как показано, **Proxy status = DNS only** (серое облако).
4. Вернуться в Resend → **Verify**. Обычно 5–30 минут.
5. **API Keys** → **Create API Key**, права *Sending access* → скопировать
   ключ `re_…` (показывается один раз).

```
resend_api_key = re_…
```

---

## Как ключ попадает в приложение

```sql
INSERT INTO app_config (key, value) VALUES (?1, ?2)
  ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now');
```

Проверка, что провайдер поднялся:

```
GET https://brajs.com/api/auth/providers
→ {"providers":{"apple":true,"google":true,"yandex":true,"vk":true}}
```

`true` = кнопка появилась на экране входа и в карточке «Вход и безопасность».
Кнопки нерабочих провайдеров не показываются никогда: кнопка — обещание.

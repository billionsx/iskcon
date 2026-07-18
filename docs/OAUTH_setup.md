# Ключи входа: Яндекс ID · Google · Apple · Resend

Код входа целиком в проде. Не хватает ключей — их выдаёт человек в консоли
каждой компании. Здесь точный маршрут кликов.

**Куда кладутся ключи:** таблица D1 `app_config`. Провайдер загорается в
приложении **сразу**, без деплоя: `GET /api/auth/providers` читает конфиг на
каждом запросе. Мёртвых кнопок не показываем — кнопка есть обещание.

**Redirect URI — один шаблон, символ в символ, без `www` и без слэша в конце:**

| провайдер | адрес |
|---|---|
| yandex | `https://brajs.com/api/auth/oauth/yandex/callback` |
| google | `https://brajs.com/api/auth/oauth/google/callback` |
| apple | `https://brajs.com/api/auth/oauth/apple/callback` |
| vk | `https://brajs.com/api/auth/oauth/vk/callback` — **готово**, ID 54684253 |

Домен приложения меняется (brajs.com → iskcone.com), поэтому идентификаторы
приложений в консолях берём **не от домена**, а от бренда: их нельзя
переименовать после создания.

---

## 1. Яндекс ID — 10 минут, бесплатно

1. **https://oauth.yandex.ru/client/new/id/** — именно с `/id/` на конце. Форма
   без `/id/` — для доступа к API Яндекса, там redirect_uri вообще нельзя менять.
2. Шаг «Название и иконка»: *Название вашего сервиса* — `ISKCON ONE LOVE`,
   иконка (логотип), *Контактная почта* — свою. **Далее**.
3. Шаг «Платформы»: выбрать **Веб-сервисы**.
   *Redirect URI* → `https://brajs.com/api/auth/oauth/yandex/callback`
   *Suggest Hostname* (если просит) → `brajs.com`
4. Шаг «Доступ к данным» — отметить три:
   * `login:email` — адрес почты
   * `login:info` — имя и пол
   * `login:avatar` — портрет
5. **Сохранить**. На карточке приложения появятся **ClientID** и **Client secret**.
6. Прислать оба.

```
oauth_yandex_client_id     = <ClientID>
oauth_yandex_client_secret = <Client secret>
```

---

## 2. Google — 15 минут, бесплатно

Консоль переименована в **Google Auth Platform**; разделы Branding / Audience /
Data Access / Clients. Инструкции в интернете почти все описывают старое меню.

1. **https://console.cloud.google.com/projectcreate** → *Project name*
   `iskcon-one-love` → **Create**. Дождаться создания и убедиться, что вверху
   выбран именно этот проект.
2. **https://console.cloud.google.com/auth/overview** → **Get started**.
   Мастер из четырёх блоков на одной странице:
   * *App name* → `ISKCON ONE LOVE`; *User support email* → свой ящик
   * *Audience* → **External** ← единственный рабочий вариант для публичного
     сайта. Поменять потом нельзя, только новым проектом.
   * *Contact Information* → свой ящик
   * согласиться с политикой → **Create**
3. **https://console.cloud.google.com/auth/branding** → блок *Authorized domains*
   → **Add domain** → `brajs.com` → **Save**.
4. **https://console.cloud.google.com/auth/clients** → **Create client**:
   * *Application type* → **Web application**
   * *Name* → `brajs web`
   * *Authorized JavaScript origins* → **Add URI** → `https://brajs.com`
   * *Authorized redirect URIs* → **Add URI** →
     `https://brajs.com/api/auth/oauth/google/callback`
   * **Create** → во всплывшем окне **Client ID** и **Client secret**.
5. **https://console.cloud.google.com/auth/audience** → **Publish app** →
   подтвердить. Пока приложение в *Testing*, войти могут только вручную
   добавленные тест-пользователи. Мы просим только `openid email profile` —
   права несенситивные, проверка Google для публикации не нужна.
6. Прислать Client ID и Client secret.

```
oauth_google_client_id     = <…apps.googleusercontent.com>
oauth_google_client_secret = <GOCSPX-…>
```

---

## 3. Apple — 30 минут, нужен платный аккаунт разработчика ($99/год)

Порядок жёсткий: App ID → Services ID → проверка домена → ключ.

1. **App ID.** https://developer.apple.com/account/resources/identifiers/list
   → **+** → *App IDs* → **App** → Continue
   * *Description* → `ISKCON ONE LOVE`
   * *Bundle ID* → **Explicit** → `com.iskcone.app`
   * в списке Capabilities отметить **Sign In with Apple**
   * **Continue** → **Register**
2. **Services ID.** Тот же список → **+** → *Services IDs* → Continue
   * *Description* → `ISKCON ONE LOVE Web`
   * *Identifier* → `com.iskcone.web` ← **это и есть `client_id` для веба**, не Bundle ID
   * **Continue** → **Register**
3. Открыть созданный `com.iskcone.web` → поставить галочку **Sign In with Apple**
   → кнопка **Configure**:
   * *Primary App ID* → `com.iskcone.app`
   * *Domains and Subdomains* → `brajs.com` (без `www`, без `https://`)
   * *Return URLs* → `https://brajs.com/api/auth/oauth/apple/callback`
4. **Проверка домена.** В том же окне рядом с доменом — кнопка **Download**:
   скачается `apple-developer-domain-association.txt`. Открыть блокнотом,
   **прислать содержимое мне** — кладу в `app_config`, воркер начинает отдавать
   файл по `https://brajs.com/.well-known/apple-developer-domain-association.txt`
   (маршрут уже в проде, отдаётся до канонизации, потому что Apple по редиректам
   не ходит). После этого — **Verify** → **Continue** → **Save**.
5. **Ключ.** https://developer.apple.com/account/resources/authkeys/list → **+**
   * *Key Name* → `ISKCON ONE LOVE SignIn`
   * галочка **Sign in with Apple** → **Configure** → *Primary App ID* →
     `com.iskcone.app` → **Save**
   * **Continue** → **Register** → **Download**
   * файл `AuthKey_XXXXXXXXXX.p8` скачивается **один раз**, повторно не выдадут
   * рядом показан **Key ID** (10 знаков) — записать
6. **Team ID** — 10 знаков в правом верхнем углу кабинета под именем
   (или https://developer.apple.com/account → *Membership details*).
7. Прислать: Key ID, Team ID и содержимое `.p8` целиком (со строками BEGIN/END).

```
oauth_apple_client_id    = com.iskcone.web
oauth_apple_team_id      = <Team ID>
oauth_apple_key_id       = <Key ID>
oauth_apple_private_key  = <всё содержимое .p8>
apple_domain_association = <содержимое apple-developer-domain-association.txt>
```

`client_secret` Apple не храним: воркер подписывает его сам (ES256 JWT из `.p8`,
живёт 5 минут) на каждый обмен кода.

> Apple умеет отдавать скрытый адрес `@privaterelay.appleid.com`. Вход с ним
> работает, но письма туда дойдут, только если домен-отправитель зарегистрирован
> у Apple в *Sender Domains*. Настроим, когда почта будет на brajs.com.

---

## 4. Почта — Resend, 15 минут

Нужна для кодов восстановления пароля и подтверждения адреса. Через Cloudflare
Email Routing это невозможно: его биндинг шлёт только на подтверждённые адреса
аккаунта, а коды уходят произвольным людям.

1. **https://resend.com** → **Sign up** (можно через Google).
2. Левое меню → **Domains** → **Add Domain**
   * *Domain* → `brajs.com`
   * *Region* → ближайший (EU)
   * **Add**
3. Resend покажет таблицу DNS-записей (обычно MX + два TXT: SPF и DKIM).
   Не закрывать эту вкладку.
4. Во второй вкладке: **https://dash.cloudflare.com** → домен **brajs.com** →
   **DNS** → **Records** → **Add record**. Для КАЖДОЙ строки из Resend:
   * *Type* — как в Resend (MX / TXT)
   * *Name* — скопировать из Resend (часто `send` или `resend._domainkey`)
   * *Content* / *Value* — скопировать из Resend целиком
   * для MX — ещё *Priority*
   * **Proxy status** — если поле есть, поставить **DNS only** (серое облако)
   * **Save**
5. Вернуться в Resend → **Verify DNS Records**. Обычно 5–30 минут.
6. Левое меню → **API Keys** → **Create API Key**
   * *Name* → `iskcon-one-love`
   * *Permission* → **Sending access**
   * *Domain* → `brajs.com`
   * **Add** → ключ `re_…` показывается **один раз**, скопировать.
7. Прислать ключ. Кладу в `app_config` и перевожу `MAIL_HOST` на brajs.com.

```
resend_api_key = re_…
```

---

## Проверка

```
GET https://brajs.com/api/auth/providers
→ {"providers":{"apple":true,"google":true,"yandex":true,"vk":true}}
```

`true` = плитка провайдера появилась на экране входа и в карточке
«Вход и безопасность».

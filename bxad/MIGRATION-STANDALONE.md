# BXAD · ПЕРЕНОС В САМОСТОЯТЕЛЬНЫЙ РЕПОЗИТОРИЙ + ДОМЕН + CLOUDFLARE

Цель: BXAD — отдельный автономный репозиторий, подключаемый к любому проекту
как база·конституция·закон·исполнитель, с эфиром-дашбордом на своём домене.
Всё, что жмётся кнопками владельца аккаунтов, — здесь по шагам; всё, что
код, — уже в каталоге `bxad/` и переезжает без правок логики.

---
## Шаг 1 · Новый репозиторий (2 мин)
1. Открой **https://github.com/new**
2. Owner: `billionsx` · Repository name: **`bxad`**
3. Public (эфир и релизы открыты) → **Create repository** (без README).

## Шаг 2 · Перенос каталога С ИСТОРИЕЙ (5 мин, локально или в Codespace)
```bash
git clone https://github.com/billionsx/iskcon.git && cd iskcon
git subtree split -P bxad -b bxad-only          # история только bxad/
git push https://github.com/billionsx/bxad.git bxad-only:main
```
3. В новом репо workflows лежат в `bxad-only` как файлы каталога — перенести
   руками содержимое `.github/workflows/{bxad.yml, bxad-atlas.yml,
   bxad-macos.yml}` из монорепо в `bxad/.github/workflows/` нового репо и
   поправить пути: `bxad/bin/…` → `bin/…`, триггер-путь `bxad/**` → `**`,
   шаг с `apps/web/src/**` удалить, адаптер `iskcon` заменить на `default`
   (или адаптер подключаемого проекта). Коммит → Actions включатся сами.

## Шаг 3 · Секреты (1 мин)
**https://github.com/billionsx/bxad/settings/secrets/actions** → New secret:
- `FIGMA_TOKEN` / `FIGMA_KIT_KEY` — по `KIT-UNLOCK.md` (опционально).
GITHUB_TOKEN даётся Actions автоматически — ничего вводить не надо.

## Шаг 4 · Cloudflare Pages — эфир на домене (5 мин)
1. **https://dash.cloudflare.com** → аккаунт → **Workers & Pages** →
   **Create** → вкладка **Pages** → **Connect to Git**.
2. Выбери GitHub → авторизуй → репозиторий **billionsx/bxad**.
3. Настройки сборки: Framework preset **None** · Build command — пусто ·
   Build output directory: **`dashboard`** → **Save and Deploy**.
4. Через минуту эфир жив на `https://bxad.pages.dev` и обновляется каждым
   пушем прогонов BXAD автоматически — это и есть прямой эфир.

## Шаг 5 · Свой домен (5 мин)
Вариант А (домен уже на Cloudflare): в проекте Pages → **Custom domains** →
**Set up a custom domain** → введи, например, `bxad.billionsx.com` →
Cloudflare сам создаст CNAME → Activate.
Вариант В (billionsx.com на Тильде — DNS менять нельзя, записи добавлять
можно): апекс не трогаем, эфир живёт на поддомене.
1. В Pages-проекте: **Custom domains → Set up a custom domain** → введи
   `bxad.billionsx.com`. Cloudflare покажет, какую запись создать (CNAME;
   иногда плюс TXT-подтверждение) — оставь вкладку открытой.
2. Там, где сейчас добавляются записи для billionsx.com (панель регистратора
   домена или Tilda → Настройки сайта → Домен → DNS-записи), добавь:
   Тип **CNAME** · Имя/Host **bxad** · Значение **bxad.pages.dev** · TTL авто.
   Если Cloudflare попросил TXT — добавь и её тем же способом.
3. Вернись в Cloudflare → кнопка **Check DNS / Activate** (проверка до
   10–30 мин). Тильда и главный сайт не затрагиваются вообще.
Вариант Б (домена нет): dash.cloudflare.com → **Domain Registration** →
**Register domain** → купи (например `bxad.dev`) → затем Вариант А.

## Шаг 6 · Подключение BXAD к любому проекту (3 команды)
```bash
git submodule add https://github.com/billionsx/bxad.git bxad
python3 bxad/bin/bxad.py attach --project <имя> --globs "src/**/*.css,src/**/*.tsx"
cp bxad/.github/workflows/bxad.yml .github/workflows/   # суд+храповик на пуши
```
Адаптер проекта появляется в `bxad/adapters/<имя>.json`; храповик прибивает
нулевой долг; дальше конституция и законы BXAD правят продакшн проекта.

## Шаг 7 · Кадротека-релиз (1 мин)
В новом репо: **Releases → Draft a new release** → tag `bxad-screens-v1` →
прикрепить `Apple_Apps_iOS27.zip` (скачать из релиза монорепо:
https://github.com/billionsx/iskcon/releases/tag/bxad-screens-v1) → Publish.

---
Проверка бесшовности: Actions зелёные · эфир `bxad.pages.dev` дышит ·
`python3 bin/bxad.py selftest` = 45/45 · монорепо-копия каталога может быть
заморожена (история сохранена сплитом).

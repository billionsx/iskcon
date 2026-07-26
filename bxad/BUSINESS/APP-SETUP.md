# СЛУЖБА · подключение клиентов (M7)

## Путь А — уже работает, без GitHub App (клиенту 2 минуты)
Клиент кладёт в свой репозиторий файл `.github/workflows/bxad.yml`:
```yaml
name: bxad
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  review:
    uses: billionsx/iskcon/.github/workflows/bxad-review-reusable.yml@main
    with:
      globs: "src/**/*.css,src/**/*.tsx"   # свои пути
      project: "acme"
```
Всё: каждый PR клиента получает построчное ревью числами законов BXAD.
Ограничение пути А: repo с reusable-workflow должен быть публичным (наш —
публичный) — выполняется.

## Путь Б — GitHub App (установка в 1 клик, биллинг, приватность)
1. Открой **https://github.com/settings/apps/new** (или в организации:
   Settings → Developer settings → GitHub Apps → New GitHub App).
2. Поля: GitHub App name **BXAD Review** · Homepage — эфир/лендинг ·
   Webhook: **Active выкл.** (этап 1 работает через Actions, вебхук не нужен).
3. Permissions → Repository: **Pull requests: Read and write** ·
   **Contents: Read-only**. Subscribe to events — пусто (этап 1).
4. Where can this app be installed → **Any account** → Create GitHub App.
5. На странице приложения: **Generate a private key** → скачается .pem →
   в репо BXAD: Settings → Secrets → Actions → `BXAD_APP_ID` (число со
   страницы App) и `BXAD_APP_PRIVATE_KEY` (содержимое .pem целиком).
6. Установка клиенту: страница App → **Install App** → выбрать аккаунт/репо.
Дальше (мой ход после твоих кнопок): токен App в reusable-workflow вместо
GITHUB_TOKEN — ревью пойдёт от имени «BXAD Review», появится витрина для
Marketplace и привязка к тарифам (M8).

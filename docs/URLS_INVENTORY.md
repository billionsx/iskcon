# ВСЕ АДРЕСА ПРИЛОЖЕНИЯ — на ревизию

Собрано из кода по факту (не по памяти): реестр `routes.ts`, маршрутизатор
`App.tsx`, все литералы в компонентах. Дата: 12 июля 2026, `c097201e`.

Помечено: ✅ по стандарту · ⚠️ спорно, нужно твоё решение · ❌ нарушает стандарт

---

## 1. КОРЕНЬ — САДХАНА

| Адрес | Что открывает | |
|---|---|---|
| `/` | Садхана — «Сегодня» | ✅ |
| `/practice` | Практика | ✅ |
| `/practice/japa` | Счётчик джапы | ✅ |
| `/practice/diary` | Дневник садханы | ✅ |
| `/practice/verse` | Стих дня | ✅ |
| `/practice/vow` | Обеты | ✅ |
| `/practice/progress` | Мой прогресс | ✅ |
| `/practice/darshan` | Даршан | ✅ |
| `/calendar` | Календарь | ✅ |
| `/ekadashi` | Экадаши | ⚠️ Экадаши — часть Календаря. Может быть `/calendar/ekadashi`? |
| `/account` | Кабинет | ✅ |

---

## 2. БОГАТСТВА — ШЕСТЬ ВИТРИН

Каждая витрина — **корень**. Промежуточной папки нет.

| Адрес | Что открывает | |
|---|---|---|
| `/lichnosti` | **Личности** — витрина: три входа | ✅ |
| `/lichnosti/gauranga-lila` | 4-уровневое меню Гауранга Лилы | ✅ |
| `/lichnosti/gauranga-lila/1-volna` | волна | ✅ |
| `/lichnosti/gauranga-lila/1-volna/pancha-tattva` | кластер | ✅ |
| `/lichnosti/krishna-lila` | 4-уровневое меню Кришна Лилы | ✅ |
| `/lichnosti/krishna-lila/madhurya` | раса | ✅ |
| `/lichnosti/shrimad-bhagavatam` | 4-уровневое меню Бхагаватам | ✅ |
| `/lichnosti/shrimad-bhagavatam/mahabharata` | чин | ✅ |
| | | |
| `/books` | **Книги** — витрина | ✅ |
| `/bhajans` | **Бхаджаны** — витрина | ✅ |
| `/bhajans/gaura-arati` | бхаджан | ✅ |
| `/kirtans` | **Киртаны** — витрина | ✅ |
| `/kirtans/<исполнитель>` | исполнитель | ✅ |
| `/prasad` | **Прасад** — витрина | ✅ |
| `/prasad/book` | книга «Кухня прасада» | ✅ |
| `/prasad/book/<глава>` | глава книги | ✅ |
| `/prasad/recipe/<рецепт>` | рецепт | ✅ |
| `/prasad/offering` | подношение Божеству | ✅ |
| `/dhama` | **Дхама** — витрина | ✅ |
| `/dhama/vrindavan` | дхама | ✅ |
| `/dhama/vrindavan/radha-kunda` | место | ✅ |

---

## 3. КНИГА — В КОРНЕ, ПОЛНЫМ ИМЕНЕМ

Не `/book/bs`, не `/books/bs`. **`/brahma-samhita`.**

| Адрес | Книга |
|---|---|
| `/bhagavad-gita` | Бхагавад-гита как она есть |
| `/bhagavad-gita/2/13` | глава 2, стих 13 |
| `/shrimad-bhagavatam` | Шримад-Бхагаватам |
| `/shrimad-bhagavatam/1/2/6` | песнь · глава · стих |
| `/chaitanya-charitamrita` | Шри Чайтанья-чаритамрита |
| `/chaitanya-bhagavata` | Чайтанья-бхагавата |
| `/chaitanya-mangala` | Чайтанья-мангала |
| `/brahma-samhita` | Брахма-самхита |
| `/nektar-predannosti` | Нектар преданности |
| `/nektar-nastavleniy` | Нектар наставлений |
| `/shri-ishopanishad` | Шри Ишопанишад |
| `/bhakti-ratnakara` | Бхакти-ратнакара |
| `/navadvipa-dhama-mahatmya` | Навадвипа-дхама-махатмья |
| `/radha-krishna-ganoddesha-dipika` | Радха-Кришна-ганоддеша-дипика |
| `/gaura-ganoddesha-dipika` | Гаура-ганоддеша-дипика |
| `/vishnu-purana` | Вишну-пурана |
| `/krishna-sandarbha` | Кришна-сандарбха |
| `/govinda-lilamrita` | Говинда-лиламрита |
| `/prabhupada-lilamrita` | Шрила Прабхупада-лиламрита |
| `/na-puti-k-krishne` | На пути к Кришне |
| `/radzha-vidya` | Раджа-видья. Царь знания |
| `/put-k-sovershenstvu` | Путь к совершенству |
| `/po-tu-storonu-rozhdeniya-i-smerti` | По ту сторону рождения и смерти |
| `/sovershenstvo-yogi` | Совершенство йоги |
| `/eshche-odin-shans` | Ещё один шанс |
| `/molitvy-czaricy-kunti` | Молитвы царицы Кунти |
| `/svet-bhagavaty` | Свет Бхагаваты |
| `/siksastaka` | Шри Шикшаштака |
| `/manah-siksa` | Манах-шикша |
| `/mukunda-mala-stotra` | Мукунда-мала-стотра |

⚠️ **Спорные слаги — реши сам:**

| Слаг | Вопрос |
|---|---|
| `radzha-vidya` | Транслит «дж» как `dzh`. Может `radja-vidya` или `raja-vidya`? |
| `molitvy-czaricy-kunti` | «ц» как `cz`. Может `caricy` / `tsaritsy`? |
| `eshche-odin-shans` | Русское название латиницей. Может оставить `still-another-chance`? |
| `nektar-predannosti` | То же. Английский оригинал — `nectar-of-devotion` |
| `siksastaka` | Без диакритики. Может `shikshashtaka`? |

---

## 4. ЛИЧНОСТЬ — В КОРНЕ

| Адрес | |
|---|---|
| `/abhimanyu` · `/balarama` · `/rupa-goswami` · `/prabhupada` | ✅ 730 личностей |

---

## 5. ИСККОН

| Адрес | Что открывает | |
|---|---|---|
| `/iskcon` | ИСККОН — презентация | ✅ |
| `/iskcon/centers` | Центры | ✅ |
| `/iskcon/centers/<id>` | Центр | ✅ |
| `/centers` | Центры (старый) | ❌ дубль `/iskcon/centers` |
| `/my/centers` | Мои центры | ⚠️ `/my/` — лишняя папка. Может `/account/centers`? |
| `/my/centers/new` | Новый центр | ⚠️ то же |
| `/centers/review` | Модерация | ⚠️ то же |
| `/restaurant/<id>` | Ресторан | ⚠️ не в `/iskcon/` |
| `/place/<id>` | Место | ⚠️ что это? Дубль дхамы? |

❌ **В ИСККОН не формируются ссылки по табам и суб-табам** — ты это отметил. Вкладки
презентации (Практика · Дхама · Продолжите путь) **адресов не имеют**: нельзя
поделиться разделом. Требует отдельной работы.

---

## 6. СЛУЖЕБНЫЕ

| Адрес | | |
|---|---|---|
| `/search` | Поиск | ✅ |
| `/favorites` | Избранное | ✅ |
| `/notes` · `/note/<id>` | Заметки | ✅ |
| `/cart` | Корзина | ✅ |
| `/donate` | Пожертвование | ✅ |
| `/admin` · `/downloader` · `/stories-tool` | Инструменты | ✅ скрытые |

---

## 7. ОСТАЛИСЬ НАРУШЕНИЯ — ЧЕСТНО

| Адрес | Проблема |
|---|---|
| `/entity/<id>` | ❌ Лишняя папка. Личность живёт в корне |
| `/person/barsana` | ❌ То же + «barsana» это МЕСТО, а не личность |
| `/dasa/<id>` | ⚠️ Что это? Корень не в стандарте |
| `/doc/<id>` | ⚠️ Документы. Может `/iskcon/docs/<id>`? |
| `/post/<id>` | ⚠️ Посты ленты. Не в стандарте |
| `/read/<...>` | ⚠️ Дубль читалки? |
| `/prasadam` | ❌ Старый корень, остался в поиске |
| `/books/bg` | ❌ Остался в коде (шифр + папка) |

---

## 8. 301 — СТАРЫЕ АДРЕСА ЖИВЫ

Ссылки уже разошлись по закладкам и QR-кодам. Ломать чужую ссылку = ломать обещание.

| Старый | → Новый |
|---|---|
| `/dhana` · `/acharya` | `/lichnosti` |
| `/dhana/books` | `/books` |
| `/dhana/bhajans` | `/bhajans` |
| `/dhana/kirtans` | `/kirtans` |
| `/dhana/prasad` | `/prasad` |
| `/dhana/dhama` | `/dhama` |
| `/book/bg` · `/books/bg` | `/bhagavad-gita` |
| `/bhajan/<s>` | `/bhajans/<s>` |
| `/kirtan/<s>` | `/kirtans/<s>` |
| `/prasadam/<...>` | `/prasad/<...>` |
| `/center/<id>` | `/iskcon/centers/<id>` |
| `/ru/<slug>` | `/bhajans/<slug>` |

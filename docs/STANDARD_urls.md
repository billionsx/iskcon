# СТАНДАРТ АДРЕСОВ — ЗКН-Н023

Адрес — это **обещание**. Человек копирует его, шлёт другу, ставит в закладку,
печатает в QR-коде. Если адрес непредсказуем, ломается доверие, а не удобство.

До этого стандарта в приложении было так:

```
/dhana/shrimad-bhagavatam/mahabharata   ← промежуточная категория «dhana»
/dhana/books                            ← та же категория
/book/bg                                ← а читалка уже НЕ в dhana
/prasadam/recipe/sweet-lassi            ← «prasadam», хотя витрина «prasad»
/ru/bhajans/tulasi                      ← ЧУЖОЙ путь iskcone.com, утёкший в слаг
/abhimanyu                              ← личность в корне
/balarama                               ← и здесь
```

Пять разных логик в одном приложении.

---

## ЗАКОНЫ

### 1. РАЗДЕЛ — ОДИН СЕГМЕНТ В КОРНЕ

Промежуточных категорий НЕТ. `/books`, а не `/dhana/books`.

```
/                Садхана — сегодня
/practice        Практика
/calendar        Календарь
/account         Кабинет

/lichnosti       Личности
/books           Книги
/bhajans         Бхаджаны
/kirtans         Киртаны
/prasad          Прасад
/dhama           Дхама

/iskcon          ИСККОН
```

`/dhana` — служебное слово, для человека оно не значит ничего. Такие слова
в адресе не живут.

### 2. УГЛУБЛЕНИЕ — СЕГМЕНТАМИ ВНИЗ, ПО СМЫСЛУ

Каждый сегмент — шаг внутрь, и каждый читается.

```
/lichnosti/gauranga-lila                     лила
/lichnosti/gauranga-lila/1-volna             волна
/lichnosti/gauranga-lila/1-volna/pancha-tattva   кластер

/books/bg                                    книга
/books/bg/2                                  глава
/books/bg/2/13                               стих

/bhajans/gaura-arati                         бхаджан
/kirtans/aindra-prabhu                       исполнитель

/prasad/recipe/sweet-lassi                   рецепт
/prasad/book/what-is-prasad                  глава книги прасада

/dhama/vrindavan                             дхама
/dhama/vrindavan/radha-kunda                 место

/iskcon/centers                              центры
/iskcon/restaurants                          рестораны
```

### 3. ЛИЧНОСТЬ — В КОРНЕ

```
/abhimanyu    /balarama    /rupa-goswami
```

Это самый частый адрес в приложении: им делятся, его печатают. Он обязан быть
коротким. Личность — не раздел приложения, а **имя**.

### 4. КОРНИ РАЗДЕЛОВ ЗАРЕЗЕРВИРОВАНЫ

Раз личности живут в корне, слаг личности **не может совпасть** с корнем раздела:
иначе `/books` перестанет открывать Книги. Проверяется гейтом (`data-audit.py`).

### 5. НИКАКИХ ЧУЖИХ ПУТЕЙ В СЛАГЕ

Слаг — **имя**, а не путь. У всех 339 бхаджанов слаг был `/ru/gaura-arati` —
чужой путь с сайта-источника, утёкший в нашу базу. Отсюда адреса вида
`gaurangers.com/ru/bhajans/tulasi`: языковой префикс чужого сайта в НАШЕМ адресе.

Слаг: `gaura-arati`. Без слэшей, без языка, без префиксов.

### 6. ОДИН РАЗДЕЛ — ОДИН КОРЕНЬ

Не `/prasad` И `/prasadam` одновременно. Не `/bhajans` И `/bhajan`.
Одно понятие — один корень (ср. ЗКН-Р009 для категорий).

### 7. СТАРЫЙ АДРЕС НЕ ЛОМАЕТСЯ

Ссылки уже разошлись: в закладках, в QR-кодах на печатных материалах.
Старый адрес отвечает **301 → новый**. Ломать чужую ссылку — то же, что
ломать обещание.

---

## КАРТА ПЕРЕЕЗДА

| Было | Стало |
|---|---|
| `/dhana` | `/lichnosti` |
| `/dhana/books` | `/books` |
| `/dhana/bhajans` | `/bhajans` |
| `/dhana/kirtans` | `/kirtans` |
| `/dhana/prasad` | `/prasad` |
| `/dhana/dhama` | `/dhama` |
| `/dhana/gauranga-lila/1-volna` | `/lichnosti/gauranga-lila/1-volna` |
| `/book/bg/2/13` | `/books/bg/2/13` |
| `/bhajan/gaura-arati` | `/bhajans/gaura-arati` |
| `/kirtan/<artist>` | `/kirtans/<artist>` |
| `/prasadam/recipe/<s>` | `/prasad/recipe/<s>` |
| `/prasadam/book/<ch>` | `/prasad/book/<ch>` |
| `/acharya` | `/lichnosti` |
| `/ru/<slug>` (бхаджан) | `/bhajans/<slug>` |
| `/<slug>` (личность) | без изменений |

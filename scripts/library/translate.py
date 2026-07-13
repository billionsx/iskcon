"""
СТАДИЯ 3 — ПЕРЕВОД В СТАНДАРТЕ BBT.  (законы ПР002, ПР003, ПР005)

Переводит стих с PD-оригинала (санскрит/бенгали) на русский в структуре и
регистре Бхактиведанта Бук Траста. Результат — НАША собственность (класс OWN):
это ровно тот путь, который называет docs/LEGAL.md §2.3.

═══ ГЛАВНОЕ ОГРАНИЧЕНИЕ ═══
Машина НЕ ПУБЛИКУЕТ писание. Никогда. Всё, что выходит отсюда, ложится в БД со
статусом `draft`. Приложение рендерит только `published`. Перевести draft в
published может ТОЛЬКО человек-редактор (ПР002).

Причина не бюрократическая. Закон проекта — «ноль выдумки». LLM на объёме
священного текста будет выдумывать: досочинит эпитет, сгладит грамматику,
подставит правдоподобное имя. В карточке личности это ошибка. В шастре — это
апарадха. Поэтому здесь стоит стена, а не пожелание.

Структура выхода — каноническая BBT:
    devanagari  → verses.devanagari
    translit    → verses.translit          (IAST)
    synonyms    → verse_tokens             (пословный перевод)
    translation → verse_texts.translation
    purport     → verse_texts.purport      (только если есть в PD-оригинале!
                                            своих комментариев не сочиняем)
"""
from __future__ import annotations
import json
import os
import pathlib
import re
import sys
import time
import urllib.request

MODEL = "claude-sonnet-4-6"
API = "https://api.anthropic.com/v1/messages"
KEY = os.environ.get("ANTHROPIC_API_KEY", "")

OUT = pathlib.Path("build/library/translated")

# ─────────────────────────────────────────────────────────────────────────────
# СИСТЕМНЫЙ ПРОМПТ. Выжимка docs/STANDARD_canonical_names.md +
# docs/STANDARD_scripture_terms.md. Меняется ТОЛЬКО вместе со стандартом.
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM = """\
Ты — переводчик гаудия-вайшнавских писаний для критического издания ISKCON ONE LOVE.
Переводишь с санскрита/бенгали на русский в структуре и регистре Бхактиведанта Бук
Траста (BBT) — как в русских изданиях Шрилы Прабхупады.

ЗАКОН ПЕРВЫЙ — НОЛЬ ВЫДУМКИ.
• Переводишь ТОЛЬКО то, что есть в оригинале. Ни одного слова сверх.
• Не сочиняешь комментарий (purport). Если в источнике комментария нет — поле пустое.
• Не «улучшаешь» и не сглаживаешь. Тёмное место остаётся тёмным.
• Если не уверен в чтении, форме или значении — ставишь это в "uncertain" и
  объясняешь. Уверенная выдумка хуже честного «не знаю». Это шастра.

РЕГИСТР
• Возвышенный, но ясный. Без архаизмов ради архаизмов и без разговорности.
• Синтаксис русский, не калька с санскрита.

КАНОНИЧЕСКИЕ ИМЕНА (обязательны, замен нет)
• «Шримати Радхарани» — не «Радхарани» в одиночку.
  (В компаундах «Радха-кунда», «игры Радхи и Кришны» — оставляем как есть.)
• «Гауранга Махапрабху» — Навадвипа-лила: рождение, Шачи, Джаганнатха Мишра,
  школа, семейная жизнь, Панча-таттва, санкиртана в Маяпуре, Шриваса Тхакур.
• «Шри Кришна Чайтанья Махапрабху» — ПОСЛЕ санньясы в Катве: Южная Индия,
  Нилачала (Пури), даршан Джаганнатхи, настроение разлуки.
  Различай по контексту стиха. Формы «Шри Чайтанья», «Чайтанья» — ЗАПРЕЩЕНЫ.
• «Шрила Прабхупада» — не «Прабхупада» в одиночку.
• «Гауранга Лила» и «Кришна Лила» — оба слова с заглавной, без дефиса, во всех
  падежах. Форма «Гаура-лила» запрещена.

ТЕРМИНЫ
• Санскритские термины даёшь кириллицей: бхакти, према, дхарма, санкиртана,
  парампара, раса, манджари. Курсив НЕ размечаешь — это делает приложение.
• Имена собственные и вошедшие в русский слова (йога, карма, гуру, мантра,
  аватара) — обычным текстом.

ПОСЛОВНЫЙ ПЕРЕВОД (synonyms)
• Как в BBT: каждое слово оригинала → его значение. Порядок исходный.
• Составные (samāsa) разбиваешь дефисами, как в изданиях BBT.

ЛИЧНОСТИ (entities)
• Если в стихе названа личность — перечисли её в "entities" в канонической форме.
• Гаура-ганоддеша-дипика: если стих отождествляет спутника Гауранги с личностью
  Кришна Лилы — заполни "identity": {"gauranga": "...", "krishna": "..."}.
  Это связь, ради которой существует вся библиотека. Здесь особая точность.
  Не уверен — пиши null. Пустое поле честно; выдуманное отождествление — ложь,
  которая разойдётся по всему миру.

ФОРМАТ ОТВЕТА
Только JSON. Без преамбулы, без markdown-заборов.
{
  "ref": "...",
  "translit": "IAST",
  "synonyms": [{"term":"...","gloss":"..."}],
  "translation": "...",
  "purport": "",
  "entities": ["..."],
  "identity": {"gauranga": null, "krishna": null},
  "uncertain": [],
  "confidence": "high|medium|low"
}"""


def _call(payload: dict, retries: int = 4) -> dict:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        API, data=body, method="POST",
        headers={"content-type": "application/json",
                 "x-api-key": KEY,
                 "anthropic-version": "2023-06-01"},
    )
    last = None
    for a in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read())
        except Exception as e:
            last = e
            time.sleep(2 ** a * 2)
    raise RuntimeError(f"Anthropic API: {last}")


def _parse(data: dict) -> dict:
    text = "".join(b.get("text", "") for b in data.get("content", [])
                   if b.get("type") == "text")
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    return json.loads(text)


def translate_verse(work_id: str, ref: str, devanagari: str,
                    translit: str = "", context: str = "") -> dict:
    """Один стих. Возвращает draft. Ничего не публикует."""
    if not devanagari and not translit:
        # ПР003: нет оригинала — нет и перевода. Молча не выдумываем.
        raise ValueError(f"{work_id} {ref}: нет оригинала (Б003)")

    user = (
        f"Произведение: {work_id}\nСтих: {ref}\n"
        + (f"Контекст главы: {context}\n" if context else "")
        + f"\nДеванагари:\n{devanagari or '—'}\n"
        + f"\nТранслитерация:\n{translit or '—'}\n"
        + "\nПереведи по стандарту. Только JSON."
    )
    data = _call({
        "model": MODEL,
        "max_tokens": 2000,
        "system": SYSTEM,
        "messages": [{"role": "user", "content": user}],
    })
    out = _parse(data)
    out["ref"] = ref
    out["work_id"] = work_id
    out["status"] = "draft"          # ПР002 — жёстко, не параметр
    out["engine"] = MODEL
    out["translated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return out


def translate_file(src: pathlib.Path) -> pathlib.Path:
    """Пачка стихов из parse-стадии (JSONL) → переводы (JSONL, все draft)."""
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / src.name
    done = set()
    if dst.exists():                                   # возобновление после обрыва
        for line in dst.read_text(encoding="utf-8").splitlines():
            if line.strip():
                done.add(json.loads(line)["ref"])

    n_ok = n_low = 0
    with dst.open("a", encoding="utf-8") as fh:
        for line in src.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            v = json.loads(line)
            if v["ref"] in done:
                continue
            try:
                t = translate_verse(v["work_id"], v["ref"],
                                    v.get("devanagari", ""), v.get("translit", ""),
                                    v.get("context", ""))
            except Exception as e:
                print(f"  ✗ {v['ref']}: {e}", file=sys.stderr)
                continue
            fh.write(json.dumps(t, ensure_ascii=False) + "\n")
            fh.flush()
            n_ok += 1
            if t.get("confidence") == "low" or t.get("uncertain"):
                n_low += 1
            print(f"  {v['ref']:<14} {t.get('confidence','?'):<7} "
                  f"{t['translation'][:52]}")

    print(f"\n{src.name}: переведено {n_ok}, требуют внимания редактора {n_low}")
    print("ВСЕ строки — status=draft. Публикация только человеком (ПР002).")
    return dst


if __name__ == "__main__":
    if not KEY:
        sys.exit("Нет ANTHROPIC_API_KEY")
    for p in sys.argv[1:]:
        translate_file(pathlib.Path(p))

#!/usr/bin/env python3
"""
СВЯЗУЮЩАЯ ПРОЗА · опциональный движок.

Конвейер собирает книгу и БЕЗ модели: заголовки берутся из названий глав,
цитаты — из БД, факты — из досье. Такая книга законна и полна, но связки в ней
служебные («Повествование: Кришнадас Кавираджа Госвами»).

Движок прозы переписывает ТОЛЬКО поля `p` — связки — живым языком. Он не
получает права выдумывать: в промпте ему дают ровно те цитаты и пассажи,
которые уже лежат в секции, и запрещают вводить новые имена, даты и числа.
А дальше его слово проверяет ГЕЙТ СОДЕРЖАНИЯ (`gate.containment`): любое имя
или число, которого нет в досье, роняет сборку. Модель может писать красиво —
сочинить не может.

Нет ключа `ANTHROPIC_API_KEY` — стадия просто пропускается, книга выходит на
служебных связках. Это осознанный запас прочности, а не заглушка.
"""
import json
import os
import urllib.request

MODEL = os.environ.get("GOLDFORGE_MODEL", "claude-sonnet-5")
URL = "https://api.anthropic.com/v1/messages"
MAX_SECTIONS = 80

SYSTEM = """Ты редактор библиотеки ISKCON ONE LOVE. Пишешь связки к разделам карточки личности.

ЖЕЛЕЗНЫЕ ПРАВИЛА (нарушение = брак, сборка падает на гейте):
1. НОЛЬ ФАБРИКАЦИИ. Ни одного имени, даты, числа, места, которых нет в предъявленном материале.
   Не знаешь — не пиши. Гейт сверяет каждое имя и число с источниками.
2. Связка — 1–2 предложения. Она ВВОДИТ в тему раздела, а не пересказывает цитаты.
3. Имя героя — ВСЕГДА полное, с титулом («Джива Госвами», не «Джива»), во всех падежах.
4. Господь: «Гауранга Махапрабху» (Навадвипа/общее) или «Шри Кришна Чайтанья Махапрабху»
   (после санньясы). Голого «Чайтанья» нет. «Шримати Радхарани», «Шрила Прабхупада».
5. Никаких «;». Никаких прямых апострофов. Без оценок и лозунгов — только факт и смысл.
6. Ответ — ЧИСТЫЙ JSON: {"p": "текст связки"}. Без markdown, без пояснений."""


def enabled():
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _call(prompt):
    body = json.dumps({
        "model": MODEL, "max_tokens": 400, "system": SYSTEM,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "content-type": "application/json",
        "x-api-key": os.environ["ANTHROPIC_API_KEY"],
        "anthropic-version": "2023-06-01",
    })
    with urllib.request.urlopen(req, timeout=90) as r:
        d = json.load(r)
    txt = "".join(b.get("text", "") for b in d.get("content", []) if b.get("type") == "text")
    txt = txt.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(txt).get("p", "").strip()


def polish(book, hero_full, evidence_by_ref):
    """Переписать связки `p`. Ошибка на секции — оставляем служебную связку."""
    if not enabled():
        return 0, "ANTHROPIC_API_KEY нет — связки служебные"
    done = 0
    for t in book.get("tabs", []):
        for s in t.get("subtabs", []):
            for sec in s.get("sections", []):
                if done >= MAX_SECTIONS or not sec.get("quotes"):
                    continue
                mat = []
                for q in sec["quotes"][:6]:
                    mat.append("— %s (%s): %s" % (q.get("by", "источник"), q.get("ref", ""),
                                                  (q.get("t") or "")[:400]))
                    ev = evidence_by_ref.get(q.get("ref", ""))
                    if ev:
                        mat.append("   контекст: %s" % ev[:300])
                prompt = (
                    "ГЕРОЙ: %s\nРАЗДЕЛ КНИГИ: %s\nПОДРАЗДЕЛ: %s\nЗАГОЛОВОК СЕКЦИИ: %s\n\n"
                    "МАТЕРИАЛ СЕКЦИИ (только он — больше ничего не существует):\n%s\n\n"
                    "Напиши связку к этой секции."
                    % (hero_full, t.get("label", ""), s.get("label", ""), sec.get("h", ""),
                       "\n".join(mat)))
                try:
                    p = _call(prompt)
                except Exception:                                # noqa: BLE001
                    continue
                if p and len(p) > 15:
                    sec["p"] = [p]
                    done += 1
    return done, "связок написано: %d (модель %s)" % (done, MODEL)

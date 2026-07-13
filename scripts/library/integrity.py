"""
ЦЕЛОСТНОСТЬ ИСТОЧНИКА (ЗКН-ПР010).

ПР003 спрашивает: «есть ли оригинал?» — и этого МАЛО.

Бхакти-ратнакара, бенгальский скан 1888 г., OCR от Internet Archive:
    Ocr_detected_script:      Bengali
    Ocr_detected_script_conf: 1.0000
    доля бенгальского письма: 100.0%   ← мой гейт дал ЗЕЛЁНЫЙ
    …и 637 разных написаний СОБСТВЕННОГО НАЗВАНИЯ КНИГИ,
       каноническое «ভক্তিরত্নাকর» — 0 раз из 622 страниц.

Письмо распознано. Слова — нет. Присутствие доказано, целостность — нет.
Переводить с такого «оригинала» = фабриковать, имея на руках доказательство,
что оригинал есть. Это худший вид фабрикации: с алиби.

МЕХАНИЗМ — ЛЕКСИЧЕСКИЙ ЯКОРЬ.
У книги есть слова, которые ОБЯЗАНЫ повторяться дословно: её собственное
название в колонтитуле каждой страницы, имя автора, имя главного героя.
Если якорь пишется N способами — OCR врёт, и врёт везде, а не только в якоре.

Запуск:
    python3 -m scripts.library.integrity <файл> <якорь> [макс_вариантов]
"""
from __future__ import annotations
import re
import sys
import unicodedata
from collections import Counter

# ПОРОГ ЦЕЛОСТНОСТИ.
# Доля канонического написания среди близких форм. Опечатки в 1-3% нормальны.
MIN_SHARE = 80.0


# РАЗБИЕНИЕ НА СЛОВА. НЕ `\w+`!
# `\w` в Python = str.isalnum(), а бенгальская вирама «্» (U+09CD, кат. Mn) —
# НЕ alnum. Поэтому `\w+` рвёт «ভক্তিরত্নাকর» на куски по каждому конъюнкту,
# якорь не находится НИ РАЗУ, и гейт даёт ЗЕЛЁНЫЙ на полностью битом файле.
# Я поймал это на себе: первая версия ПР010 пропустила тот самый OCR, ради
# которого писалась. Режем по пробелам и пунктуации, конъюнкты не трогаем.
_SEP = re.compile(
    r"[\s\d\u09E6-\u09EF\u0964\u0965|.,;:!?()\[\]{}\"'«»<>/\\*_~^=+№#%&@$—–-]+"
)


def _words(text: str):
    for tok in _SEP.split(text):
        if tok:
            yield tok


def _lev(a: str, b: str, cutoff: int) -> int:
    """Расстояние Левенштейна с отсечкой. Возвращает cutoff+1, если дальше."""
    if abs(len(a) - len(b)) > cutoff:
        return cutoff + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        best = i
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
            best = min(best, cur[j])
        if best > cutoff:
            return cutoff + 1
        prev = cur
    return prev[-1]


def variants(text: str, anchor: str, cutoff: int = 2) -> Counter:
    """Написания, отстоящие от якоря не более чем на `cutoff` правок.

    НЕ префикс! Префиксная эвристика ловила «Sridhara/Srikhanda/Sripati» как
    «варианты Srinivasa» — а это РАЗНЫЕ ИМЕНА с общим «Sri». Гейт с ложными
    срабатываниями хуже отсутствующего: его отключат. Правки — не префикс.
    """
    script = _script_of(anchor)
    out: Counter = Counter()
    for w in _words(text):
        if abs(len(w) - len(anchor)) > cutoff:
            continue
        if _script_of(w) != script:
            continue
        if _lev(w, anchor, cutoff) <= cutoff:
            out[w] += 1
    return out


def _script_of(s: str) -> str:
    for c in s:
        if c.isalpha():
            return unicodedata.name(c, "?").split()[0]
    return "?"


def _lcp(a: str, b: str) -> int:
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def check(path: str, anchor: str, min_share: float = MIN_SHARE) -> int:
    text = open(path, encoding="utf-8", errors="replace").read()
    v = variants(text, anchor)
    exact = v.get(anchor, 0)
    total = sum(v.values())
    share = (exact / total * 100) if total else 0.0

    print(f"источник : {path}")
    print(f"якорь    : {anchor}")
    print(f"канон    : {exact:,} из {total:,}  →  ДОЛЯ {share:.1f}%  (порог {min_share:.0f}%)")
    for w, c in v.most_common(6):
        print(f"   {w:<18} ×{c}{'  ← КАНОН' if w == anchor else ''}")

    if total == 0:
        print(f"::error::ПР010 {path}: якорь «{anchor}» не найден вовсе — не тот файл или не тот якорь")
        return 1
    if exact == 0:
        print(f"::error::ПР010 {path}: каноническое написание «{anchor}» НЕ ВСТРЕЧАЕТСЯ "
              f"НИ РАЗУ при {total:,} близких формах — OCR разрушил слова")
        return 1
    if share < min_share:
        print(f"::error::ПР010 {path}: канон «{anchor}» — лишь {share:.1f}% написаний "
              f"(порог {min_share:.0f}%) — источник негоден для перевода")
        return 1
    print(f"::notice::ПР010 {path}: целостность подтверждена (канон {share:.1f}%)")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    mn = float(sys.argv[3]) if len(sys.argv) > 3 else MIN_SHARE
    sys.exit(check(sys.argv[1], sys.argv[2], mn))

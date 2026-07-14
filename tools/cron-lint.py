#!/usr/bin/env python3
"""
ЗКН-Ф024 · ГЕЙТ РАСПИСАНИЙ.

GitHub держит в concurrency-группе ОДИН running и ОДИН pending. Третий приход
ОТМЕНЯЕТ ожидающего — не откладывает, а убивает. Значит частый короткий
воркфлоу (истории — каждые 30 минут) выселяет из очереди редкий тяжёлый
(аудио — раз в 6 часов), и тяжёлый не выполняется ПОЧТИ НИКОГДА.

Так и было: `tg-audio` и `tg-video` стояли на ОДНОЙ минуте (`17 */6` и
`17 */2`) в общей группе `tg-archive-session`. Каждый старт аудио утыкался в
работающее видео, вставал в pending — и первый же тик историй его отменял.
4 из 5 последних прогонов аудио — `cancelled`. Внешне это выглядело как баг
интерфейса: «почему в ленте не плеер, а ссылка в Telegram» — потому что src
для плеера так и не появлялся.

ПРАВИЛО: два воркфлоу в ОДНОЙ concurrency-группе не могут стартовать в одну и
ту же минуту по расписанию. Общая сессия сериализует их — расписание обязано
их разводить.

Проверено на живом нарушении: вернуть `tg-audio` на `17 */6` — гейт краснеет.
"""
import re
import sys
from collections import defaultdict
from pathlib import Path

import yaml

WF = Path(__file__).resolve().parents[1] / ".github" / "workflows"


def cron_slots(expr: str) -> set[tuple[int, int]]:
    """Минуты/часы запуска. Поддержаны */N, списки, звёздочки — этого хватает."""
    parts = expr.split()
    if len(parts) < 2:
        return set()

    def expand(field: str, lo: int, hi: int) -> list[int]:
        out: list[int] = []
        for chunk in field.split(","):
            m = re.fullmatch(r"\*/(\d+)", chunk)
            if chunk == "*":
                out += list(range(lo, hi + 1))
            elif m:
                out += list(range(lo, hi + 1, int(m.group(1))))
            elif chunk.isdigit():
                out.append(int(chunk))
            else:  # диапазоны и прочее — не гадаем
                return list(range(lo, hi + 1))
        return out

    return {(h, mi) for mi in expand(parts[0], 0, 59) for h in expand(parts[1], 0, 23)}


def main() -> int:
    groups: dict[str, list[tuple[str, set[tuple[int, int]]]]] = defaultdict(list)
    for f in sorted(WF.glob("*.yml")):
        try:
            d = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        except Exception:
            continue
        conc = d.get("concurrency")
        group = conc.get("group") if isinstance(conc, dict) else conc
        if not isinstance(group, str) or "${{" in group:
            continue  # динамическая группа (по ветке/PR) — не наш случай
        on = d.get("on", d.get(True)) or {}
        sched = on.get("schedule") if isinstance(on, dict) else None
        if not sched:
            continue
        slots: set[tuple[int, int]] = set()
        for s in sched:
            if isinstance(s, dict) and s.get("cron"):
                slots |= cron_slots(str(s["cron"]))
        if slots:
            groups[group].append((f.name, slots))

    bad: list[str] = []
    for group, items in groups.items():
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, sa = items[i]
                b, sb = items[j]
                clash = sorted(sa & sb)
                if clash:
                    when = ", ".join(f"{h:02d}:{m:02d}" for h, m in clash[:4])
                    bad.append(
                        f"{a} и {b} — ЗКН-Ф024: старт в одну минуту ({when}"
                        f"{'…' if len(clash) > 4 else ''}) в общей группе «{group}». "
                        f"Ожидающего отменит первый же следующий приход в группу")

    if bad:
        print("ГЕЙТ РАСПИСАНИЙ — НАРУШЕНИЯ:\n")
        for b in bad:
            print("  ✗ " + b)
        print(f"\nВсего: {len(bad)}")
        return 1
    print("Гейт расписаний (ЗКН-Ф024): чисто.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

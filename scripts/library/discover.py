"""
СТАДИЯ 1 — ОТКРЫТИЕ.  «Находит все книги гаудия-вайшнавской традиции онлайн»

Ищет НЕ где попало, а по корпусам, где текст лежит законно. Каждый найденный
источник получает класс прав ЕЩЁ ДО скачивания (закон ПР001): не бывает
«сначала скачаем, потом разберёмся».

КОРПУСА (проверены, реальны)
────────────────────────────
GRETIL          gretil.sub.uni-goettingen.de  — эталонный академический корпус
                санскритских e-текстов (Гёттингенский университет). Оригиналы.
Grantha Mandira grantha.jiva.org              — научный архив Jiva Institute,
                гаудия-первоисточники в деванагари и IAST.
Sanskrit Docs   sanskritdocuments.org         — оригиналы в Unicode.
Muktabodha      muktabodha.org                — цифровая библиотека рукописей.
Internet Archive archive.org                  — переводы, чей срок охраны истёк
                (Ganguli 1883–96, Griffith 1870–96, Müller 1879–84, Wilson 1840).
Wisdomlib       wisdomlib.org                 — сверка структуры глав.

ЧТО СЮДА НИКОГДА НЕ ПОПАДЁТ
───────────────────────────
vedabase.io и любые зеркала BBT; scribd; современные переводы под охраной
(Кушакратха, Бхану Свами, Бхумипати). Это FORBIDDEN на уровне кода, не совести.

Запуск (нужна открытая сеть → выполняется в GitHub Actions):
    python3 -m scripts.library.discover ggd
    python3 -m scripts.library.discover --all
"""
from __future__ import annotations
import json
import pathlib
import re
import sys
import time
import urllib.request

from .registry import WORKS, QUEUE, PD, FORBIDDEN

RAW = pathlib.Path("build/library/raw")
MANIFEST = pathlib.Path("build/library/manifest")

UA = "ISKCON-ONE-LOVE/1.0 (library conveyor; ceo@billionsx.com)"

# ── Хосты, с которых брать НЕЛЬЗЯ. Проверка до сети. ─────────────────────────
DENY_HOSTS = (
    "vedabase.io", "vedabase.com", "prabhupadabooks.com", "bbtmedia",
    "krishnastore", "scribd.com", "purebhakti.com", "bhaktivedanta",
)

# ── Разрешённые корпуса и класс прав того, что оттуда приходит ───────────────
CORPORA = {
    "gretil": dict(
        host="gretil.sub.uni-goettingen.de",
        index="https://gretil.sub.uni-goettingen.de/gretil.html",
        rights=PD, kind="sanskrit",
        note="Оригиналы старше 400 лет — вне охраны.",
    ),
    "jiva-grantha": dict(
        host="grantha.jiva.org",
        index="https://grantha.jiva.org/",
        rights=PD, kind="sanskrit",
        note="Гаудия-первоисточники, Jiva Institute.",
    ),
    "sanskritdocuments": dict(
        host="sanskritdocuments.org",
        index="https://sanskritdocuments.org/",
        rights=PD, kind="sanskrit",
    ),
    "archive": dict(
        host="archive.org",
        index="https://archive.org/advancedsearch.php",
        rights=PD, kind="translation-pd",
        note="ТОЛЬКО издания до 1929 г. Год проверяется машиной, см. _pd_year().",
    ),
}

PD_CUTOFF = 1929          # в США всё, изданное до этого года, — общественное достояние


def _deny(url: str) -> bool:
    return any(h in url.lower() for h in DENY_HOSTS)


def _pd_year(meta: dict) -> bool:
    """Издание PD только если год публикации до отсечки. Иначе — не берём."""
    y = str(meta.get("year") or meta.get("date") or "")
    m = re.search(r"(1[6-9]\d{2}|20\d{2})", y)
    return bool(m) and int(m.group(1)) < PD_CUTOFF


def _get(url: str, timeout: int = 60) -> bytes:
    if _deny(url):
        raise PermissionError(f"ЗАПРЕЩЁННЫЙ ИСТОЧНИК (ПР001): {url}")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def search_archive(query: str, rows: int = 25) -> list[dict]:
    """Ищет в Internet Archive и оставляет ТОЛЬКО издания в PD по году."""
    q = urllib.request.quote(f'{query} AND mediatype:texts')
    url = (f"https://archive.org/advancedsearch.php?q={q}"
           f"&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=creator"
           f"&rows={rows}&page=1&output=json")
    data = json.loads(_get(url))
    out = []
    for d in data.get("response", {}).get("docs", []):
        pd_ok = _pd_year(d)
        out.append({
            "corpus": "archive",
            "id": d.get("identifier"),
            "title": d.get("title"),
            "year": d.get("year"),
            "creator": d.get("creator"),
            "url": f"https://archive.org/details/{d.get('identifier')}",
            "rights": PD if pd_ok else FORBIDDEN,
            "reason": ("издано до 1929 — PD" if pd_ok else
                       "издано после 1929 — под охраной, НЕ БЕРЁМ"),
        })
    return out


def discover(work_id: str) -> dict:
    w = WORKS.get(work_id)
    if not w:
        raise SystemExit(f"Работа {work_id} не в реестре (закон ПР001)")

    found: list[dict] = []

    # 1. Источники, уже зафиксированные в реестре.
    for s in w.sources:
        found.append({
            "corpus": s.id, "url": s.url, "kind": s.kind,
            "rights": s.rights, "reason": s.note or "из реестра",
        })

    # 2. Поиск переводов, чей срок охраны истёк.
    if w.orig_lang in ("sa", "bn"):
        try:
            hits = search_archive(f'"{w.iast}" OR "{w.title_ru}"')
            found.extend(hits)
        except Exception as e:                    # сеть в CI бывает капризна
            print(f"  archive.org недоступен: {e}", file=sys.stderr)

    usable = [f for f in found if f["rights"] == PD]
    blocked = [f for f in found if f["rights"] != PD]

    man = {
        "work_id": work_id,
        "title_ru": w.title_ru,
        "iast": w.iast,
        "author_entity": w.author_entity,
        "orig_lang": w.orig_lang,
        "rights_target": w.rights,
        "found_total": len(found),
        "usable": usable,
        "blocked": blocked,
        "discovered_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    MANIFEST.mkdir(parents=True, exist_ok=True)
    p = MANIFEST / f"{work_id}.json"
    p.write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{work_id:<16} найдено {len(found):>3} · пригодно {len(usable):>3} · "
          f"отклонено по правам {len(blocked):>3}  → {p}")
    return man


if __name__ == "__main__":
    args = sys.argv[1:]
    targets = QUEUE if (not args or args[0] == "--all") else args
    for t in targets:
        discover(t)

#!/usr/bin/env python3
"""
sb_verify.py — гейт озвучки «Шримад-Бхагаватам»: сверяет ЗАЛИТОЕ с КНИГОЙ.

Проверки (по каждой песни, где озвучка есть):
  1. Сирота-ref — дорожка-стих ссылается на `ref`, которого НЕТ в `verses`.
     Это молчаливая ложь: человек жмёт «слушать стих», а стиха в книге нет.
  2. Немой стих — стих книги без дорожки. Показывает реальную полноту песни.
  3. Дубль-позиция — две дорожки на одном (глава, позиция): порядок очереди врёт.
  4. Глава без озвучки — при том, что песнь объявлена залитой.
  5. Живой эндпоинт /api/books/sb/audio?canto=N — отвечает ли и сколько дорожек.

Пишет отчёт в docs/diagnostics/sb-audio-verify.md. Ненулевой код — только на сиротах
и дублях (это ОШИБКИ). Немые стихи при неполной заливке — не ошибка, а прогресс.
"""
import json
import os
import urllib.request

ACCOUNT = os.getenv("CF_ACCOUNT_ID", "d5cbe19470dc38599873eabfe148e6d1")
DB = os.getenv("D1_DATABASE_ID", "6226aded-dd03-4e74-977f-9cd0b509e73d")
TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")
SITE = os.getenv("DL_SITE", "https://gaurangers.com").rstrip("/")
OUT = os.getenv("VERIFY_OUT", "docs/diagnostics/sb-audio-verify.md")


def d1(sql):
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query"
    req = urllib.request.Request(url, data=json.dumps({"sql": sql}).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {TOKEN}",
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        j = json.loads(r.read())
    if not j.get("success"):
        raise SystemExit(f"D1: {j.get('errors')}")
    return j["result"][0]["results"]


def live(canto):
    req = urllib.request.Request(
        f"{SITE}/api/books/sb/audio?canto={canto}",
        headers={"User-Agent": "Mozilla/5.0 (compatible; iskcone-verify/1.0)", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            m = json.loads(r.read())
        return len(m.get("modes", {}).get("plain", {}).get("tracks", []))
    except Exception as e:
        return f"ошибка: {e}"


def main():
    per = d1("""SELECT a.canto,
                       COUNT(*) AS tracks,
                       SUM(a.kind='verse') AS verses,
                       SUM(a.kind='intro') AS intros,
                       COUNT(DISTINCT a.chapter) AS chapters
                FROM sb_audio a GROUP BY a.canto ORDER BY a.canto""")
    if not per:
        print("::warning::sb_audio пуста — озвучка ещё не залита")
        return

    orphans = d1("""SELECT a.canto, a.ref FROM sb_audio a
                    LEFT JOIN verses v ON v.work_id='sb' AND v.ref = a.ref
                    WHERE a.kind='verse' AND v.ref IS NULL ORDER BY a.canto LIMIT 50""")
    dupes = d1("""SELECT canto, chapter, seq, COUNT(*) AS n FROM sb_audio
                  GROUP BY canto, chapter, seq HAVING n > 1 LIMIT 50""")
    # Дубль-ref: два файла на один стих — человек услышал бы его дважды подряд.
    dupref = d1("""SELECT ref, COUNT(*) AS n FROM sb_audio
                   WHERE kind='verse' GROUP BY ref HAVING n > 1 LIMIT 50""")
    cantos = [r["canto"] for r in per]
    lst = ",".join(str(c) for c in cantos)
    mute = d1(f"""SELECT SUBSTR(v.division_id, 4, INSTR(SUBSTR(v.division_id,4),'.')-1) AS canto,
                         COUNT(*) AS n
                  FROM verses v
                  LEFT JOIN sb_audio a ON a.ref = v.ref
                  WHERE v.work_id='sb' AND a.ref IS NULL
                    AND CAST(SUBSTR(v.division_id, 4, INSTR(SUBSTR(v.division_id,4),'.')-1) AS INTEGER) IN ({lst})
                  GROUP BY canto""")
    mute_by = {int(r["canto"]): r["n"] for r in mute}
    chap_db = {int(r["canto"]): r["n"] for r in d1(
        f"""SELECT CAST(SUBSTR(id,4,INSTR(SUBSTR(id,4),'.')-1) AS INTEGER) AS canto, COUNT(*) AS n
            FROM divisions WHERE work_id='sb' AND level='chapter'
              AND CAST(SUBSTR(id,4,INSTR(SUBSTR(id,4),'.')-1) AS INTEGER) IN ({lst})
            GROUP BY canto""")}

    lines = ["# Озвучка «Шримад-Бхагаватам» — сверка с книгой", "",
             "Гейт `sb-verify`: аудио на archive.org ↔ стихи в D1. Отчёт машинный, правится только скриптом.",
             "", "| Песнь | Дорожек | Стихов | Введений | Глав озвучено | Глав в книге | Немых стихов | Живой плейлист |",
             "|---|---|---|---|---|---|---|---|"]
    for r in per:
        c = r["canto"]
        ch_audio = r["chapters"] - (1 if r["chapters"] and d1(
            f"SELECT COUNT(*) AS n FROM sb_audio WHERE canto={c} AND chapter=0")[0]["n"] else 0)
        lines.append(f"| {c} | {r['tracks']} | {r['verses']} | {r['intros']} | {ch_audio} | "
                     f"{chap_db.get(c, '—')} | {mute_by.get(c, 0)} | {live(c)} |")
    lines += ["", f"**Сирот-ref (стих есть в аудио, но НЕ в книге): {len(orphans)}**"]
    for o in orphans[:20]:
        lines.append(f"- `{o['ref']}` (песнь {o['canto']})")
    lines += ["", f"**Дублей позиции (две дорожки на одном месте): {len(dupes)}**"]
    for dp in dupes[:20]:
        lines.append(f"- песнь {dp['canto']}, глава {dp['chapter']}, позиция {dp['seq']} — {dp['n']}")
    lines += ["", f"**Дублей стиха (две дорожки на один ref): {len(dupref)}**"]
    for dr in dupref[:20]:
        lines.append(f"- `{dr['ref']}` — {dr['n']}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("\n".join(lines))

    bad = len(orphans) + len(dupes) + len(dupref)
    print(f"::notice::Сверка ШБ: сирот {len(orphans)}, дублей позиции {len(dupes)}, "
          f"дублей стиха {len(dupref)}, песней с озвучкой {len(per)}")
    if bad:
        raise SystemExit(f"::error::Сверка ШБ не пройдена: сирот {len(orphans)}, "
                         f"дублей позиции {len(dupes)}, дублей стиха {len(dupref)}")


if __name__ == "__main__":
    main()

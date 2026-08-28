#!/usr/bin/env python3
"""
katha_export.py — ВЫГРУЗКА ГОЛОСА КАТХИ В АРХИВ (zip по циклам → GitHub Release).

═══ ЗАЧЕМ ═══

Основателю нужны все лекции рассказчика одним архивом — офлайн, мимо плеера,
чтобы хранить и передавать. В приложении звук лежит на archive.org по циклам
(iskcone-katha-*), файлы там латиницей (`gopi-gita-01.mp3`), без тегов: в
папке на диске это нечитаемо. Здесь собирается ЧЕЛОВЕЧЕСКИЙ архив:

    <Рассказчик> · Катха/
      <Цикл>/
        01 · <Цикл> · Часть 1.mp3      ← ID3v2.3: артист, альбом, номер, год, жанр
        02 · <Цикл> · Часть 2.mp3

Имя файла само себя описывает и вне папки (цикл + номер + часть), номер даёт
порядок, теги дают порядок и подписи в любом плеере.

═══ ОТКУДА ИСТИНА ═══

Список записей — витрина `/api/katha`: она отдаёт ровно то, что человек слышит
в приложении (ЗКН-Ф021: считается только то, что реально лежит в архиве).
Байты — из archive.org напрямую, мимо прокси `brajs.com/audio` (не жечь воркер
на трёх гигабайтах), с проверкой размера и md5 по метаданным архива. Если
archive.org не отдал — запасной путь через прокси приложения. Недостающая запись
— это ОШИБКА, а не «сколько получилось» (ЗКН-Ф014: инструмент говорит, что
именно не доехало).

═══ ПОЧЕМУ ZIP ПО ЦИКЛАМ ═══

GitHub Releases — бесплатное зеркало без потолка на релиз, но ≤2 ГБ на файл
(ЗКН-Пл023). Один голос весит больше (Радха Говинда Госвами — 3,2 ГБ), поэтому
один zip на цикл; все они распаковываются в ОДНУ папку рассказчика.
ZIP без сжатия (mp3 не жмётся) и с флагом UTF-8 — кириллица читается на macOS
и Windows.

Выход в --out:
  <speaker>-<album-id>.zip     по одному на цикл (имя ASCII — GitHub меняет спецсимволы)
  СОДЕРЖАНИЕ.md                поимённый список с длительностями
  SHA256SUMS.txt               контрольные суммы zip
  release-notes.md             тело релиза
  summary.json                 итог для CI

Сеть до archive.org из песочницы закрыта — движок гоняется в CI
(.github/workflows/katha-export.yml). Чистые функции: --selftest.

Запуск: python katha_export.py --speaker radha-govinda-goswami --out ../../out
"""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

API = os.environ.get("KATHA_API", "https://brajs.com").rstrip("/")
IA = "https://archive.org"
UA = "ISKCON-ONE-LOVE-KathaExport/1.0 (+https://brajs.com)"
CHUNK = 1 << 20
ROOT_SUFFIX = "Катха"  # «<Рассказчик> · Катха/»

# ─────────────────────── чистые функции (selftest) ───────────────────────

_BAD = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def safe(name: str) -> str:
    """Имя для файловой системы: без символов, запрещённых на Windows/macOS,
    без хвостовых точек и пробелов (Windows их молча срезает)."""
    s = _BAD.sub("-", str(name or "")).replace("\u00a0", " ")
    s = re.sub(r"\s+", " ", s).strip(" .")
    return s or "без названия"


def hms(sec: int) -> str:
    """Длительность для списка: 1:48:44 / 52:31."""
    sec = int(sec or 0)
    h, r = divmod(sec, 3600)
    m, s = divmod(r, 60)
    return "%d:%02d:%02d" % (h, m, s) if h else "%d:%02d" % (m, s)


def hours_ru(sec: int) -> str:
    """Итог по-человечески: «63 ч 42 мин»."""
    m = int(sec or 0) // 60
    h, m = divmod(m, 60)
    return "%d ч %02d мин" % (h, m) if h else "%d мин" % m


def human(n: int) -> str:
    n = float(n or 0)
    for u in ("Б", "КБ", "МБ", "ГБ", "ТБ"):
        if n < 1024 or u == "ТБ":
            return ("%.1f %s" % (n, u)).replace(".0 ", " ")
        n /= 1024
    return "%.1f ТБ" % n


def n_ru(n: int, one: str, few: str, many: str) -> str:
    """Русское склонение счётного: 1 цикл · 2 цикла · 5 циклов · 11 циклов."""
    n = int(n)
    m = abs(n) % 100
    r = m % 10
    word = many if 11 <= m <= 19 else one if r == 1 else few if 2 <= r <= 4 else many
    return "%d %s" % (n, word)


def cycles(n: int) -> str:
    return n_ru(n, "цикл", "цикла", "циклов")


def records(n: int) -> str:
    return n_ru(n, "запись", "записи", "записей")


def track_name(pos: int, album_title: str, title: str) -> str:
    """«01 · Гопи-гита · Часть 1.mp3» — номер даёт порядок, цикл делает имя
    самодостаточным вне папки."""
    return safe("%02d · %s · %s" % (pos, album_title, title)) + ".mp3"


def asset_name(speaker: str, album_id: str) -> str:
    """Имя zip в релизе — только ASCII: GitHub подменяет прочее точками."""
    a = re.sub(r"[^a-z0-9-]+", "-", ("%s-%s" % (speaker, album_id)).lower()).strip("-")
    return a + ".zip"


def order_albums(catalog: dict, speaker: str) -> list:
    """Циклы рассказчика в порядке витрины (ORDER BY sort, title) с дорожками
    в порядке витрины (sort, file). Дорожка наследует identifier/speaker цикла,
    когда витрина их сжала (см. /api/katha в worker.ts)."""
    albums = [a for a in catalog.get("albums", []) if a.get("speaker") == speaker]
    by_id = {a["id"]: a for a in albums}
    tracks = {}
    for t in catalog.get("tracks", []):
        a = by_id.get(t.get("album"))
        if not a:
            continue
        if t.get("speaker", speaker) != speaker:
            continue
        tracks.setdefault(a["id"], []).append({
            "file": t["file"],
            "title": t.get("title") or t["file"],
            "duration": int(t.get("duration") or 0),
            "identifier": t.get("identifier") or a.get("archive") or "",
        })
    out = []
    for a in albums:
        ts = tracks.get(a["id"], [])
        if not ts:
            continue
        out.append({**a, "tracks": ts})
    return out


def selftest() -> int:
    assert safe(' Часть 2 · 1/2: "Ада"? ') == "Часть 2 · 1-2- -Ада--"
    assert safe("...") == "без названия"
    assert hms(6524) == "1:48:44" and hms(3153) == "52:33" and hms(0) == "0:00"
    assert hours_ru(229423) == "63 ч 43 мин" and hours_ru(1800) == "30 мин"
    assert (cycles(1), cycles(2), cycles(6), cycles(11), cycles(21)) == ("1 цикл", "2 цикла", "6 циклов", "11 циклов", "21 цикл")
    assert (records(1), records(4), records(12), records(42)) == ("1 запись", "4 записи", "12 записей", "42 записи")
    assert track_name(1, "Гопи-гита", "Часть 1") == "01 · Гопи-гита · Часть 1.mp3"
    assert asset_name("radha-govinda-goswami", "gopi-gita") == "radha-govinda-goswami-gopi-gita.zip"
    assert asset_name("x", "Ы й") == "x.zip"
    cat = {
        "albums": [{"id": "b", "speaker": "s", "title": "Б", "archive": "ia-b"},
                   {"id": "a", "speaker": "s", "title": "А", "archive": "ia-a"},
                   {"id": "z", "speaker": "other", "title": "Z"}],
        "tracks": [{"album": "b", "file": "b-01.mp3", "title": "Часть 1", "duration": 5},
                   {"album": "a", "file": "a-01.mp3", "title": "Часть 1", "duration": 7, "identifier": "ia-a2"},
                   {"album": "a", "file": "a-02.mp3", "title": "Часть 2", "speaker": "other"},
                   {"album": "z", "file": "z.mp3"}],
    }
    o = order_albums(cat, "s")
    assert [a["id"] for a in o] == ["b", "a"], o
    assert o[0]["tracks"][0]["identifier"] == "ia-b"
    assert [t["file"] for t in o[1]["tracks"]] == ["a-01.mp3"] and o[1]["tracks"][0]["identifier"] == "ia-a2"
    # zip с кириллицей: флаг UTF-8 выставлен, запись без сжатия, читается обратно
    with tempfile.TemporaryDirectory() as d:
        src = Path(d) / "x.mp3"
        src.write_bytes(b"\xff\xfb" + b"\0" * 100)
        z = Path(d) / "t.zip"
        pack(z, [(src, "Рассказчик · Катха/Цикл/01 · Цикл · Часть 1.mp3")])
        with zipfile.ZipFile(z) as zf:
            info = zf.infolist()[0]
            assert info.filename == "Рассказчик · Катха/Цикл/01 · Цикл · Часть 1.mp3"
            assert info.compress_type == zipfile.ZIP_STORED
            assert info.flag_bits & 0x800, "нет флага UTF-8 — кириллица побьётся на Windows"
            assert zf.testzip() is None
    print("selftest ok")
    return 0


# ─────────────────────── сеть (ЗКН-Ф014: ошибка говорит, что сломалось) ───────────────────────

def get(url: str, tries: int = 4, timeout: int = 60) -> bytes:
    last = "нет попыток"
    for i in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:  # ЗКН-Ф014
            body = e.read()[:300].decode("utf-8", "replace")
            last = "HTTP %s %s: %s" % (e.code, url, body.strip())
            if 400 <= e.code < 500 and e.code not in (408, 425, 429):
                break
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last = "%s: %s" % (url, e)
        time.sleep(3 * (i + 1))
    raise RuntimeError(last)


def download(url: str, dst: Path, size: int = 0, md5: str = "", tries: int = 3, timeout: int = 180) -> int:
    """Качает потоком, считает md5 на лету, кладёт в dst только после сверки."""
    tmp = dst.with_suffix(dst.suffix + ".part")
    last = "нет попыток"
    for i in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        h = hashlib.md5()
        n = 0
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r, open(tmp, "wb") as f:
                while True:
                    b = r.read(CHUNK)
                    if not b:
                        break
                    f.write(b)
                    h.update(b)
                    n += len(b)
        except urllib.error.HTTPError as e:  # ЗКН-Ф014
            body = e.read()[:200].decode("utf-8", "replace")
            last = "HTTP %s %s: %s" % (e.code, url, body.strip())
            if e.code in (403, 404):
                break
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last = "%s: %s" % (url, e)
        else:
            if size and n != size:
                last = "%s: размер %d ≠ %d в архиве" % (url, n, size)
            elif md5 and h.hexdigest() != md5:
                last = "%s: md5 не сошёлся с archive.org" % url
            else:
                os.replace(tmp, dst)
                return n
        time.sleep(5 * (i + 1))
    if tmp.exists():
        tmp.unlink()
    raise RuntimeError(last)


def ia_files(identifier: str) -> dict:
    """{имя файла: (размер, md5)} по метаданным archive.org; пусто — если архив молчит
    (тогда качаем без сверки и говорим об этом вслух)."""
    if not identifier:
        return {}
    try:
        meta = json.loads(get("%s/metadata/%s" % (IA, identifier)))
    except (RuntimeError, ValueError) as e:
        print("::warning::archive.org не отдал метаданные %s — качаю без сверки md5 (%s)" % (identifier, e))
        return {}
    out = {}
    for f in meta.get("files", []):
        if f.get("source", "original") != "original":
            continue
        out[f.get("name", "")] = (int(f.get("size") or 0), f.get("md5") or "")
    return out


# ─────────────────────── теги и упаковка ───────────────────────

def tag(path: Path, *, title: str, album: str, artist: str, pos: int, total: int, year: str, comment: str) -> None:
    from mutagen.id3 import ID3, ID3NoHeaderError, TIT2, TALB, TPE1, TPE2, TRCK, TDRC, TCON, COMM  # noqa: E402
    try:
        tags = ID3(str(path))
    except ID3NoHeaderError:
        tags = ID3()
    # Чужие теги (что бы ни вписал загрузчик канала) — прочь: истина у нас.
    tags.clear()
    tags.add(TIT2(encoding=3, text=title))
    tags.add(TALB(encoding=3, text=album))
    tags.add(TPE1(encoding=3, text=artist))
    tags.add(TPE2(encoding=3, text=artist))
    tags.add(TRCK(encoding=3, text="%d/%d" % (pos, total)))
    tags.add(TCON(encoding=3, text="Катха"))
    if year:
        tags.add(TDRC(encoding=3, text=str(year)))
    if comment:
        tags.add(COMM(encoding=3, lang="rus", desc="", text=comment))
    tags.save(str(path), v2_version=3)


def pack(zpath: Path, items: list) -> int:
    """items: [(Path, arcname)] → zip без сжатия; zip64 разрешён."""
    zpath.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with zipfile.ZipFile(zpath, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as z:
        for src, arc in items:
            z.write(src, arc)
            total += src.stat().st_size
    return total


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(CHUNK), b""):
            h.update(b)
    return h.hexdigest()


# ─────────────────────── главное ───────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--speaker", default="radha-govinda-goswami", help="slug рассказчика (katha_speakers.slug)")
    ap.add_argument("--out", default="out", help="папка результата")
    ap.add_argument("--albums", default="", help="только эти циклы (id через запятую)")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--source", choices=("ia", "proxy"), default="ia",
                    help="откуда байты: archive.org (по умолчанию, прокси — запасной) или только прокси приложения")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest()

    out = Path(a.out).resolve()
    work = out / "_work"
    out.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)

    catalog = json.loads(get(API + "/api/katha"))
    speakers = {s["slug"]: s for s in catalog.get("speakers", [])}
    if a.speaker not in speakers:
        print("::error::рассказчика %s нет в витрине; есть: %s" % (a.speaker, ", ".join(sorted(speakers))))
        return 1
    sp = speakers[a.speaker]
    albums = order_albums(catalog, a.speaker)
    if a.albums:
        want = {x.strip() for x in a.albums.split(",") if x.strip()}
        albums = [x for x in albums if x["id"] in want]
        missing = want - {x["id"] for x in albums}
        if missing:
            print("::error::в витрине нет циклов: %s" % ", ".join(sorted(missing)))
            return 1
    if not albums:
        print("::error::у %s нет ни одного цикла с записями" % a.speaker)
        return 1
    n_total = sum(len(x["tracks"]) for x in albums)
    print("Голос: %s · %s · %s" % (sp["name"], cycles(len(albums)), records(n_total)))

    # Метаданные архива — по одному запросу на цикл: размер и md5 каждого файла.
    ia_meta = {}
    for al in albums:
        for ident in {t["identifier"] for t in al["tracks"]}:
            if ident and ident not in ia_meta:
                ia_meta[ident] = ia_files(ident)

    # ── скачивание, параллельно по всем циклам ──
    jobs = []
    for al in albums:
        adir = work / al["id"]
        adir.mkdir(parents=True, exist_ok=True)
        for t in al["tracks"]:
            size, md5 = ia_meta.get(t["identifier"], {}).get(t["file"], (0, ""))
            jobs.append((al["id"], t, adir / t["file"], size, md5))

    def fetch(job):
        album_id, t, dst, size, md5 = job
        if dst.exists() and (not size or dst.stat().st_size == size):
            return album_id, t["file"], dst.stat().st_size, "есть", bool(md5)
        urls = []
        if a.source == "ia" and t["identifier"]:
            urls.append("%s/download/%s/%s" % (IA, t["identifier"], urllib.request.quote(t["file"])))
        urls.append("%s/audio/%s/%s" % (API, t["identifier"], urllib.request.quote(t["file"])))
        errs = []
        for u in urls:
            try:
                n = download(u, dst, size=size, md5=md5)
                return album_id, t["file"], n, "archive.org" if u.startswith(IA) else "прокси", bool(md5)
            except RuntimeError as e:
                errs.append(str(e))
        raise RuntimeError("%s/%s: %s" % (album_id, t["file"], " | ".join(errs)))

    failed = []
    got_bytes = 0
    verified = 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=max(1, a.workers)) as ex:
        futs = {ex.submit(fetch, j): j for j in jobs}
        done = 0
        for fut in as_completed(futs):
            done += 1
            try:
                album_id, fname, n, how, ok = fut.result()
                got_bytes += n
                verified += 1 if ok else 0
                print("  [%d/%d] %s/%s · %s · %s%s" % (done, len(jobs), album_id, fname, human(n), how, " · md5 ✓" if ok else ""))
            except RuntimeError as e:
                failed.append(str(e))
                print("::error::%s" % e)
    print("Скачано %s за %d с · сверено по md5 с archive.org: %d из %d" % (human(got_bytes), time.time() - t0, verified, len(jobs)))
    if failed:
        print("::error::не доехало %d из %d записей — архив НЕ собран (ЗКН-Ф021)" % (len(failed), len(jobs)))
        for f in failed:
            print("  ✗ " + f)
        return 1

    # ── теги + имена: сначала по всем циклам, чтобы СОДЕРЖАНИЕ легло в каждый zip ──
    root = safe("%s · %s" % (sp["name"], ROOT_SUFFIX))
    plan = []
    for al in albums:
        adir = work / al["id"]
        atitle = safe(al["title"])
        items, rows = [], []
        total = len(al["tracks"])
        for pos, t in enumerate(al["tracks"], 1):
            src = adir / t["file"]
            tag(src, title="%s · %s" % (al["title"], t["title"]), album=al["title"], artist=sp["name"],
                pos=pos, total=total, year=al.get("year") or "",
                comment=(al.get("note") or "") + (" · " if al.get("note") else "") + "brajs.com · ISKCON ONE LOVE")
            items.append((src, "%s/%s/%s" % (root, atitle, track_name(pos, atitle, t["title"]))))
            rows.append((pos, t["title"], t["duration"], src.stat().st_size))
        plan.append((al, items, rows, asset_name(a.speaker, al["id"])))

    all_secs = sum(r[2] for _, _, rows, _ in plan for r in rows)
    all_bytes = sum(r[3] for _, _, rows, _ in plan for r in rows)
    check = ("байты сверены по md5 с archive.org" if verified == len(jobs)
             else "по md5 с archive.org сверено %d из %d записей" % (verified, len(jobs)))
    head = "# %s · Катха\n\n%s\n\n%s · %s · %s · %s\n\nИсточник — https://brajs.com (Богатства → Катха); %s.\n\n" % (
        sp["name"], sp.get("bio") or sp.get("role") or "", cycles(len(plan)), records(n_total),
        hours_ru(all_secs), human(all_bytes), check)
    body = []
    for al, _, rows, zname in plan:
        meta = " · ".join(x for x in (al.get("year") or "", al.get("note") or "") if x)
        body.append("## %s\n\n%s`%s` · %s · %s\n" % (
            al["title"], (meta + "\n\n") if meta else "", zname, records(len(rows)), hours_ru(sum(r[2] for r in rows))))
        body.append("| № | Запись | Длительность | Размер |\n|---|---|---|---|")
        for pos, title, dur, size in rows:
            body.append("| %02d | %s | %s | %s |" % (pos, title, hms(dur), human(size)))
        body.append("")
    contents = out / "СОДЕРЖАНИЕ.md"
    contents.write_text(head + "\n".join(body), encoding="utf-8")

    # ── zip по циклам; СОДЕРЖАНИЕ.md лежит в корне каждого ──
    assets = []
    for al, items, rows, zname in plan:
        zpath = out / zname
        pack(zpath, items + [(contents, "%s/СОДЕРЖАНИЕ.md" % root)])
        secs = sum(r[2] for r in rows)
        assets.append({"file": zname, "album": al["title"], "id": al["id"], "n": len(rows), "secs": secs,
                       "bytes": zpath.stat().st_size, "sha256": sha256(zpath),
                       "year": al.get("year") or "", "note": al.get("note") or ""})
        for src, _ in items:  # место на диске: mp3 цикла больше не нужны
            src.unlink()
        print("  zip %s · %s · %s · %s" % (zname, records(len(rows)), hours_ru(secs), human(zpath.stat().st_size)))
    grand = sum(x["bytes"] for x in assets)
    (out / "SHA256SUMS.txt").write_text("".join("%s  %s\n" % (x["sha256"], x["file"]) for x in assets), encoding="utf-8")

    notes = ["**%s** — полный архив катхи: %s · %s · %s · %s.\n" % (
        sp["name"], cycles(len(assets)), records(n_total), hours_ru(all_secs), human(grand))]
    notes.append("Один zip на цикл (GitHub держит ≤2 ГБ на файл); все распаковываются в одну папку "
                 "«%s». Внутри — mp3 с человеческими именами и тегами (артист, альбом, номер, год) "
                 "и список «СОДЕРЖАНИЕ.md».\n" % root)
    notes.append("Источник — те же записи, что играют в приложении: https://brajs.com (Богатства → Катха); %s.\n" % check)
    notes.append("| Цикл | Записей | Длительность | Размер | Файл |\n|---|---|---|---|---|")
    for x in assets:
        notes.append("| %s | %d | %s | %s | `%s` |" % (x["album"], x["n"], hours_ru(x["secs"]), human(x["bytes"]), x["file"]))
    notes.append("\n<details><summary>Все записи</summary>\n")
    for al, _, rows, _ in plan:
        notes.append("\n**%s**\n" % al["title"])
        for pos, title, dur, _ in rows:
            notes.append("- %02d · %s · %s" % (pos, title, hms(dur)))
    notes.append("\n</details>\n")
    notes.append("Контрольные суммы zip — `SHA256SUMS.txt`.")
    (out / "release-notes.md").write_text("\n".join(notes), encoding="utf-8")

    summary = {"speaker": a.speaker, "name": sp["name"], "albums": len(assets), "tracks": n_total,
               "secs": all_secs, "hours": hours_ru(all_secs), "bytes": grand, "assets": assets}
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as f:
            f.write("tracks=%d\nhours=%s\nsize=%s\nassets=%s\n" % (
                n_total, hours_ru(all_secs), human(grand), " ".join(x["file"] for x in assets)))
    print("Готово: %d zip · %s · %s · %s → %s" % (len(assets), records(n_total), hours_ru(all_secs), human(grand), out))
    return 0


if __name__ == "__main__":
    sys.exit(main())

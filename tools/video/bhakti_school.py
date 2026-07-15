#!/usr/bin/env python3
"""
Видео @bhakti.school → archive.org → лента (ЗКН-Пл020).

Ролики Школы Бхакти не встраиваются с YouTube (реклама, трекинг, уход из
приложения, ломкие эмбеды) — они скачиваются, ПЕРЕЗАЛИВАЮТСЯ на наш archive.org
по стандарту и играют внутри приложения бесшовным <video> из stream_url. Тот же
закон, что у ленты Telegram (Пл002): тяжёлое медиа — на IA, инлайн-плеер, дедуп.

Конвейер (идемпотентный, K роликов за прогон — видео тяжёлое):
  1. yt-dlp читает плейлист @bhakti.school/videos (плоско: id + заголовок + дата).
  2. guid = "youtube:<vid>" — уже загруженное ПРОПУСКАЕМ (дедуп по D1, ЗКН-Пл006).
  3. Качаем лучший mp4 ≤1080p + превью; льём на archive.org (identifier
     bhakti-school-<vid>, mediatype movies, коллекция, источник в метаданных).
  4. Переводим заголовок на русский через Claude с BBT-точностью (глоссарий
     канонических имён; НОЛЬ фабрикации) + короткое описание.
  5. Пишем в D1 (feed_media) параметризованно (ЗКН-П002). stream_url — прямой mp4
     на archive.org: лента играет его как рилс.

Запуск:
  python3 tools/video/bhakti_school.py --limit 3
  python3 tools/video/bhakti_school.py --selftest        # юнит чистых функций
Переменные: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ANTHROPIC_API_KEY,
            IA_ACCESS_KEY, IA_SECRET_KEY.

ЗКН-Ф014: скрипт говорит, ЧТО именно сломалось, а не «exit 1».
ЗКН-Пл020: стороннее видео перезаливается на archive.org, а не хотлинкуется.
"""
import argparse
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "goldforge"))
import d1  # noqa: E402

ANTHROPIC = "https://api.anthropic.com/v1/messages"
MODEL = os.environ.get("VIDEO_MODEL", "claude-sonnet-5")
CHANNEL = "https://www.youtube.com/@bhakti.school/videos"
SOURCE = "youtube.com"
SOURCE_LABEL = "Школа Бхакти"
AUTHOR = "Школа Бхакти / Bhakti School"
COLLECTION = os.environ.get("IA_COLLECTION", "opensource_movies")

# BBT-глоссарий канонических имён — переводчик обязан их соблюдать (ЗКН-ПР005).
SYSTEM = (
    "Ты — переводчик гаудия-вайшнавского контента с BBT-точностью (Бхактиведанта Бук "
    "Траст / Шрила Прабхупада). Переведи заголовок видео с английского на русский и "
    "напиши ОДНО короткое предложение-описание по-русски. НОЛЬ фабрикации: не добавляй "
    "фактов, которых нет в заголовке. Канон имён (строго): «Гауранга Махапрабху» "
    "(Навадвипа-лила) и «Шри Кришна Чайтанья Махапрабху» (после санньясы); формы «Шри "
    "Чайтанья», «Чайтанья», «Гаура-лила», одиночное «Радхарани» — ЗАПРЕЩЕНЫ; «Шримати "
    "Радхарани», «Шрила Прабхупада», «Кришна». Верни СТРОГО JSON без обрамления: "
    '{"title": "...", "summary": "..."}.'
)


# ─────────────────────── чистые функции (selftest) ───────────────────────

def vid_of(entry):
    """Достаём YouTube-id из записи плейлиста yt-dlp (или из URL)."""
    if isinstance(entry, dict):
        v = entry.get("id") or ""
        if v:
            return v
        entry = entry.get("url") or entry.get("webpage_url") or ""
    m = re.search(r"(?:v=|/shorts/|youtu\.be/|/watch\?v=)?([A-Za-z0-9_-]{11})", entry or "")
    return m.group(1) if m else ""


def ident_of(vid):
    """Идентификатор архива: bhakti-school-<vid>, только [a-z0-9._-]."""
    return "bhakti-school-" + re.sub(r"[^a-z0-9._-]+", "-", (vid or "").lower()).strip("-")


def fmt_dur(sec):
    """Секунды → «M:SS» или «H:MM:SS»."""
    try:
        s = int(float(sec or 0))
    except (TypeError, ValueError):
        return ""
    if s <= 0:
        return ""
    h, rem = divmod(s, 3600)
    m, ss = divmod(rem, 60)
    return "%d:%02d:%02d" % (h, m, ss) if h else "%d:%02d" % (m, ss)


def iso_of(upload_date):
    """yt-dlp upload_date «YYYYMMDD» → ISO «YYYY-MM-DDT00:00:00Z»."""
    s = str(upload_date or "").strip()
    if re.fullmatch(r"\d{8}", s):
        return "%s-%s-%sT00:00:00Z" % (s[0:4], s[4:6], s[6:8])
    return ""


def watch_url(vid):
    return "https://www.youtube.com/watch?v=" + vid


def ia_file_url(ident, name):
    return "https://archive.org/download/%s/%s" % (ident, name)


# ─────────────────────── yt-dlp ───────────────────────

def ytdlp():
    try:
        import yt_dlp  # noqa: F401
        return __import__("yt_dlp")
    except Exception as e:  # noqa: BLE001
        raise SystemExit("::error title=yt-dlp::не установлен — %s" % e)


def list_videos(limit):
    """Плоский список последних видео канала (новые первыми)."""
    yt = ytdlp()
    opts = {"quiet": True, "skip_download": True, "extract_flat": "in_playlist",
            "playlistend": max(limit * 4, 20), "ignoreerrors": True}
    with yt.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(CHANNEL, download=False)
    entries = (info or {}).get("entries") or []
    out = []
    for e in entries:
        vid = vid_of(e)
        if vid:
            out.append({"vid": vid, "title": (e.get("title") or "").strip()})
    return out


def fetch_one(vid, workdir):
    """Скачиваем лучший mp4 ≤1080p + превью. Возвращаем (mp4_path, thumb_path, meta)."""
    yt = ytdlp()
    out_tmpl = os.path.join(workdir, "%(id)s.%(ext)s")
    opts = {
        "quiet": True, "noprogress": True, "ignoreerrors": False,
        "outtmpl": out_tmpl, "writethumbnail": True, "merge_output_format": "mp4",
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
        "postprocessors": [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}],
    }
    with yt.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(watch_url(vid), download=True)
    mp4 = os.path.join(workdir, vid + ".mp4")
    if not os.path.exists(mp4):
        # иногда расширение остаётся исходным — берём первый видеофайл id.*
        cand = [f for f in os.listdir(workdir) if f.startswith(vid + ".") and not f.endswith((".jpg", ".webp", ".png"))]
        if cand:
            mp4 = os.path.join(workdir, cand[0])
    thumb = None
    for ext in ("jpg", "webp", "png"):
        p = os.path.join(workdir, vid + "." + ext)
        if os.path.exists(p):
            thumb = p
            break
    return mp4, thumb, (info or {})


# ─────────────────────── Internet Archive ───────────────────────

def ia_upload_files(ident, files, md):
    from internetarchive import upload as ia_upload
    ak = os.environ["IA_ACCESS_KEY"]
    sk = os.environ["IA_SECRET_KEY"]
    # queue_derive=False — не плодим производные форматы, mp4 остаётся по предсказуемому
    # адресу /download/<ident>/<vid>.mp4 (иначе IA переименовывает/деривит — Пл-практика).
    ia_upload(ident, files=files, metadata=md, access_key=ak, secret_key=sk,
              retries=4, queue_derive=False, verbose=True)


# ─────────────────────── перевод ───────────────────────

def translate_title(title_en):
    body = json.dumps({
        "model": MODEL, "max_tokens": 700, "system": SYSTEM,
        "messages": [{"role": "user", "content": title_en}],
    }).encode()
    req = urllib.request.Request(ANTHROPIC, data=body, headers={
        "x-api-key": os.environ["ANTHROPIC_API_KEY"],
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    })
    last = ""
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                d = json.load(r)
            txt = "".join(b.get("text", "") for b in d.get("content", []) if b.get("type") == "text")
            txt = txt.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            obj = json.loads(txt)
            t = (obj.get("title") or "").strip()
            if t:
                return t, (obj.get("summary") or "").strip()
            raise ValueError("пустой перевод")
        except urllib.error.HTTPError as e:
            last = "HTTP %s — %s" % (e.code, e.read().decode("utf-8", "replace")[:200])
        except Exception as e:  # noqa: BLE001
            last = str(e)[:200]
        time.sleep(2.0 * (i + 1))
    raise SystemExit("::error title=Anthropic::%s" % last)


# ─────────────────────── D1 ───────────────────────

def already(guid):
    return bool(d1.query("SELECT 1 FROM feed_media WHERE guid=?1 LIMIT 1", [guid]))


def insert(rec):
    d1.query(
        "INSERT OR IGNORE INTO feed_media "
        "(guid, kind, source, source_label, url, stream_url, ia_identifier, thumb, "
        " duration, published_at, author, title_en, title_ru, summary_ru, status) "
        "VALUES (?1,'video',?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,'published')",
        [rec["guid"], SOURCE, SOURCE_LABEL, rec["url"], rec["stream_url"], rec["ident"],
         rec["thumb"], rec["duration"], rec["published_at"], AUTHOR,
         rec["title_en"], rec["title_ru"], rec["summary_ru"]],
    )


# ─────────────────────── прогон ───────────────────────

def run(limit):
    for key in ("ANTHROPIC_API_KEY", "IA_ACCESS_KEY", "IA_SECRET_KEY"):
        if not os.environ.get(key):
            raise SystemExit("::error::нет %s" % key)
    if not d1.available():
        raise SystemExit("::error::нет доступа к D1 (CLOUDFLARE_API_TOKEN/ACCOUNT_ID)")

    vids = list_videos(limit)
    print("::notice::плейлист @bhakti.school: %d роликов" % len(vids))
    done = 0
    for v in vids:
        if done >= limit:
            break
        vid = v["vid"]
        guid = "youtube:" + vid
        if already(guid):
            continue
        ident = ident_of(vid)
        try:
            with tempfile.TemporaryDirectory() as wd:
                mp4, thumb, info = fetch_one(vid, wd)
                if not mp4 or not os.path.exists(mp4):
                    print("::warning::%s — mp4 не скачался, пропуск" % vid)
                    continue
                title_en = (info.get("title") or v["title"] or vid).strip()
                dur = fmt_dur(info.get("duration"))
                pub = iso_of(info.get("upload_date")) or time.strftime("%Y-%m-%dT00:00:00Z")
                mp4_name = vid + ".mp4"
                files = {mp4_name: mp4}
                thumb_name = None
                if thumb:
                    thumb_name = vid + os.path.splitext(thumb)[1].lower()
                    files[thumb_name] = thumb
                md = {
                    "title": title_en,
                    "mediatype": "movies",
                    "collection": COLLECTION,
                    "creator": AUTHOR,
                    "subject": ["Gaudiya Vaishnava", "ISKCON", "Bhakti", "kirtan", "lecture", "Bhakti School"],
                    "language": "eng",
                    "originalurl": watch_url(vid),
                    "source": watch_url(vid),
                    "licenseurl": "https://creativecommons.org/licenses/by-nc-nd/4.0/",
                    "description": (
                        'Видео Школы Бхакти (@bhakti.school), перезалито в библиотеку '
                        'ISKCON ONE LOVE (gaurangers.com) для инлайн-воспроизведения. '
                        'Источник: %s' % watch_url(vid)
                    ),
                }
                ia_upload_files(ident, files, md)
                title_ru, summary_ru = translate_title(title_en)
                insert({
                    "guid": guid, "url": watch_url(vid),
                    "stream_url": ia_file_url(ident, mp4_name), "ident": ident,
                    "thumb": ia_file_url(ident, thumb_name) if thumb_name else "",
                    "duration": dur, "published_at": pub,
                    "title_en": title_en, "title_ru": title_ru, "summary_ru": summary_ru,
                })
                done += 1
                print("::notice::+ %s → %s (%s)" % (vid, title_ru, dur or "?"))
        except SystemExit:
            raise
        except Exception as e:  # noqa: BLE001
            print("::warning::%s — сбой: %s" % (vid, str(e)[:200]))
            continue
    print("::notice::залито новых видео: %d" % done)


def selftest():
    assert vid_of({"id": "dQw4w9WgXcQ"}) == "dQw4w9WgXcQ"
    assert vid_of("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert vid_of({"url": "https://www.youtube.com/watch?v=abcdef12345"}) == "abcdef12345"
    assert ident_of("dQw4w9WgXcQ") == "bhakti-school-dqw4w9wgxcq"
    assert fmt_dur(0) == "" and fmt_dur(65) == "1:05" and fmt_dur(3725) == "1:02:05"
    assert iso_of("20260714") == "2026-07-14T00:00:00Z"
    assert iso_of("") == ""
    assert ia_file_url("bhakti-school-x", "x.mp4") == "https://archive.org/download/bhakti-school-x/x.mp4"
    print("selftest OK")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=3, help="сколько НОВЫХ видео за прогон")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        selftest()
        return
    run(a.limit)


if __name__ == "__main__":
    main()

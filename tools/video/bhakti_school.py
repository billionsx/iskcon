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
Переменные: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
            IA_ACCESS_KEY, IA_SECRET_KEY.  Перевод заголовка — бесплатный, без ключа
            (ЗКН-Пр008).

YT_COOKIES (опционально, но обычно ОБЯЗАТЕЛЬНО в CI): YouTube режет дата-центровые
IP GitHub Actions и требует вход. Секрет YT_COOKIES = содержимое cookies.txt в формате
Netscape для авторизованной сессии youtube.com. Как получить: расширение браузера
«Get cookies.txt LOCALLY» → зайти на youtube.com под аккаунтом → экспортировать
cookies.txt → вставить весь файл в секрет репозитория YT_COOKIES. Куки живут недели —
при протухании прогон падает с понятной ошибкой, обновить тем же путём.

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
# Перевод заголовка — тот же бесплатный переводчик + канонизатор имён, что у новостей
# (ЗКН-Д002: один источник, без копий; ЗКН-Пр008: бесплатно, без ключа/баланса).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "news"))
from iskcon_news import translate as free_translate, TranslateFailed  # noqa: E402

CHANNEL = "https://www.youtube.com/@bhakti.school/videos"
SOURCE = "youtube.com"
SOURCE_LABEL = "Школа Бхакти"
AUTHOR = "Школа Бхакти / Bhakti School"
COLLECTION = os.environ.get("IA_COLLECTION", "opensource_movies")


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


def ytdlp_version():
    try:
        return getattr(ytdlp().version, "__version__", "?")
    except Exception:  # noqa: BLE001
        return "?"


# YouTube жёстко режет дата-центровые IP GitHub Actions и часто требует вход.
# Два рычага делают выкачку устойчивой:
#   • YT_COOKIES — cookies.txt (Netscape) авторизованной сессии youtube.com, положенный
#     секретом; пишем во временный файл и передаём yt-dlp (главный, надёжный рычаг);
#   • перебор player_client — иногда пускает и без входа (запасной рычаг).
_COOKIEFILE = None  # "" — искали и не нашли; путь — нашли; None — ещё не искали


def cookiefile():
    global _COOKIEFILE
    if _COOKIEFILE is None:
        raw = os.environ.get("YT_COOKIES", "").strip()
        if raw:
            fd, path = tempfile.mkstemp(suffix=".txt", prefix="ytcookies_")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(raw if raw.endswith("\n") else raw + "\n")
            _COOKIEFILE = path
        else:
            _COOKIEFILE = ""
    return _COOKIEFILE or None


def common_opts():
    """Общие ключи yt-dlp для обхода защиты YouTube 2026:
      • cookies — вход (обход bot-check);
      • fetch_pot=always — PO-token у bgutil-провайдера (обход SABR);
      • js_runtimes=deno + remote_components=ejs — решение n-challenge (иначе «нет форматов»)."""
    opts = {
        "retries": 3, "extractor_retries": 3, "socket_timeout": 30,
        "js_runtimes": {"deno": {}},
        "remote_components": {"ejs:github", "ejs:npm"},
        "extractor_args": {"youtube": {"fetch_pot": ["always"]}},
    }
    cf = cookiefile()
    if cf:
        opts["cookiefile"] = cf
    return opts


def list_videos(limit):
    """Плоский список последних видео канала (новые первыми)."""
    yt = ytdlp()
    opts = {"quiet": True, "skip_download": True, "extract_flat": "in_playlist",
            "playlistend": max(limit * 4, 20), "ignoreerrors": True, **common_opts()}
    with yt.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(CHANNEL, download=False)
    entries = (info or {}).get("entries") or []
    out = []
    for e in entries:
        vid = vid_of(e)
        if vid:
            out.append({"vid": vid, "title": (e.get("title") or "").strip()})
    return out


def probe_formats(vid):
    """Диагностика: какие форматы yt-dlp реально видит у ролика (при сбое выкачки)."""
    yt = ytdlp()
    try:
        with yt.YoutubeDL({"quiet": True, "skip_download": True, **common_opts()}) as ydl:
            info = ydl.extract_info(watch_url(vid), download=False)
        fmts = (info or {}).get("formats") or []
        if not fmts:
            print("::warning title=Форматы %s::0 форматов — YouTube не отдаёт скачиваемых потоков (SABR/PO-token)" % vid)
            return
        rows = []
        for f in fmts[:30]:
            rows.append("%s/%s %sx%s v=%s a=%s %s" % (
                f.get("format_id"), f.get("ext"), f.get("width") or "?", f.get("height") or "?",
                (f.get("vcodec") or "-")[:8], (f.get("acodec") or "-")[:8], (f.get("format_note") or "")[:14]))
        print("::warning title=Форматы %s (%d)::%s" % (vid, len(fmts), " || ".join(rows)))
    except Exception as e:  # noqa: BLE001
        print("::warning title=Проба форматов %s::%s" % (vid, str(e)[:160]))


def fetch_one(vid, workdir):
    """Скачиваем лучший mp4 ≤1080p + превью. Возвращаем (mp4_path, thumb_path, meta)."""
    yt = ytdlp()
    out_tmpl = os.path.join(workdir, "%(id)s.%(ext)s")
    opts = {
        "quiet": True, "noprogress": True, "ignoreerrors": False,
        "outtmpl": out_tmpl, "writethumbnail": True, "merge_output_format": "mp4",
        "format": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
        "postprocessors": [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}],
        **common_opts(),
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


# ─────────────────────── перевод (бесплатный) ───────────────────────

def translate_title(title_en):
    """Заголовок EN→RU бесплатно (Google→MyMemory) + канонизатор имён.
    Отказ обоих переводчиков — поднимаем TranslateFailed (видео пропустим)."""
    t = free_translate(title_en)
    if not t:
        raise TranslateFailed("пустой перевод заголовка")
    return t


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
    for key in ("IA_ACCESS_KEY", "IA_SECRET_KEY"):
        if not os.environ.get(key):
            raise SystemExit("::error::нет %s" % key)
    if not d1.available():
        raise SystemExit("::error::нет доступа к D1 (CLOUDFLARE_API_TOKEN/ACCOUNT_ID)")

    have_cookies = bool(cookiefile())
    print("::notice::yt-dlp %s · cookies YT_COOKIES: %s" % (ytdlp_version(), "есть" if have_cookies else "НЕТ"))
    vids = list_videos(limit)
    print("::notice::плейлист @bhakti.school: %d роликов" % len(vids))
    if not vids:
        raise SystemExit(
            "::error title=YouTube заблокировал выкачку::плейлист пуст. YouTube режет IP "
            "GitHub Actions или требует вход. Нужен секрет YT_COOKIES — содержимое cookies.txt "
            "(формат Netscape) авторизованной сессии youtube.com. См. инструкцию в шапке скрипта."
        )
    done = 0
    fetched = 0  # сколько НОВЫХ роликов реально пытались скачать (не дедуп)
    for v in vids:
        if done >= limit or fetched >= limit + 4:
            break
        vid = v["vid"]
        guid = "youtube:" + vid
        if already(guid):
            continue
        fetched += 1
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
                try:
                    title_ru = translate_title(title_en)
                except TranslateFailed as e:
                    print("::warning::%s — перевод заголовка не удался (%s), пропуск" % (vid, e))
                    continue
                summary_ru = ""
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
            if fetched == 1:
                probe_formats(vid)
            continue
    print("::notice::залито новых видео: %d" % done)
    if done == 0 and fetched > 0:
        raise SystemExit(
            "::error title=Выкачка не удалась::найдено %d новых роликов, но ни один не "
            "скачался/не залился (см. предупреждения выше). Вероятно, нужен YT_COOKIES." % fetched
        )


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

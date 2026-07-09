#!/usr/bin/env python3
"""ia_faststart.py — веб-оптимизация уже залитых на archive.org видео.

Зачем: старые ролики ленты (например скачанные с YouTube 1080p) залиты БЕЗ faststart —
moov-атом в конце файла. Крупный такой mp4 браузер не проигрывает инлайн
(<video autoPlay preload=metadata>): onError → лента уходит в Telegram-iframe
(«Media is too big»). Плюс воркер кеширует каждый /video/<file> НЕИЗМЕННО на год
(cf cacheTtl=31536000), поэтому перезапись файла под тем же именем бесполезна —
на краю останутся старые байты. Значит заливаем faststart-версию под НОВЫМ именем
(<stem>.web.mp4) и печатаем его — а feed_video.src переключаем на новое имя.

Что делает: для каждого файла в объекте IA —
  1) скачивает его,
  2) перекладывает moov в начало (-c copy, без перекодирования; иначе h264/aac),
  3) заливает результат обратно в тот же объект под именем <stem>.web.mp4,
  4) печатает строку  OK <старое_имя> -> <новое_имя>  для обновления D1.

usage:
  IA_ACCESS_KEY=.. IA_SECRET_KEY=.. python ia_faststart.py <identifier> <file1[,file2,...]>

Секреты — только из окружения. В коде их нет.
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def die(msg: str, code: int = 1):
    print(f"ERR: {msg}", file=sys.stderr)
    sys.exit(code)


def remux_faststart(src: Path, dst: Path) -> bool:
    """moov в начало. Сначала без перекодирования; если кодеки не веб — перекод."""
    def run(cmd):
        return subprocess.run(cmd).returncode
    rc = run(["ffmpeg", "-y", "-i", str(src), "-c", "copy",
              "-movflags", "+faststart", str(dst)])
    if rc == 0 and dst.exists() and dst.stat().st_size > 0:
        return True
    if dst.exists():
        dst.unlink()
    rc = run(["ffmpeg", "-y", "-i", str(src), "-c:v", "libx264", "-preset", "veryfast",
              "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
              "-movflags", "+faststart", str(dst)])
    return rc == 0 and dst.exists() and dst.stat().st_size > 0


def main():
    if len(sys.argv) < 3:
        die("usage: ia_faststart.py <identifier> <file1[,file2,...]>")
    ident = sys.argv[1].strip()
    files = [x.strip() for x in sys.argv[2].split(",") if x.strip()]
    ak, sk = os.getenv("IA_ACCESS_KEY"), os.getenv("IA_SECRET_KEY")
    if not ak or not sk:
        die("нет IA_ACCESS_KEY / IA_SECRET_KEY")
    if shutil.which("ffmpeg") is None:
        die("нет ffmpeg")

    from internetarchive import download as ia_download, upload as ia_upload

    def err(fn, msg):
        # аннотация читается через checks API (api.github.com), в отличие от blob-логов
        print(f"::error title=faststart::{fn}: {msg}", flush=True)

    work = Path(tempfile.mkdtemp(prefix="iafs_"))
    done = 0
    for fn in files:
        print(f"== {fn} ==", flush=True)
        try:
            ia_download(ident, files=[fn], destdir=str(work),
                        ignore_existing=True, retries=3, verbose=False)
        except Exception as e:
            err(fn, f"download error: {e}")
            continue
        local = work / ident / fn
        if not local.exists() or local.stat().st_size == 0:
            err(fn, "файл не скачался из IA")
            continue
        before = local.stat().st_size
        # Новое имя: всегда .web.mp4 (контейнер после faststart — mp4).
        base = fn[:-4] if fn.lower().endswith((".mp4", ".mov", ".m4v")) else fn
        new_name = f"{base}.web.mp4"
        out = local.parent / new_name
        if not remux_faststart(local, out):
            err(fn, "ffmpeg remux не удался")
            continue
        after = out.stat().st_size
        try:
            resp = ia_upload(ident, files={new_name: str(out)}, access_key=ak,
                             secret_key=sk, retries=3, queue_derive=False, verbose=True)
        except Exception as e:
            err(fn, f"upload error: {e}")
            continue
        bad = [r for r in resp if getattr(r, "status_code", 200) not in (200, None)]
        if bad:
            err(fn, f"upload status {[getattr(r, 'status_code', None) for r in bad]}")
            continue
        print(f"  {before} -> {after} байт", flush=True)
        print(f"::notice title=faststart::OK {fn} -> {new_name}", flush=True)
        done += 1

    print(f"Готово: {done}/{len(files)}")
    if done == 0:
        sys.exit(2)


if __name__ == "__main__":
    main()

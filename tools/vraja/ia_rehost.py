#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Рехост hero-фото святых мест Враджа с vrajapedia.com в Internet Archive,
чтобы приложение ходило в archive.org, а не на исходный сайт.

Один объект: iskcone-vraja-tirthas, файлы вида <tirtha_id>.<ext>.
Идемпотентно: уже залитые файлы пропускаются; уже переписанные на archive URL
строки не трогаются. hero_image переписывается ТОЛЬКО после проверки, что
archive-URL реально отдаёт картинку (иначе оставляем исходный — не ломаем фото).
Атрибуция: онлайн-энциклопедия Вриндавана «Шри Рупа Сева Кундж», с разрешения.
"""
import os, re, json, time, tempfile, subprocess, urllib.request

CF = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1 = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
IDENT = "iskcone-vraja-tirthas"
APP = "https://gaurangers.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body, headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    with urllib.request.urlopen(rq, timeout=90) as r:
        return json.loads(r.read().decode())


def rows(res):
    return res["result"][0]["results"]


def ext_of(url):
    p = re.sub(r"[?#].*$", "", url or "")
    m = re.search(r"\.([A-Za-z0-9]{2,4})$", p)
    e = (m.group(1).lower() if m else "jpg")
    return "jpg" if e == "jpeg" else e


def sniff_ext(path, fallback):
    try:
        with open(path, "rb") as f:
            h = f.read(16)
    except Exception:
        return fallback
    if h[:3] == b"\xff\xd8\xff": return "jpg"
    if h[:8] == b"\x89PNG\r\n\x1a\n": return "png"
    if h[:4] == b"RIFF" and b"WEBP" in h: return "webp"
    if h[:6] in (b"GIF87a", b"GIF89a"): return "gif"
    return fallback


def download(url, dest):
    out = subprocess.run(["curl", "-sS", "-L", "--compressed", "-m", "90", "-A", UA,
                          "-H", "Referer: https://vrajapedia.com/", "-o", dest,
                          "-w", "%{http_code}", url], capture_output=True, text=True, timeout=120)
    code = (out.stdout or "").strip()[-3:]
    sz = os.path.getsize(dest) if os.path.exists(dest) else 0
    return code, sz


def verify(url, tries=4):
    for _ in range(tries):
        out = subprocess.run(["curl", "-sS", "-I", "-L", "-m", "30", "-A", UA, "-o", "/dev/null", "-w", "%{http_code}", url],
                             capture_output=True, text=True, timeout=45)
        if (out.stdout or "").strip()[-3:] == "200":
            return True
        time.sleep(5)
    return False


def main():
    from internetarchive import upload as ia_upload, get_item
    ak = os.environ["IA_ACCESS_KEY"]; sk = os.environ["IA_SECRET_KEY"]

    tr = rows(d1("SELECT id,name,hero_image FROM tirthas WHERE dhama_id='vrindavan' AND hero_image LIKE '%vrajapedia.com%' ORDER BY id"))
    try:
        existing = {f.name for f in get_item(IDENT).files}
    except Exception:
        existing = set()

    md = {
        "title": "Святые места Враджа — фотографии",
        "mediatype": "image",
        "creator": "Sri Rupa Seva Kunj",
        "subject": ["Vraja", "Vrindavan", "Gaudiya Vaishnava", "tirtha", "holy places", "ISKCON"],
        "language": "rus",
        "description": (f'Фотографии святых мест Враджа-мандалы для библиотеки ISKCON ONE LOVE '
                        f'(<a href="{APP}">gaurangers.com</a>). Источник: онлайн-энциклопедия '
                        f'Вриндавана «Шри Рупа Сева Кундж» (vrajapedia.com), с разрешения правообладателя.'),
    }
    md_first = md

    n_up = n_skip = n_rw = n_err = 0
    errs = []
    for r in tr:
        tid = r["id"]; src = r["hero_image"]
        url_ext = ext_of(src)
        # ищем уже залитый файл с этим id
        match = next((f for f in existing if f.rsplit(".", 1)[0] == tid), None)
        fname = match
        try:
            if fname is None:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tf:
                    tmp = tf.name
                code, sz = download(src, tmp)
                if code != "200" or sz < 800:
                    n_err += 1; errs.append(f"{tid}: dl {code}/{sz}b"); 
                    try: os.unlink(tmp)
                    except Exception: pass
                    continue
                fname = tid + "." + sniff_ext(tmp, url_ext)
                ia_upload(IDENT, files={fname: tmp}, metadata=(md_first or {}),
                          access_key=ak, secret_key=sk, retries=4, verbose=False)
                md_first = None
                existing.add(fname)
                n_up += 1
                try: os.unlink(tmp)
                except Exception: pass
                time.sleep(0.4)
            else:
                n_skip += 1
            new_url = f"https://archive.org/download/{IDENT}/{fname}"
            if verify(new_url):
                d1("UPDATE tirthas SET hero_image=? WHERE id=?", [new_url, tid])
                n_rw += 1
            else:
                errs.append(f"{tid}: verify fail")
        except Exception as e:
            n_err += 1; errs.append(f"{tid}: {str(e)[:120]}")

    left = rows(d1("SELECT SUM(hero_image LIKE '%vrajapedia.com%') vp, SUM(hero_image LIKE '%archive.org%') ia FROM tirthas WHERE dhama_id='vrindavan'"))[0]
    lines = [
        f"uploaded={n_up} skipped_existing={n_skip} rewritten={n_rw} errors={n_err} | candidates={len(tr)}",
        f"hero now: still_vrajapedia={left.get('vp')} on_archive={left.get('ia')}",
    ]
    if errs:
        lines.append("ERR: " + " || ".join(errs[:8]))
    body = "\n".join(lines)[:5500]
    try:
        d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-rehost DONE',0,?)", [body])
    except Exception as e:
        print("sum err", str(e)[:160])
    print(body)


main()

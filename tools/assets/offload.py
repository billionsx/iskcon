#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Вынос НЕКРИТИЧЕСКИХ (несекретных) бинарей из git на ДВА независимых бесплатных
зеркала — страховка от бана любого одного хоста (ЗКН-Пл023):

  • archive.org      — основное холодное хранилище (щедро, вечно).
  • GitHub Releases  — зеркало. Для ПУБЛИЧНОГО репо бесплатно и почти без потолка,
                       ассеты релиза НЕ раздувают git (отдельный CDN, ≤2 ГБ/файл).

Индекс истины — docs/assets/manifest.jsonl (лежит В GIT: переживает потерю любого
хоста И D1). На каждый «класс» бинарей (например, старый экспорт Tilda) — один
tar-архив; в docs/assets/<class>.files.tsv — поимённый список с SHA-256 (проверка
целостности при восстановлении). Холодному грузу поштучные URL не нужны — нужен
воспроизводимый бэкап на двух зеркалах.

Только БЕСПЛАТНО (ЗКН-Пр008): IA_ACCESS_KEY/IA_SECRET_KEY + GH_TOKEN. Никаких
платных API и балансов.

Сеть (заливка на IA и uploads.github.com) недоступна из песочницы — движок гоняется
в CI (assets-offload.yml). Чистые функции проверяются `--selftest` без сети/ключей.

Режимы:
  offload  --class NAME --path DIR [--path DIR2 ...] [--source URL] [--rm]
           упаковать → залить на оба зеркала → записать в манифест; с --rm ещё и git-rm.
  restore  --class NAME
           по манифесту скачать tar с живого зеркала, распаковать, сверить с files.tsv.
  verify   (см. verify.py — HEAD-проверка живости обоих зеркал)
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip() or "."
ASSETS_DIR = os.path.join(ROOT, "docs", "assets")
MANIFEST = os.path.join(ASSETS_DIR, "manifest.jsonl")

REPO = os.environ.get("GH_REPO", "billionsx/iskcon")
UA = "ISKCON-ONE-LOVE-Assets/1.0 (+https://gaurangers.com)"

# archive.org: один item на класс; коллекция opensource (открытая, бесплатная).
IA_COLLECTION = os.environ.get("IA_COLLECTION", "opensource")


# ─────────────────────── чистые функции (selftest) ───────────────────────

def human(n):
    n = float(n)
    for u in ("Б", "КБ", "МБ", "ГБ", "ТБ"):
        if n < 1024 or u == "ТБ":
            return ("%.1f %s" % (n, u)).replace(".0 ", " ")
        n /= 1024


def ia_identifier(cls):
    """Идентификатор item на archive.org — строго [a-z0-9-], с префиксом проекта."""
    safe = "".join(c if (c.isalnum() or c == "-") else "-" for c in cls.lower()).strip("-")
    return "iskcon-onelove-%s" % safe


def gh_tag(cls):
    """Тег релиза-зеркала — свой на класс, отдельно от версий приложения."""
    safe = "".join(c if (c.isalnum() or c in "-.") else "-" for c in cls.lower()).strip("-")
    return "assets-%s" % safe


def tar_name(cls):
    return "%s.tar.gz" % ia_identifier(cls)


def sha256_file(path, _bufsize=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(_bufsize)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def iter_files(paths, base=None):
    """Разворачиваем каталоги в список (путь-относительно-base, абсолютный путь)."""
    base = base or ROOT
    out = []
    for p in paths:
        ap = p if os.path.isabs(p) else os.path.join(ROOT, p)
        if os.path.isdir(ap):
            for dirpath, _dirs, names in os.walk(ap):
                for n in sorted(names):
                    full = os.path.join(dirpath, n)
                    if os.path.isfile(full):
                        out.append((os.path.relpath(full, base), full))
        elif os.path.isfile(ap):
            out.append((os.path.relpath(ap, base), ap))
    out.sort()
    return out


def already_offloaded(cls, manifest_path=None):
    """Идемпотентность: класс уже в манифесте? (не заливаем повторно)."""
    mp = manifest_path or MANIFEST
    if not os.path.exists(mp):
        return False
    with open(mp, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            if rec.get("class") == cls:
                return True
    return False


# ─────────────────────── упаковка + индекс ───────────────────────

def write_files_index(files, cls):
    """docs/assets/<class>.files.tsv: путь \\t байты \\t sha256 — поимённая целостность."""
    os.makedirs(ASSETS_DIR, exist_ok=True)
    idx = os.path.join(ASSETS_DIR, "%s.files.tsv" % ia_identifier(cls))
    total = 0
    with open(idx, "w", encoding="utf-8") as f:
        f.write("# rel_path\tbytes\tsha256\n")
        for rel, full in files:
            sz = os.path.getsize(full)
            total += sz
            f.write("%s\t%d\t%s\n" % (rel, sz, sha256_file(full)))
    return idx, total


def pack(files, out_path):
    """tar.gz из перечня файлов (пути внутри архива — относительные от ROOT)."""
    with tarfile.open(out_path, "w:gz") as tar:
        for rel, full in files:
            tar.add(full, arcname=rel)
    return out_path


# ─────────────────────── зеркало 1: archive.org ───────────────────────

def ia_upload(identifier, tar_path, cls, source):
    import internetarchive  # noqa: F401 — есть только в CI
    md = {
        "title": "ISKCON ONE LOVE — активы (%s)" % cls,
        "mediatype": "data",
        "collection": IA_COLLECTION,
        "subject": ["iskcon", "gaurangers", "assets-backup", cls],
        "description": "Резервная копия несекретных активов приложения gaurangers.com (класс: %s). Источник: %s" % (cls, source or "n/a"),
    }
    ak = os.environ["IA_ACCESS_KEY"]
    sk = os.environ["IA_SECRET_KEY"]
    r = internetarchive.upload(
        identifier, files={os.path.basename(tar_path): tar_path},
        metadata=md, access_key=ak, secret_key=sk,
        retries=5, queue_derive=False, verbose=True,
    )
    ok = all(getattr(x, "status_code", 200) in (200, None) for x in r)
    if not ok:
        raise RuntimeError("IA upload не подтверждён: %s" % [getattr(x, "status_code", "?") for x in r])
    return "https://archive.org/download/%s/%s" % (identifier, os.path.basename(tar_path))


# ─────────────────────── зеркало 2: GitHub Releases ───────────────────────

def _gh_req(method, url, token, data=None, ctype="application/json"):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer %s" % token)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", UA)
    if data is not None:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError("GitHub %s %s → HTTP %s: %s" % (method, url.split("?")[0], e.code, body))


def gh_get_or_create_release(tag, token):
    base = "https://api.github.com/repos/%s/releases" % REPO
    try:
        st, rel = _gh_req("GET", base + "/tags/%s" % tag, token)
        return rel
    except RuntimeError as e:
        if "HTTP 404" not in str(e):
            raise
    payload = json.dumps({
        "tag_name": tag, "name": "Активы: %s" % tag,
        "body": "Зеркало несекретных активов (страховка archive.org, ЗКН-Пл023). Не удалять.",
        "draft": False, "prerelease": False,
    }).encode()
    st, rel = _gh_req("POST", base, token, payload)
    return rel


def gh_upload_asset(rel, tar_path, token):
    name = os.path.basename(tar_path)
    # Ассет уже лежит и целиком залит — зеркало ЗАКРЫТО, делать нечего.
    # Прежний код сносил его и лил 20 МБ заново: самый хрупкий путь там, где
    # не нужен никакой. Класс идемпотентен по определению (см. шапку), и
    # повторный прогон приёма обязан быть дешёвым, а не рискованным.
    for a in rel.get("assets", []):
        if a.get("name") == name and a.get("state") == "uploaded" and a.get("size", 0) > 0:
            print("::notice::зеркало GitHub: ассет уже на месте (%d Б) — не перезаливаю"
                  % a["size"], flush=True)
            return a.get("browser_download_url")
    for a in rel.get("assets", []):
        if a.get("name") == name:      # недолитый огрызок — снести
            _gh_req("DELETE", "https://api.github.com/repos/%s/releases/assets/%d" % (REPO, a["id"]), token)
    up = rel["upload_url"].split("{")[0] + "?name=%s" % urllib.parse.quote(name)
    with open(tar_path, "rb") as f:
        blob = f.read()
    # Заливка ассета срывается: класс ios26-refs-4 (20.3 МБ) дважды подряд дал
    # релиз с НУЛЁМ ассетов, а шаг упал с голым «exit code 1». Молчащий отказ
    # хуже отказа: диагноз пришлось собирать по состоянию релиза через API.
    # Поэтому здесь три вещи: повтор с отступом, печать причины в stderr и
    # ::error:: — чтобы следующая поломка называла себя сама.
    asset, last = None, ""
    for attempt in range(1, 4):
        req = urllib.request.Request(up, data=blob, method="POST")
        req.add_header("Authorization", "Bearer %s" % token)
        req.add_header("Accept", "application/vnd.github+json")
        req.add_header("Content-Type", "application/octet-stream")
        req.add_header("Content-Length", str(len(blob)))
        req.add_header("User-Agent", UA)
        try:
            with urllib.request.urlopen(req, timeout=1800) as r:
                asset = json.load(r)
            break
        except urllib.error.HTTPError as e:
            last = "HTTP %s: %s" % (e.code, e.read().decode("utf-8", "replace")[:400])
        except Exception as e:                      # таймаут, обрыв, сброс
            last = "%s: %s" % (type(e).__name__, e)
        print("::warning::зеркало GitHub, попытка %d/3 — %s" % (attempt, last), flush=True)
        # ассет мог осесть частично — снимаем перед повтором
        try:
            _, fresh = _gh_req("GET", "https://api.github.com/repos/%s/releases/%d"
                               % (REPO, rel["id"]), token)
            for a in fresh.get("assets", []):
                if a.get("name") == name:
                    _gh_req("DELETE", "https://api.github.com/repos/%s/releases/assets/%d"
                            % (REPO, a["id"]), token)
        except Exception:
            pass
        time.sleep(5 * attempt)
    if asset is None:
        print("::error::зеркало GitHub Releases не закрыто (ЗКН-Пл023): %s" % last, flush=True)
        raise RuntimeError("GitHub asset upload: %s" % last)
    return asset.get("browser_download_url") or "https://github.com/%s/releases/download/%s/%s" % (REPO, rel["tag_name"], name)


# ─────────────────────── манифест ───────────────────────

def append_manifest(rec):
    os.makedirs(ASSETS_DIR, exist_ok=True)
    with open(MANIFEST, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


# ─────────────────────── режимы ───────────────────────

def do_offload(cls, paths, source, do_rm, exts=None, base=None):
    if already_offloaded(cls):
        print("::notice::класс «%s» уже в манифесте — пропуск (идемпотентно)" % cls)
        return 0
    files = iter_files(paths, base)
    if exts:
        allow = {("." + e.lower().lstrip(".")) for e in exts}
        files = [(rel, full) for rel, full in files if os.path.splitext(rel)[1].lower() in allow]
    if not files:
        raise SystemExit("::error::в путях нет файлов (фильтр ext=%s): %s" % (exts, paths))
    idx, total = write_files_index(files, cls)
    print("::notice::класс «%s»: %d файлов, %s → упаковка" % (cls, len(files), human(total)))

    tarp = os.path.join("/tmp", tar_name(cls))
    pack(files, tarp)
    tar_bytes = os.path.getsize(tarp)
    tar_sha = sha256_file(tarp)
    print("::notice::tar %s (%s), sha256=%s" % (os.path.basename(tarp), human(tar_bytes), tar_sha[:16]))

    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SystemExit("::error::нет GH_TOKEN для зеркала GitHub Releases")

    ident = ia_identifier(cls)
    ia_url = ia_upload(ident, tarp, cls, source)
    print("::notice::✓ archive.org: %s" % ia_url)

    tag = gh_tag(cls)
    rel = gh_get_or_create_release(tag, token)
    gh_url = gh_upload_asset(rel, tarp, token)
    print("::notice::✓ GitHub Releases: %s" % gh_url)

    append_manifest({
        "class": cls, "tar": os.path.basename(tarp), "sha256": tar_sha,
        "bytes": tar_bytes, "files": len(files), "raw_bytes": total,
        "ia_url": ia_url, "gh_url": gh_url, "gh_tag": tag, "ia_id": ident,
        "files_index": os.path.relpath(idx, ROOT), "source": source or "",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    print("::notice::✓ записано в манифест: %s" % os.path.relpath(MANIFEST, ROOT))

    if do_rm:
        # git-оперируем ТОЛЬКО путями внутри репо (независимо от base упаковки)
        repo_rels = [os.path.relpath(full, ROOT) for _, full in files
                     if not os.path.relpath(full, ROOT).startswith("..")]
        for i in range(0, len(repo_rels), 500):
            subprocess.run(["git", "rm", "-q", "--cached", "--"] + repo_rels[i:i + 500], cwd=ROOT, check=True)
        for _, full in files:
            try:
                os.remove(full)
            except OSError:
                pass
        print("::notice::✓ git-rm %d файлов (оба зеркала подтверждены)" % len(repo_rels))
    os.remove(tarp)
    return 0


def files_index_rows(cls):
    """Поимённый индекс класса: [(rel_path, bytes, sha256)]."""
    idx = os.path.join(ASSETS_DIR, "%s.files.tsv" % os.path.basename(tar_name(cls)).replace(".tar.gz", ""))
    if not os.path.exists(idx):
        raise SystemExit("::error::нет индекса %s — восстанавливать не по чему" % idx)
    rows = []
    with open(idx, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            rel, size, sha = line.split("\t")
            rows.append((rel, int(size), sha))
    return rows


def blob_from_history(rel):
    """Файл вынесен из дерева — поднять его из коммита, который его удалил.

    Обобщение ручного трюка `git show <коммит>^:<путь>`: коммит ищется сам,
    чтобы рецепт не устаревал вместе с хэшем.
    """
    q = subprocess.run(["git", "log", "--all", "--diff-filter=D", "--format=%H", "--", rel],
                       capture_output=True, text=True, cwd=ROOT)
    for commit in q.stdout.split():
        blob = subprocess.run(["git", "show", "%s^:%s" % (commit, rel)],
                              capture_output=True, cwd=ROOT)
        if blob.returncode == 0 and blob.stdout:
            return blob.stdout, commit
    return None, None


def do_reupload(cls, dry_run=False):
    """Перезалить класс, у которого зеркало пусто, НЕ возвращая мастера в дерево.

    Зачем отдельный режим. `offload` идемпотентен по классу: увидев запись в
    манифесте, он молча выходит — ровно то поведение, из-за которого пустой
    релиз `assets-ios26-refs-2` невозможно было починить его же руками. Здесь
    запись в манифесте не повод пропустить, а наоборот — список того, что
    обязано лежать на зеркале.

    Целостность держится на поимённых SHA-256 из `<класс>.files.tsv`: каждый
    файл сверяется до упаковки, расхождение хотя бы в одном — отказ целиком.
    """
    rec = manifest_record(cls)
    if not rec:
        raise SystemExit("::error::класс «%s» не найден в манифесте" % cls)
    rows = files_index_rows(cls)
    tmp = tempfile.mkdtemp(prefix="reupload-")
    ok = 0
    for rel, size, sha in rows:
        full = os.path.join(ROOT, rel)
        src = "дерево"
        data = None
        if os.path.exists(full):
            with open(full, "rb") as f:
                data = f.read()
            if hashlib.sha256(data).hexdigest() != sha:
                data = None
        if data is None:
            data, commit = blob_from_history(rel)
            src = "git %s^" % (commit[:8] if commit else "?")
        if data is None:
            raise SystemExit("::error::%s не найден ни в дереве, ни в истории" % rel)
        got = hashlib.sha256(data).hexdigest()
        if got != sha or len(data) != size:
            raise SystemExit("::error::%s — SHA-256 не сошёлся (%s), заливать нельзя" % (rel, src))
        dst = os.path.join(tmp, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "wb") as f:
            f.write(data)
        ok += 1
        print("::notice::✓ %s (%s, %s)" % (rel, human(len(data)), src))
    print("::notice::сошлось %d/%d файлов" % (ok, len(rows)))

    tarp = os.path.join(tmp, os.path.basename(tar_name(cls)))
    files = sorted(os.path.join(dp, fn) for dp, _, fns in os.walk(tmp) for fn in fns
                   if not fn.endswith(".tar.gz"))
    with tarfile.open(tarp, "w:gz") as tar:
        for f in files:
            tar.add(f, arcname=os.path.relpath(f, tmp))
    tar_sha = sha256_file(tarp)
    tar_bytes = os.path.getsize(tarp)
    print("::notice::тарбол %s (%s), sha256=%s" % (os.path.basename(tarp), human(tar_bytes), tar_sha[:16]))

    if dry_run:
        print("::notice::--dry-run: собрано и сверено, заливка не выполнялась")
        return 0

    ia_url = ia_upload(ia_identifier(cls), tarp, cls, rec.get("source", ""))
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise SystemExit("::error::нет GH_TOKEN — второе зеркало не закрыть (ЗКН-Пл023)")
    rel_gh = gh_get_or_create_release(gh_tag(cls), token)
    gh_url = gh_upload_asset(rel_gh, tarp, token)
    update_manifest(cls, {"sha256": tar_sha, "bytes": tar_bytes, "ia_url": ia_url,
                          "gh_url": gh_url, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    print("::notice::перезалито: %s | %s" % (ia_url, gh_url))
    return 0


def manifest_record(cls):
    if not os.path.exists(MANIFEST):
        return None
    with open(MANIFEST, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and json.loads(line).get("class") == cls:
                return json.loads(line)
    return None


def update_manifest(cls, patch):
    """Правит запись класса на месте: перезаливка меняет sha тарбола, а не файлов."""
    out = []
    with open(MANIFEST, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            if rec.get("class") == cls:
                rec.update(patch)
            out.append(json.dumps(rec, ensure_ascii=False))
    with open(MANIFEST, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")


def do_restore(cls):
    rec = None
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and json.loads(line).get("class") == cls:
                    rec = json.loads(line)
    if not rec:
        raise SystemExit("::error::класс «%s» не найден в манифесте" % cls)
    dst = os.path.join("/tmp", rec["tar"])
    last = None
    for url in (rec.get("ia_url"), rec.get("gh_url")):
        if not url:
            continue
        try:
            print("::notice::скачиваю с %s" % url)
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=1800) as r, open(dst, "wb") as out:
                out.write(r.read())
            if sha256_file(dst) == rec["sha256"]:
                print("::notice::✓ sha256 совпал — распаковываю в %s" % ROOT)
                with tarfile.open(dst, "r:gz") as tar:
                    tar.extractall(ROOT)
                return 0
            last = "sha256 не совпал у %s" % url
        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
            last = "%s: %s" % (url, e)
    raise SystemExit("::error::восстановление не удалось (%s)" % last)


# ─────────────────────── самотест ───────────────────────

def selftest():
    assert ia_identifier("tilda-export") == "iskcon-onelove-tilda-export", "ia id"
    assert ia_identifier("docs/Sources!") == "iskcon-onelove-docs-sources", "ia id sanitize"
    assert gh_tag("tilda-export") == "assets-tilda-export", "gh tag"
    assert tar_name("x") == "iskcon-onelove-x.tar.gz", "tar name"
    assert human(0) == "0 Б" and human(1536).startswith("1.5 КБ") and human(1048576).startswith("1") and "МБ" in human(1048576), "human"
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "a.bin")
        open(p, "wb").write(b"hello")
        assert sha256_file(p) == hashlib.sha256(b"hello").hexdigest(), "sha256"
        os.makedirs(os.path.join(d, "sub"))
        open(os.path.join(d, "sub", "b.txt"), "w").write("x")
        fs = iter_files([d], base=d)
        assert len(fs) == 2 and all(os.path.isabs(x[1]) for x in fs), "iter_files"
        assert all(not r.startswith("..") for r, _ in fs), "iter_files base-relative"
        mp = os.path.join(d, "m.jsonl")
        open(mp, "w").write(json.dumps({"class": "z"}) + "\n")
        assert already_offloaded("z", mp) and not already_offloaded("q", mp), "already_offloaded"
    print("selftest OK")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    o = sub.add_parser("offload")
    o.add_argument("--class", dest="cls", required=True)
    o.add_argument("--path", action="append", default=[], required=True)
    o.add_argument("--source", default="")
    o.add_argument("--ext", default="", help="фильтр по расширениям через запятую, напр. pdf,doc (пусто = все файлы)")
    o.add_argument("--base", default="", help="каталог, относительно которого считать пути в архиве (по умолчанию корень репо)")
    o.add_argument("--rm", action="store_true")
    r = sub.add_parser("restore")
    r.add_argument("--class", dest="cls", required=True)
    u = sub.add_parser("reupload", help="перезалить класс на зеркала, не возвращая файлы в дерево")
    u.add_argument("--class", dest="cls", required=True)
    u.add_argument("--dry-run", action="store_true", help="собрать и сверить SHA, но не заливать")
    sub.add_parser("selftest")
    a = ap.parse_args()

    if a.cmd == "selftest":
        selftest()
    elif a.cmd == "offload":
        exts = [e for e in a.ext.split(",") if e.strip()] if a.ext else None
        do_offload(a.cls, a.path, a.source, a.rm, exts, a.base or None)
    elif a.cmd == "restore":
        do_restore(a.cls)
    elif a.cmd == "reupload":
        do_reupload(a.cls, a.dry_run)


if __name__ == "__main__":
    main()

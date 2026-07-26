#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BXAD · ЭФИР-ДАШБОРД (ст. 54). Отчётность в прямом эфире: каждый прогон
пересобирает dashboard/DASHBOARD.md (рендерится GitHub'ом по постоянной
ссылке) и dashboard/index.html + data.json (для домена после переноса).
Только живые числа из реестров — ни одного слова из головы.
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
R = ROOT / "registry"


def _j(p, default=None):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return default if default is not None else {}


def collect() -> dict:
    d = {"ts": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}
    st = _j(R / "atlas" / "state.json", {})
    d["atlas"] = {"visited": st.get("visited", 0), "frontier": len(st.get("frontier", [])),
                  "cycles": st.get("cycles", 0), "last": st.get("last_step", "—")}
    m = re.search(r"Итого законов: (\d+) · фреймворков: (\d+)",
                  (R / "library" / "INDEX.md").read_text(encoding="utf-8") if (R / "library" / "INDEX.md").exists() else "")
    d["library"] = {"laws": int(m.group(1)) if m else 0, "frameworks": int(m.group(2)) if m else 0}
    wl = R / "library" / "web-landings.jsonl"
    d["web_laws"] = sum(1 for _ in wl.open(encoding="utf-8")) if wl.exists() else 0
    kn = 0
    for f in (R / "knowledge").glob("*.md"):
        mm = re.search(r"Нормативных положений: (\d+)", f.read_text(encoding="utf-8"))
        kn += int(mm.group(1)) if mm else 0
    d["knowledge"] = kn
    d["sources"] = len(_j(R / "sources.json", {}).get("sources", []))
    d["web_pages"] = len(_j(R / "web-sources.json", {}).get("pages", []))
    ks = _j(R / "standards" / "kit" / "state.json", {})
    d["kit"] = {"kits": len(ks.get("kits", [])), "fonts": len(ks.get("fonts", []) or []),
                "links_seen": len(ks.get("links_seen", []) or []), "errors": len(ks.get("errors", []) or [])}
    sy = _j(R / "standards" / "symbols" / "sf-symbols-names.json", {})
    d["symbols"] = sy.get("count", 0)
    sc = R / "state" / "SCREENS.md"
    ms = re.search(r"Итого кадров: (\d+) · приложений: (\d+)", sc.read_text(encoding="utf-8")) if sc.exists() else None
    d["screens"] = {"frames": int(ms.group(1)) if ms else 0, "apps": int(ms.group(2)) if ms else 0}
    lv = R / "live" / "REPORT.md"
    d["live"] = {"pages": lv.read_text(encoding="utf-8").count("## ") if lv.exists() else 0}
    base = _j(R / "state" / "ae-baseline.json", {})
    d["ratchet"] = {k: sum(v.values()) for k, v in base.items()} if base else {}
    b7 = _j(R / "bizlab" / "state.json", {})
    d["big7"] = {"pages": sum(len(f.get("visited", [])) for f in b7.get("firms", {}).values()),
                 "laws": sum(f.get("laws", 0) for f in b7.get("firms", {}).values()),
                 "frames": len(b7.get("frames", {}))}
    tk = _j(R / "standards" / "tokens.json", {})
    d["base"] = tk.get("base", "?")
    tasks = _j(R / "tasks.json", {})
    d["tasks"] = {grp: {s: sum(1 for t in items if t["status"] == s)
                        for s in ("done", "active", "queued", "blocked", "partial")}
                  for grp, items in tasks.items() if not grp.startswith("_")}
    d["tasks_list"] = tasks
    c = (ROOT / "CONSTITUTION.md").read_text(encoding="utf-8")
    d["articles"] = len(re.findall(r"\*\*Статья \d+(?:\.\d+)?", c))
    return d


def render(d: dict):
    out = ROOT / "dashboard"
    out.mkdir(exist_ok=True)
    (out / "data.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    t = d["tasks"]

    def trow(grp):
        s = t.get(grp, {})
        return f"done {s.get('done',0)} · active {s.get('active',0)} · queued {s.get('queued',0)} · partial {s.get('partial',0)} · blocked {s.get('blocked',0)}"

    md = [f"# BXAD · ЭФИР — {d['ts']}",
          "Живые числа реестров департамента Billions X Apple Developer; лист пересобирается каждым прогоном.", "",
          "| Орган | Состояние |", "|---|---|",
          f"| Конституция | статей **{d['articles']}** · база `{d['base']}` |",
          f"| Атлас документации | пройдено **{d['atlas']['visited']}** · фронтир {d['atlas']['frontier']} · кругов {d['atlas']['cycles']} · шаг {d['atlas']['last']} |",
          f"| Библиотека законов | **{d['library']['laws']}** законов · {d['library']['frameworks']} фреймворков · +{d['web_laws']} веб-лендинги |",
          f"| Знание (курируемое) | **{d['knowledge']}** положений · {d['sources']} источников |",
          f"| Веб-атлас | {d['web_pages']} страниц поручения |",
          f"| Кит | извлечено {d['kit']['kits']} · шрифтовых dmg {d['kit']['fonts']} · ссылок в поле зрения {d['kit']['links_seen']} · ошибок {d['kit']['errors']} |",
          f"| SF Symbols | **{d['symbols']}** символов (macOS-плечо) |",
          f"| Кадротека | {d['screens']['frames']} кадров · {d['screens']['apps']} приложений |",
          f"| Живой взгляд | страниц в эфире: {d['live']['pages']} |",
          f"| Большая семёрка | страниц {d['big7']['pages']} · положений {d['big7']['laws']} · рамок в карте {d['big7']['frames']} |",
          f"| Храповик | долг по проектам: " + (" · ".join(f"{k}:{v}" for k, v in d['ratchet'].items()) or "—") + " |",
          "", "## Поручения основателя",
          f"- BXAD: {trow('bxad')}",
          f"- Продукт ISKCON: {trow('iskcon_product')}", "",
          "| ID | Поручение | Статус | Орган |", "|---|---|---|---|"]
    for grp in ("bxad", "iskcon_product"):
        for x in d["tasks_list"].get(grp, []):
            md.append(f"| {x['id']} | {x['task']} | **{x['status']}** | {x['organ']} |")
    (out / "DASHBOARD.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    rows = "".join(f"<tr><td>{x['id']}</td><td>{x['task']}</td><td class='s-{x['status']}'>{x['status']}</td></tr>"
                   for grp in ("bxad", "iskcon_product") for x in d["tasks_list"].get(grp, []))
    html = f"""<!doctype html><html lang="ru"><meta charset="utf-8">
<meta http-equiv="refresh" content="600"><title>BXAD · эфир</title>
<style>body{{background:#000;color:#fff;font:15px/1.5 -apple-system,system-ui;margin:0;padding:24px}}
h1{{font-size:22px;font-weight:600}} .g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}}
.c{{background:#1C1C1E;border-radius:14px;padding:14px}} .n{{font-size:26px;font-weight:700}}
.l{{color:rgba(255,255,255,.6);font-size:13px}} table{{width:100%;border-collapse:collapse;margin-top:20px}}
td{{padding:6px 8px;border-top:1px solid #2C2C2E;font-size:13px}} .s-done{{color:#30D158}}
.s-active{{color:#0A84FF}} .s-queued{{color:rgba(255,255,255,.6)}} .s-partial{{color:#FFD60A}} .s-blocked{{color:#FF453A}}</style>
<h1>BXAD · эфир — {d['ts']}</h1>
<div class="g">
<div class="c"><div class="n">{d['atlas']['visited']}</div><div class="l">страниц документации пройдено · фронтир {d['atlas']['frontier']}</div></div>
<div class="c"><div class="n">{d['library']['laws']}</div><div class="l">законов · {d['library']['frameworks']} фреймворков · +{d['web_laws']} веб</div></div>
<div class="c"><div class="n">{d['knowledge']}</div><div class="l">положений знания · {d['sources']} источников</div></div>
<div class="c"><div class="n">{d['symbols']}</div><div class="l">SF Symbols (установлено macOS-плечом)</div></div>
<div class="c"><div class="n">{d['screens']['frames']}</div><div class="l">кадров кадротеки · {d['screens']['apps']} приложений</div></div>
<div class="c"><div class="n">{d['articles']}</div><div class="l">статей конституции · база {d['base']}</div></div>
</div><table>{rows}</table></html>"""
    (out / "index.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    d = collect()
    render(d)
    print(f"эфир: атлас {d['atlas']['visited']} · законов {d['library']['laws']} · задач BXAD done {d['tasks']['bxad']['done']}")

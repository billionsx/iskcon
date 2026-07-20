from pathlib import Path

g = Path("tools/ios26-tokens.py")
s = g.read_text(encoding="utf-8")

DOC = (
    "\u041f\u0420\u0410\u0412\u0418\u041b\u041e 8 \u2014 \u0434\u0432\u0435 \u043e\u0431\u043e\u043b\u043e\u0447\u043a\u0438 \u043d\u0435 \u0441\u0440\u0430\u0441\u0442\u0430\u044e\u0442\u0441\u044f. \u041f\u0440\u043e\u0431\u043d\u0430\u044f \u043e\u0431\u043e\u043b\u043e\u0447\u043a\u0430 `x/` \u043d\u0435 \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u0443\u0435\u0442\n"
    "            \u0438\u0437 \u0442\u0435\u043a\u0443\u0449\u0435\u0439, \u0442\u0435\u043a\u0443\u0449\u0430\u044f \u2014 \u0438\u0437 `x/`. \u041e\u0431\u0449\u0435\u0435 \u0442\u043e\u043b\u044c\u043a\u043e `ui/`, \u0433\u0434\u0435 \u043b\u0435\u0436\u0430\u0442\n"
    "            \u043a\u0438\u0440\u043f\u0438\u0447\u0438, \u043f\u0440\u0438\u0432\u0435\u0434\u0451\u043d\u043d\u044b\u0435 \u043a \u0437\u0430\u043c\u0435\u0440\u0430\u043c. \u0420\u0430\u0437\u0432\u0438\u043b\u043a\u0430 \u0441\u0442\u043e\u0438\u0442 \u0432 \u043e\u0434\u043d\u043e\u043c\n"
    "            \u043c\u0435\u0441\u0442\u0435 \u2014 `main.tsx`. \u0411\u0435\u0437 \u044d\u0442\u043e\u0433\u043e \u043f\u0440\u0430\u0432\u0438\u043b\u0430 \u043e\u0431\u043e\u043b\u043e\u0447\u043a\u0438 \u0441\u0440\u0430\u0441\u0442\u0443\u0442\u0441\u044f \u0431\u0435\u0437\n"
    "            \u0437\u043b\u043e\u0433\u043e \u0443\u043c\u044b\u0441\u043b\u0430, \u0438 \u043f\u043e\u0434\u043c\u0435\u043d\u0430 \u043e\u0434\u043d\u043e\u0439 \u043d\u0430 \u0434\u0440\u0443\u0433\u0443\u044e \u0441\u0442\u0430\u043d\u0435\u0442 \u043d\u0435\u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e\u0439 \u2014\n"
    "            \u0430 \u0432\u0435\u0441\u044c \u0441\u043c\u044b\u0441\u043b \u043f\u0440\u043e\u0431\u043d\u043e\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u0432 \u0442\u043e\u043c, \u0447\u0442\u043e\u0431\u044b \u0435\u0451 \u043c\u043e\u0436\u043d\u043e \u0431\u044b\u043b\u043e \u043f\u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c\n"
    "            \u043d\u0430 \u043c\u0435\u0441\u0442\u043e \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0439 \u043f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435\u043c \u0444\u043b\u0430\u0433\u0430, \u0430 \u043d\u0435 \u043c\u0438\u0433\u0440\u0430\u0446\u0438\u0435\u0439.\n\n"
)
anchor_doc = "\u041f\u0420\u0410\u0412\u0418\u041b\u041e 7 \u2014 \u0432 \u0441\u043b\u043e\u0435 `ui/` \u043d\u0435\u0442 \u043c\u0451\u0440\u0442\u0432\u044b\u0445 \u043a\u0438\u0440\u043f\u0438\u0447\u0435\u0439."
assert anchor_doc in s
s = s.replace(anchor_doc, DOC + anchor_doc, 1)

CODE = '''    # правило 8 — две оболочки не срастаются
    leaks = []
    IMP = re.compile(r'from\\s+[\\'"]([^\\'"]+)[\\'"]')
    xdir = web / "x"
    if xdir.exists():
        for f in xdir.rglob("*.tsx"):
            for m in IMP.finditer(f.read_text(encoding="utf-8")):
                tgt = m.group(1)
                if tgt.startswith("..") and "ui/" not in tgt:
                    leaks.append(f"x/{f.name} -> {tgt}")
        for f in web.rglob("*.tsx"):
            if f.parent.name == "x" or f.name == "main.tsx":
                continue
            for m in IMP.finditer(f.read_text(encoding="utf-8")):
                if "/x/" in m.group(1) or m.group(1).startswith("./x/"):
                    leaks.append(f"{f.name} -> {m.group(1)}")

'''
anchor_code = "    # правило 3 — храповик"
assert anchor_code in s
s = s.replace(anchor_code, CODE + anchor_code, 1)

CHK = '''    if leaks:
        fail.append("оболочки срастаются: " + ", ".join(leaks[:4]) +
                    ". Пробная `x/` и текущая делят только `ui/` (правило 8)")
'''
anchor_chk = '    cap_db = base.get("dead_bricks", len(dead_bricks))'
assert anchor_chk in s
s = s.replace(anchor_chk, CHK + anchor_chk, 1)

old_print = '          f"мёртвых кирпичей — {len(dead_bricks)}/{cap_db}")'
assert old_print in s
s = s.replace(old_print,
              '          f"мёртвых кирпичей — {len(dead_bricks)}/{cap_db}   "\n'
              '          f"сращений — {len(leaks)}")', 1)

g.write_text(s, encoding="utf-8")
print("правило 8 вписано")

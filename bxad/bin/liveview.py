#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BXAD · ЖИВОЙ ВЗГЛЯД (ст. 37.3) — СТРОИТСЯ.
Назначение: headless-Chromium (Playwright/CDP) в CI открывает страницу
приложения, снимает настоящий DOM и getComputedStyle и сверяет живые
свойства с правилами AE и токенами. Кадр — приложение к фактам DOM.
Носитель — CI (в песочнице браузер недоступен по сети).
Мок-режим (--mock <dump.json>) уже судится: разбор снятого дампа
computed-styles → находки AE — механизм доказан до подъёма браузера."""
import json, sys
from pathlib import Path

def check_dump(dump: dict, tokens: dict) -> list:
    finds = []
    ladder = {c.upper() for c in tokens["surfaces"]["allow"]}
    for el in dump.get("elements", []):
        bg = (el.get("backgroundColor") or "").upper()
        if bg.startswith("#") and bg not in ladder:
            finds.append(("AE1", el.get("selector","?"), f"живой фон {bg} вне лестницы"))
    return finds

if __name__ == "__main__":
    if "--mock" in sys.argv:
        dump = json.loads(Path(sys.argv[sys.argv.index("--mock")+1]).read_text(encoding="utf-8"))
        tokens = json.loads((Path(__file__).resolve().parents[1]/"registry/standards/tokens.json").read_text(encoding="utf-8"))
        for f in check_dump(dump, tokens): print(*f)
    else:
        print("живой взгляд: СТРОИТСЯ — носитель CI (устав ст. 37.3)")

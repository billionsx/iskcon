#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ЕДИНЫЙ КАНОН СТРАН · ЗКН-Р010b (ЗКН-Э005: одно понятие — один источник).

Зачем: география приложения приходит из ТРЁХ конвейеров, и каждый писал имя
страны по-своему. В одном поле оказались вперемешку коды ISO и имена — «RU»
(2094 файла) и «Russia» (126) жили как ДВЕ страны, и фильтр двоился по
пятнадцати странам. Плюс города и острова в поле страны: «Tunis», «Nairobi»,
«Mahe», «Ponape», «Tahiti».

Канон — общеупотребительное английское имя страны (ISO 3166 short name), то же,
что в локаторе D1. Здесь ОДНА таблица, из неё же строится SQL-гейт по D1 и
файловый гейт по статике: два определения канона были бы расхождением по
построению.

Правило дома: сюда вносится только то, что ВСТРЕЧЕНО в данных. Ничего не
угадывается; неизвестное имя канон оставляет как есть, и гейт о нём молчит —
выдумка хуже отсутствия (ЗКН-Э001 департамента, ЗКН-БТ001 этого свода).

Запуск: python3 tools/countries.py            — сводка канона
        python3 tools/countries.py --selftest — суд в обе стороны
"""
import sys

# ── коды alpha-2, найденные в данных календаря (у каждого есть имя-двойник) ──
CODES = {
    "AM": "Armenia", "AZ": "Azerbaijan", "BY": "Belarus", "EE": "Estonia",
    "GE": "Georgia", "KG": "Kyrgyzstan", "KZ": "Kazakhstan", "LT": "Lithuania",
    "LV": "Latvia", "MD": "Moldova", "RU": "Russia", "TJ": "Tajikistan",
    "TM": "Turkmenistan", "UA": "Ukraine", "UZ": "Uzbekistan",
}

# ── переименования государств и опечатки импорта ──
RENAMED = {
    "Burma": "Myanmar",                       # имя ISO
    "Burma(Myanmar)": "Myanmar",
    "Swaziland": "Eswatini",                  # переименована в 2018
    "Macedonia": "North Macedonia",           # переименована в 2019
    "Czech": "Czech Republic",
    "Czechia": "Czech Republic",
    "Djibouty": "Djibouti",                   # опечатка
    "Cauman": "Cayman Islands",               # опечатка
    "Comoro": "Comoros",
    "Faroe": "Faroe Islands",
    "Antigua": "Antigua and Barbuda",
    "Saint Vincent": "Saint Vincent and the Grenadines",
    "Sao Tome": "Sao Tome and Principe",
    "Bosina & Herzegovina": "Bosnia and Herzegovina",
    "Bosnia": "Bosnia and Herzegovina",
    "Netherland": "Netherlands",
    "Holland": "Netherlands",
}

# ── короткие формы одной страны ──
SHORT = {
    "United States": "United States of America",
    "USA": "United States of America",
    "US": "United States of America",
    "U.S.A.": "United States of America",
    "UK": "United Kingdom",
    "Great Britain": "United Kingdom",
    "England": "United Kingdom",
    "Scotland": "United Kingdom",             # ISO: часть Великобритании
    "Wales": "United Kingdom",
    "Northern Ireland": "United Kingdom",
}

# ── город, остров или регион, попавший в поле СТРАНЫ ──
NOT_A_COUNTRY = {
    "Tunis": "Tunisia",                       # столица вместо страны
    "Nairobi": "Kenya",                       # город вместо страны
    "Mahe": "Seychelles",                     # остров вместо страны
    "Ponape": "Micronesia",                   # остров вместо страны
    "Tahiti": "French Polynesia",             # остров вместо страны
    "Lesser Sunda Islands": "Indonesia",      # архипелаг вместо страны
    "Miquelon": "Saint Pierre and Miquelon",
    "Balkans": "Slovenia",                    # регион; в данных — Любляна
}

ALIASES = {**CODES, **RENAMED, **SHORT, **NOT_A_COUNTRY}


def canon(value):
    """Каноническое имя страны. Неизвестное — возвращается как есть."""
    if not value:
        return value
    v = " ".join(str(value).split())
    return ALIASES.get(v, v)


def aliases():
    """Пары (как встречается → канон) для построения гейтов."""
    return sorted(ALIASES.items())


def selftest():
    ok = True

    def check(name, cond):
        nonlocal ok
        print(("  ✓ " if cond else "  ✗ ") + name)
        ok = ok and cond

    print("СУД · канон стран")
    check("код ISO сводится к имени: RU → Russia", canon("RU") == "Russia")
    check("удвоение снято: код и имя дают ОДНО", canon("RU") == canon("Russia"))
    check("переименование государства: Swaziland → Eswatini",
          canon("Swaziland") == "Eswatini")
    check("опечатка импорта: Djibouty → Djibouti", canon("Djibouty") == "Djibouti")
    check("часть государства: Scotland → United Kingdom",
          canon("Scotland") == "United Kingdom")
    check("город в поле страны: Nairobi → Kenya", canon("Nairobi") == "Kenya")
    check("канон устойчив: канон(канон(x)) == канон(x)",
          all(canon(canon(v)) == canon(v) for v in ALIASES))
    check("канон не изобретает: незнакомое имя не меняется",
          canon("Narnia") == "Narnia")
    check("пробелы схлопываются", canon("  United   Kingdom ") == "United Kingdom")
    check("пустое остаётся пустым", canon("") == "" and canon(None) is None)
    check("Congo и DR Congo НЕ склеены (разные государства)",
          canon("Congo") == "Congo"
          and canon("Democratic Republic of the Congo") == "Democratic Republic of the Congo")
    check("Niger и Nigeria не склеены",
          canon("Niger") == "Niger" and canon("Nigeria") == "Nigeria")
    return 0 if ok else 1


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    print(f"канон стран: {len(ALIASES)} псевдонимов → "
          f"{len(set(ALIASES.values()))} канонических имён")
    for k, v in aliases():
        print(f"  {k:32} → {v}")

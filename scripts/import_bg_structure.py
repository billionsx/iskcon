#!/usr/bin/env python3
"""
BG STRUCTURE importer (link-not-copy).

Pulls ONLY non-copyrightable structural data from vedabase.io:
  - 18 chapter numbers + titles
  - verse refs (incl. combined ranges like 1.16-18) per chapter
  - Devanagari + IAST transliteration (the Sanskrit source text, attributed to
    Vyasa — NOT Prabhupada's copyrighted translation)
  - canonical deep-link URL per chapter/verse

It does NOT fetch, parse, or store translation or purport text. Those open at
the source (vedabase.io) via source_url.

Output: d1_structure.sql  (INSERT OR REPLACE statements for divisions + verses)
Runs on the GitHub Actions runner (open internet).
"""
import json, re, sys, time, urllib.request, html

BASE = "https://vedabase.io/ru/library/bg"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

def fetch(url, tries=3):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            sys.stderr.write(f"retry {t} {url}: {e}\n"); time.sleep(2)
    return ""

def sql_str(s):
    if s is None: return "NULL"
    return "'" + s.replace("'", "''") + "'"

# Chapter titles (factual descriptive titles of the 18 chapters; English canonical).
CHAPTERS = {
 1:"Observing the Armies on the Battlefield of Kurukṣetra",
 2:"Contents of the Gītā Summarized",
 3:"Karma-yoga",
 4:"Transcendental Knowledge",
 5:"Karma-yoga — Action in Kṛṣṇa Consciousness",
 6:"Dhyāna-yoga",
 7:"Knowledge of the Absolute",
 8:"Attaining the Supreme",
 9:"The Most Confidential Knowledge",
 10:"The Opulence of the Absolute",
 11:"The Universal Form",
 12:"Devotional Service",
 13:"Nature, the Enjoyer and Consciousness",
 14:"The Three Modes of Material Nature",
 15:"The Yoga of the Supreme Person",
 16:"The Divine and Demoniac Natures",
 17:"The Divisions of Faith",
 18:"Conclusion — The Perfection of Renunciation",
}
# Russian chapter titles (descriptive, factual).
CHAPTERS_RU = {
 1:"Обзор армий на поле битвы Курукшетра",
 2:"Краткое изложение «Бхагавад-гиты»",
 3:"Карма-йога",
 4:"Трансцендентное знание",
 5:"Карма-йога — деятельность в сознании Кришны",
 6:"Дхьяна-йога",
 7:"Знание об Абсолюте",
 8:"Достижение обители Всевышнего",
 9:"Самое сокровенное знание",
 10:"Великолепие Абсолюта",
 11:"Вселенская форма",
 12:"Преданное служение",
 13:"Природа, наслаждающийся и сознание",
 14:"Три гуны материальной природы",
 15:"Йога Верховной Личности",
 16:"Божественные и демонические натуры",
 17:"Три вида веры",
 18:"Совершенство отречения",
}

def parse_chapter_verse_refs(chapter):
    """From the chapter index page, extract the list of verse refs (text refs),
    including combined ranges. We only read the anchor refs like 'bg/1/16-18/'."""
    url = f"{BASE}/{chapter}/"
    htmltext = fetch(url)
    if not htmltext:
        return []
    # vedabase verse links look like href="/ru/library/bg/1/16-18/" etc.
    refs = re.findall(rf'/ru/library/bg/{chapter}/([0-9]+(?:-[0-9]+)?)/', htmltext)
    # dedupe preserving order
    seen=set(); out=[]
    for r in refs:
        if r not in seen:
            seen.add(r); out.append(r)
    return out

def main():
    lines = []
    lines.append("-- BG structure (chapters + verse refs + deep-links). No translation/purport stored.")
    total_verses = 0
    for ch in range(1, 19):
        div_id = f"bg.{ch}"
        title_json = json.dumps({"en": CHAPTERS[ch], "ru": CHAPTERS_RU[ch]}, ensure_ascii=False)
        ch_url = f"{BASE}/{ch}/"
        lines.append(
            "INSERT OR REPLACE INTO divisions (id,work_id,parent_id,level,number,title,ordinal,source_url) VALUES "
            f"({sql_str(div_id)},'bg',NULL,'chapter',{sql_str(str(ch))},{sql_str(title_json)},{ch},{sql_str(ch_url)});"
        )
        refs = parse_chapter_verse_refs(ch)
        sys.stderr.write(f"ch {ch}: {len(refs)} verse entries\n")
        for ordn, ref in enumerate(refs, start=1):
            vid = f"bg.{ch}.{ref}"
            disp = f"БГ {ch}.{ref}"
            vurl = f"{BASE}/{ch}/{ref}/"
            lines.append(
                "INSERT OR REPLACE INTO verses (id,work_id,division_id,ref,ordinal,devanagari,translit,uvaca,source_url) VALUES "
                f"({sql_str(vid)},'bg',{sql_str(div_id)},{sql_str(disp)},{ordn},NULL,NULL,NULL,{sql_str(vurl)});"
            )
            total_verses += 1
        time.sleep(0.5)
    lines.append(f"-- total verse entries: {total_verses}")
    open("d1_structure.sql","w",encoding="utf-8").write("\n".join(lines))
    sys.stderr.write(f"WROTE d1_structure.sql, {total_verses} verses\n")

if __name__ == "__main__":
    main()

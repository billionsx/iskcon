#!/usr/bin/env python3
"""
Emit D1 load SQL for the Vaisnava calendar (table gcal_days) from the
generated dataset JSON. Idempotent: clears existing vrindavan/gcal rows,
upserts provenance into gcal_meta, then inserts via batched multi-row INSERTs.

Run:  python to_sql.py --in ../../apps/api/data/vaisnava-calendar-vrindavan.json --out /tmp/load.sql
"""
import argparse
import json

COLS = [
    "date", "kind", "name_en", "name_i18n", "gaurabda_year", "fast_code",
    "mahadvadasi", "masa", "tithi", "naksatra", "sunrise", "sunset",
    "paran_start", "paran_end", "paran_start_reason", "paran_end_reason",
    "rasi", "raw_text", "source", "location_std",
]


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default="../../apps/api/data/vaisnava-calendar-vrindavan.json")
    ap.add_argument("--out", default="load.sql")
    ap.add_argument("--batch", type=int, default=80)
    a = ap.parse_args()

    with open(a.inp, encoding="utf-8") as f:
        data = json.load(f)
    events = data["events"]

    rows = []
    for e in events:
        name = e.get("name")
        i18n = json.dumps({"en": name}, ensure_ascii=False) if name else "{}"
        row = [
            e.get("date"), e.get("kind"), name, i18n, e.get("gaurabda_year"),
            e.get("fast_code"), e.get("mahadvadasi"), e.get("masa"), e.get("tithi"),
            e.get("naksatra"), e.get("sunrise"), e.get("sunset"), e.get("paran_start"),
            e.get("paran_end"), e.get("paran_start_reason"), e.get("paran_end_reason"),
            e.get("rasi"), e.get("text"), "gcal", "vrindavan",
        ]
        rows.append("(" + ",".join(q(x) for x in row) + ")")

    collist = "(" + ",".join(COLS) + ")"
    prov = json.dumps(data.get("provenance", {}), ensure_ascii=False).replace("'", "''")
    with open(a.out, "wt", encoding="utf-8") as f:
        f.write("DELETE FROM gcal_days WHERE source='gcal' AND location_std='vrindavan';\n")
        f.write(
            "INSERT INTO gcal_meta (key,value) VALUES ('vrindavan_provenance','%s') "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value;\n" % prov
        )
        for i in range(0, len(rows), a.batch):
            chunk = rows[i:i + a.batch]
            f.write("INSERT INTO gcal_days %s VALUES\n%s;\n" % (collist, ",\n".join(chunk)))

    print("wrote %d rows -> %s" % (len(rows), a.out))


if __name__ == "__main__":
    main()

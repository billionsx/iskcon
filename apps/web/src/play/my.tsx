/* /play · В6 «Моё» — избранное человека внутри оболочки.
 *
 * Источник — единый реестр cardActions (useFavorites): тот же список, что и в
 * основном приложении, второго хранилища нет. Фильтр категорий — липкая
 * стеклянная полоса чипов (паттерн FavoritesScreen). Медиа-категории /play —
 * книги · лекции · киртаны · бхаджаны; всё прочее собрано в «Другое» и уводит
 * по href в основное приложение (там свои экраны).
 */

import React, { useMemo, useState } from "react";
import { Ava, I, Scr } from "./core";
import type { UI } from "./MusicApp";
import { useFavorites, type FavItem } from "../cardActions";

type MyCat = "all" | "book" | "katha" | "kirtan" | "bhajan" | "other";
const CATS: { k: MyCat; label: string }[] = [
  { k: "all", label: "Всё" },
  { k: "book", label: "Книги" },
  { k: "katha", label: "Лекции" },
  { k: "kirtan", label: "Киртаны" },
  { k: "bhajan", label: "Бхаджаны" },
  { k: "other", label: "Другое" },
];
const catOf = (type: string): MyCat =>
  type.indexOf("katha") === 0 ? "katha"
  : type.indexOf("kirtan") === 0 ? "kirtan"
  : type.indexOf("bhajan") === 0 ? "bhajan"
  : type === "book" || type === "chapter" ? "book"
  : "other";

export function MyScreen({ ui: _ui }: { ui: UI }) {
  const favs = useFavorites();
  const [sel, setSel] = useState<MyCat>("all");
  const counts = useMemo(() => {
    const c: Record<MyCat, number> = { all: favs.length, book: 0, katha: 0, kirtan: 0, bhajan: 0, other: 0 };
    for (const f of favs) c[catOf(f.type)] += 1;
    return c;
  }, [favs]);
  const shown = useMemo(
    () => (sel === "all" ? favs : favs.filter((f) => catOf(f.type) === sel)),
    [favs, sel],
  );
  const open = (f: FavItem) => { if (f.href) window.location.assign(f.href); };
  return (
    <Scr>
      <div className="amx-top"><div className="amx-h1">Моё</div><Ava /></div>
      <div className="amx-myfilter">
        {CATS.filter((c) => c.k === "all" || counts[c.k] > 0).map((c) => (
          <button key={c.k} className={"amx-chip" + (sel === c.k ? " on" : "")} onClick={() => setSel(c.k)}>
            {c.label}{c.k !== "all" ? ` ${counts[c.k]}` : ""}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="amx-find-empty" style={{ position: "static", marginTop: "22vh" }}>
          <div className="et">Пока пусто</div>
          <div className="ed">Сердце на записи или книге кладёт её сюда.</div>
        </div>
      ) : shown.map((f) => (
        <div key={f.key} className="amx-row" onClick={() => open(f)}>
          <div className="r-c" style={{ paddingLeft: 20 }}>
            <div className="r-t">{f.title}</div>
            {f.subtitle ? <div className="r-s">{f.subtitle}</div> : null}
          </div>
          {f.href ? <span style={{ color: "var(--g2)", paddingRight: 16 }}>{I.chev({ s: 16 })}</span> : null}
        </div>
      ))}
    </Scr>
  );
}

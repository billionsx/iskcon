/**
 * ВСПЛЫВАЮЩЕЕ МЕНЮ — снято с восьми кадров Music.
 *
 * Один компонент, разное наполнение: сетка/список (f01, f21), фильтр (f02, f04,
 * f22, f28), сортировка (f20), действия над записью (f33). Apple не заводит под
 * каждую роль свой вид — и нам не нужно.
 *
 * ЗАМЕРЕНО на ЖИВОМ устройстве — четыре снимка 1179 × 2556 (= 393 × 852 @3x):
 *   коробка        ширина 248.0, высота 147.7, верх y 59.0
 *   правый край    12.3 … 15.0 от края экрана
 *   шаг строки     36.3 (фильтр) · 35.7 (сортировка)
 *   ГАЛОЧКА        x 19.3, ширина 8.0 — СЛЕВА
 *   знак           x ≈41, ширина 11.7 … 15.0
 *   подпись        x ≈70
 *
 * Прежняя версия ставила галочку СПРАВА — это была догадка, и она оказалась
 * неверной. Живой снимок показал левую колонку отметки: так глаз находит
 * выбранный пункт, не дочитывая строку до конца.
 *
 * Разделитель добавляет к шагу ~20: у меню фильтра шаги 55.7 · 36.3, у меню
 * сортировки — 35.7 · 35.7 ровно, и разделителя там нет. Неровный шаг был не
 * сбоем замера, а группировкой.
 *
 * ГРУППЫ — не украшение. Разделитель на +54.7 отделяет «показать всё» от
 * «показать отобранное»: это разные по смыслу действия, а не соседние пункты
 * одного списка.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export interface MenuItem {
  id: string;
  label: string;
  /** Отмечен галочкой — для выбора из набора (фильтр, сортировка, вид). */
  checked?: boolean;
  /** Знак слева. */
  icon?: ReactNode;
  /** Разрушительное действие пишется красным. */
  danger?: boolean;
  onSelect: () => void;
}

/** Группы разделяются хейрлайном. Одна группа — просто один массив. */
export type MenuGroups = MenuItem[][];

/* 📐 шаг 36. Колонки внутри строки: галочка 19.3 · знак 41 · подпись 70 —
   считая от левого края коробки. */
const rowStyle: CSSProperties = {
  display: "flex", alignItems: "center", width: "100%",
  height: 36, padding: 0, background: "none", border: "none",
  cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent",
  fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)",
  lineHeight: "var(--lh-subhead)", letterSpacing: "var(--ls-subhead)",
};
const checkCol: CSSProperties = {
  width: 41 - 19.3, paddingLeft: 19.3, flexShrink: 0, display: "grid",
  placeItems: "start center", color: "var(--color-label)",
};
const iconCol: CSSProperties = {
  width: 70 - 41, flexShrink: 0, display: "grid", placeItems: "center",
  color: "var(--color-label-2)",
};

export function Menu({ groups, onClose, anchor = "right" }: {
  groups: MenuGroups;
  onClose: () => void;
  /** С какой стороны прижато меню. У Apple на этих кадрах — справа. */
  anchor?: "left" | "right";
}) {
  const box = useRef<HTMLDivElement>(null);

  /* Меню закрывается по Esc и по нажатию мимо — иначе на клавиатуре из него
     не выйти, а это уже недоступность, а не мелочь. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 1700 }}>
      <div
        ref={box}
        role="menu"
        onClick={(e) => e.stopPropagation()}
        className="glass"
        style={{
          position: "absolute",
          /* 📐 верх меню совпадает с верхом навигационной капсулы */
          top: `${(59 / 852) * 100}%`,      /* 📐 верх меню */
          [anchor]: 14,                     /* 📐 12.3 … 15.0 от края экрана */
          width: 248,                       /* 📐 живой снимок */
          /* §4.2: меню · лист · алерт — радиус 20. Стояло 14 — взято ниоткуда.
             Материал — стекло: 📐 «#111111 стекло над чёрным», не заливка. */
          ["--glass-r" as string]: "20px",
          overflow: "hidden",
          padding: "6px 0",
        } as CSSProperties}>
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div aria-hidden style={{ height: 1, margin: "5px 0",
                background: "var(--color-separator)" }} />
            )}
            {group.map((it) => (
              <button key={it.id} type="button" role="menuitem"
                onClick={() => { it.onSelect(); onClose(); }}
                style={{ ...rowStyle,
                  color: it.danger ? "var(--color-danger)" : "var(--color-label)" }}>
                {/* Отметка СЛЕВА — 📐 x 19.3. Глаз находит выбранный пункт,
                    не дочитывая строку до конца. */}
                <span aria-hidden style={checkCol}>{it.checked ? "✓" : ""}</span>
                <span aria-hidden style={iconCol}>{it.icon}</span>
                <span style={{ flex: 1, minWidth: 0, paddingRight: 14,
                  whiteSpace: "nowrap", overflow: "hidden",
                  textOverflow: "ellipsis" }}>{it.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

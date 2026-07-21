/**
 * ВСПЛЫВАЮЩЕЕ МЕНЮ — снято с восьми кадров Music.
 *
 * Один компонент, разное наполнение: сетка/список (f01, f21), фильтр (f02, f04,
 * f22, f28), сортировка (f20), действия над записью (f33). Apple не заводит под
 * каждую роль свой вид — и нам не нужно.
 *
 * ЗАМЕРЕНО (📐 f02):
 *   коробка        230.7 × 146.0, заливка #111111 (тон слоя-плеера, 5.20)
 *   положение      правый край в 16.0 от края экрана
 *   верх           y 60.0 — совпадает с верхом навигационной капсулы
 *   строки         набор на +19.0, +76.3, +112.3 от верха меню
 *   шаг            36.0 между второй и третьей
 *   разделитель    +54.7 — первый пункт отделён от остальных
 *
 * 🕳 Врезка набора расходится: 3.3 у первой строки против 24.3 у прочих.
 * Скорее всего у первой знак слева, у остальных справа, но со статики это не
 * различимо, и я не выдумываю.
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

const rowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%",
  /* 📐 шаг 36.0 */
  height: 36, padding: "0 14px", background: "none", border: "none",
  cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent",
  fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)",
  lineHeight: "var(--lh-subhead)", letterSpacing: "var(--ls-subhead)",
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
          top: `${(60 / 852) * 100}%`,
          [anchor]: 16,                     /* 📐 16.0 от края экрана */
          width: 230.7,                     /* 📐 */
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
                {it.icon && <span style={{ display: "grid", flexShrink: 0,
                  color: "var(--color-label-2)" }}>{it.icon}</span>}
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                {it.checked && (
                  <span aria-hidden style={{ flexShrink: 0,
                    color: "var(--color-gold-deep)" }}>✓</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

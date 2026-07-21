/**
 * ДИНАМИЧНОЕ МЕНЮ — пиксель-в-пиксель с живыми снимками Apple Music.
 *
 * Первая версия была плоской коробкой с малым скруглением и без блюра, а листы
 * скорости и таймера вообще шли простынями на весь низ. Основатель назвал это
 * тем, чем оно было. Меню Apple — компактный ПАРЯЩИЙ слой У КНОПКИ, которая его
 * вызвала, и один и тот же слой обслуживает фильтр, сортировку, вид, действия
 * над записью и подменю.
 *
 * ЗАМЕРЕНО (четыре живых снимка, 393×852 @3x):
 *   коробка     ширина 248.0 · скругление ≈26 · правый край 12.3…15.0
 *   верх        y 59.0 (для меню из навигации)
 *   строка      шаг 36.3 (фильтр) · 35.7 (сортировка)
 *   галочка     x 19.3, ширина 8 — СЛЕВА
 *   знак        центр ≈48 · подпись с 70
 *   разделитель добавляет к шагу ~20
 *   стекло      полупрозрачная заливка + размытие фона (виден контент под меню)
 *   подстрока   «Artist / A-Z» — вторая строка мельче и глуше (IMG_1974)
 *   действия    IMG_1952: две крупные кнопки знак-над-подписью первой группой
 *   подменю     пункт с шевроном раскрывается НА МЕСТЕ, сверху строка «‹ назад»
 *
 * Меню ставится ТАМ, ГДЕ КНОПКА: у навигации — сверху-справа, у нижних
 * инструментов — НАД кнопкой, с ростом из её угла (transform-origin).
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export interface MenuItem {
  id: string;
  label: string;
  /** Подстрока глуше — как «A-Z» под «Artist» (📐 IMG_1974). */
  sub?: string;
  icon?: ReactNode;
  checked?: boolean;
  danger?: boolean;
  /** Подменю: раскрывается на месте, сверху появляется строка «назад». */
  submenu?: MenuGroups;
  onSelect?: () => void;
}
export type MenuGroups = MenuItem[][];
/** Крупные действия первой группой — знак над подписью (📐 IMG_1952). */
export interface MenuAction { id: string; label: string; icon: ReactNode; onSelect: () => void }

const row: CSSProperties = {
  display: "grid",
  /* 📐 галочка центр ~23 · знак центр ~48 · подпись с 70 */
  gridTemplateColumns: "31px 30px 1fr",
  alignItems: "center", width: "100%", minHeight: 36, padding: "0 14px 0 8px",
  background: "none", border: "none", cursor: "pointer", textAlign: "left",
  WebkitTapHighlightColor: "transparent",
  fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)",
  lineHeight: "var(--lh-subhead)", letterSpacing: "var(--ls-subhead)",
};

function Hairline() {
  /* 📐 разделитель добавляет к шагу ~20 */
  return <div aria-hidden style={{ height: 1, margin: "9px 0",
    background: "var(--color-separator)", opacity: 0.6 }} />;
}
function ChevronRightSmall() {
  return <svg width={13} height={13} viewBox="0 0 24 24" aria-hidden>
    <path fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"
      strokeLinejoin="round" d="M9 5.5 15.5 12 9 18.5" /></svg>;
}

export function Menu({ groups, actions, place, origin = "top right", onClose }: {
  groups: MenuGroups;
  actions?: MenuAction[];
  /** Где стоит меню — у той кнопки, что его вызвала. */
  place: CSSProperties;
  /** Из какого угла оно вырастает. */
  origin?: string;
  onClose: () => void;
}) {
  const [stack, setStack] = useState<{ label: string; groups: MenuGroups }[]>([]);
  const cur = stack.length ? stack[stack.length - 1].groups : groups;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 1700 }}>
      <div role="menu" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", ...place,
        width: 248,                                   /* 📐 */
        borderRadius: 26,                             /* 📐 */
        overflow: "hidden",
        /* СТЕКЛО — на живом снимке под меню просвечивает контент */
        background: "rgba(44,44,46,0.72)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
        transformOrigin: origin,
        animation: "xMenuIn 150ms ease-out",
        padding: "6px 0",
      }}>
        {/* Крупные действия — только на корневом уровне */}
        {actions && stack.length === 0 && (
          <>
            <div style={{ display: "flex", gap: 6, padding: "8px 10px 4px" }}>
              {actions.map((a) => (
                <button key={a.id} type="button"
                  onClick={() => { a.onSelect(); onClose(); }}
                  style={{ flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 6, padding: "8px 4px 6px",
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--color-label)", WebkitTapHighlightColor: "transparent",
                    fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)",
                    lineHeight: "var(--lh-caption2)", letterSpacing: "var(--ls-caption2)" }}>
                  <span style={{ display: "grid" }}>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
            <Hairline />
          </>
        )}

        {/* Строка возврата из подменю */}
        {stack.length > 0 && (
          <>
            <button type="button" style={{ ...row, color: "var(--color-label-2)" }}
              onClick={() => setStack((s) => s.slice(0, -1))}>
              <span aria-hidden style={{ display: "grid", placeItems: "center",
                transform: "rotate(180deg)" }}><ChevronRightSmall /></span>
              <span />
              <span>{stack[stack.length - 1].label}</span>
            </button>
            <Hairline />
          </>
        )}

        {cur.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <Hairline />}
            {group.map((it) => (
              <button key={it.id} type="button" role="menuitem"
                onClick={() => {
                  if (it.submenu) { setStack((s) => [...s, { label: it.label, groups: it.submenu! }]); return; }
                  it.onSelect?.(); onClose();
                }}
                style={{ ...row,
                  color: it.danger ? "var(--color-danger-text)" : "var(--color-label)" }}>
                {/* 📐 отметка СЛЕВА — глаз находит выбранное, не дочитывая */}
                <span aria-hidden style={{ display: "grid", placeItems: "center",
                  color: "var(--color-gold-deep)" }}>{it.checked ? "✓" : ""}</span>
                <span aria-hidden style={{ display: "grid", placeItems: "center",
                  color: "var(--color-label-2)" }}>{it.icon}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                    {it.sub && (
                      <span style={{ display: "block", fontSize: "var(--text-caption2)",
                        lineHeight: "var(--lh-caption2)", letterSpacing: "var(--ls-caption2)",
                        color: "var(--color-label-3)" }}>{it.sub}</span>
                    )}
                  </span>
                  {it.submenu && <span aria-hidden style={{ color: "var(--color-label-3)",
                    display: "grid" }}><ChevronRightSmall /></span>}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <style>{`@keyframes xMenuIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

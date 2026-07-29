/**
 * Ц8 · ПУТЬ УЧЕНИКА — /path.
 *
 * Внутри-приложенческая лестница: Первые шаги → Практика → К первой инициации →
 * Ко второй; шаги отмечаются (самоаттестация: приложение ХРАНИТ отметку, а не
 * судит). Канон ступеней — path.ts (действующий путь ЦОСКР/GBC, не выдумка).
 * Уровень преданного (Ц1) мягко подсвечивает «вы примерно здесь» — ничего не
 * запирая: путь у каждого свой.
 *
 * Рекомендованное чтение НЕ дублируется: у него есть механизм и экран
 * (/progress, MyProgressScreen) — отсюда только тизер-переход. Один механизм —
 * одно место (дух ЗКН-Н060: второго строителя не заводим и для смыслов).
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "./account/store";
import { api } from "./api";
import { effectiveLevel } from "./devotee";
import { LEVEL_TO_STAGE, PATH_STAGES, mergeServerPath, readPathDone, togglePathStep } from "./path";

const FONT = "var(--font-text)";
const INK = "var(--color-ink)";
const INK2 = "var(--color-ink-2)";
const INK3 = "var(--color-ink-3)";
const GOLD = "var(--color-gold)";
const CARD = "var(--color-surface-2)";
const HAIR = "var(--color-hairline)";
const GREEN = "var(--color-success-text, #2a9c68)";

function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center", border: on ? "none" : `1.5px solid ${HAIR}`, background: on ? GREEN : "transparent", color: "white", transition: "background .15s" }}>
      {on && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export default function PathScreen({ onBack, onOpen }: { onBack: () => void; onOpen: (path: string) => void }) {
  const { user } = useAuth();
  const [done, setDone] = useState<Set<string>>(() => readPathDone());

  // Вход с нового устройства: серверные отметки вливаются в локальные.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetch(api("/me/progress?work=path"), { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: { ref: string }[] } | null) => {
        if (alive && d?.items?.length) setDone(mergeServerPath(d.items.map((i) => i.ref)));
      }).catch(() => {});
    return () => { alive = false; };
  }, [user]);

  const hereStage = useMemo(() => {
    const l = effectiveLevel(user);
    return l ? LEVEL_TO_STAGE[l] ?? null : null;
  }, [user]);

  const toggle = (id: string) => setDone(togglePathStep(id, !done.has(id)));

  const label: CSSProperties = { fontSize: "var(--text-footnote)", fontWeight: 600, color: INK3, fontFamily: FONT, textTransform: "uppercase", margin: "22px 4px 8px", display: "flex", alignItems: "baseline", gap: 8 };

  return (
    <div style={{ padding: "0 16px calc(96px + env(safe-area-inset-bottom))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 0 2px" }}>
        <button type="button" onClick={onBack} aria-label="Назад"
          style={{ border: "none", background: "none", color: GOLD, fontFamily: FONT, fontSize: "var(--text-body)", fontWeight: 600, padding: "6px 8px 6px 0", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          ‹ Назад
        </button>
      </div>
      <h1 style={{ margin: "2px 4px 0", fontFamily: FONT, fontSize: "var(--text-title1)", fontWeight: 700, color: INK }}>Путь ученика</h1>
      <div style={{ margin: "6px 4px 0", fontFamily: FONT, fontSize: "var(--text-subhead)", color: INK2 }}>
        От первой программы до брахманского посвящения — действующий путь ЦОСКР. Отмечайте пройденное: путь у каждого свой, ступени никого не запирают.
      </div>

      {/* Рекомендованное чтение — тизер, механизм живёт в /progress */}
      <div style={label}>Чтение Прабхупады</div>
      <button type="button" onClick={() => onOpen("/progress")}
        style={{ display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer", background: CARD, borderRadius: 14, padding: "14px 16px", WebkitTapHighlightColor: "transparent" }}>
        <span style={{ display: "block", fontFamily: FONT, fontSize: "var(--text-callout)", fontWeight: 600, color: INK }}>Системное чтение: Гита → Бхагаватам → Чайтанья-чаритамрита</span>
        <span style={{ display: "block", marginTop: 6, fontFamily: FONT, fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD }}>Мой прогресс чтения →</span>
      </button>

      {PATH_STAGES.map((st) => {
        const n = st.steps.filter((s) => done.has(s.id)).length;
        const here = st.id === hereStage;
        return (
          <div key={st.id}>
            <div style={label}>
              <span>{st.title}</span>
              <span style={{ textTransform: "none", fontWeight: 600, color: n === st.steps.length ? GREEN : INK3 }}>{n}/{st.steps.length}</span>
              {here && <span style={{ textTransform: "none", color: GOLD }}>· вы здесь</span>}
            </div>
            <div style={{ background: CARD, borderRadius: 14, overflow: "hidden" }}>
              {st.steps.map((s, i) => {
                const on = done.has(s.id);
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderTop: i ? `0.5px solid ${HAIR}` : "none" }}>
                    <button type="button" onClick={() => toggle(s.id)} aria-label={on ? "Снять отметку" : "Отметить пройденным"}
                      style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "inline-flex", WebkitTapHighlightColor: "transparent" }}>
                      <Check on={on} />
                    </button>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: FONT, fontSize: "var(--text-callout)", fontWeight: 600, color: on ? INK2 : INK }}>{s.title}</span>
                        {s.badge && <span style={{ fontFamily: FONT, fontSize: "var(--text-caption)", fontWeight: 700, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 6, padding: "1px 6px" }}>{s.badge}</span>}
                      </span>
                      {s.sub && <span style={{ display: "block", marginTop: 2, fontFamily: FONT, fontSize: "var(--text-footnote)", color: INK3 }}>{s.sub}</span>}
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noreferrer"
                          style={{ display: "inline-block", marginTop: 5, fontFamily: FONT, fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD, textDecoration: "none" }}>
                          Открыть курс ↗
                        </a>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ margin: "18px 4px 0", fontFamily: FONT, fontSize: "var(--text-footnote)", color: INK3 }}>
        Сроки и порядок рекомендаций различаются по ятрам — уточняйте у наставника и совета своей общины. Полный справочник курсов — в разделе «Обучение».
      </div>
    </div>
  );
}

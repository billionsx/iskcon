/**
 * VowScreen — экран обета (санкальпа). Без обета: онбординг + «Принять обет».
 * Создание: название, срок (пресеты или своя дата), служения (пресеты + своё).
 * Активный обет: кольцо прогресса, срок/остаток, отметка служений за сегодня,
 * отчёт (серия/лучшая, проценты по каждому служению), тепловая карта дней,
 * действия (поделиться отчётом · завершить · отказаться) и архив прошлых обетов.
 */
import { useEffect, useMemo, useState } from "react";
import {
  PRESET_COMMITMENTS, DURATION_PRESETS, ymd, addDays, fmtDate, vowStats, vowReportText,
  useActiveVow, useArchive, createVow, toggleCommitment, setCount, isNumeric, closeVow, deleteArchived, pullVows,
  type Commitment, type Vow,
} from "./vows";
import { listCollectiveVows, contributeCollective, type CollectiveVow } from "./collectiveVows";

const SAFFRON = "#DD7A1E";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";
const BG2 = "var(--color-bg-2)";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Back = () => <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>;
const Check = ({ size = 15 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 6.5" /></svg>;

function pluralDays(n: number): string { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return "день"; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "дня"; return "дней"; }
function roundsWord(r: number): string { const m10 = r % 10, m100 = r % 100; if (m10 === 1 && m100 !== 11) return "круг"; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "круга"; return "кругов"; }
function japaCommitment(r: number): Commitment { return { id: "japa", label: "Джапа", detail: `${r} ${roundsWord(r)}`, target: r, unit: "кругов" }; }

function Ring({ pct, size = 88, stroke = 9, accent = SAFFRON }: { pct: number; size?: number; stroke?: number; accent?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={HAIR} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .5s ease" }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontFamily={FD} fontSize={size * 0.27} fontWeight={800} fill={L1}>{pct}%</text>
    </svg>
  );
}

/* ── Тепловая карта дней обета ─────────────────────────────────────────────── */
function Heatmap({ vow }: { vow: Vow }) {
  const s = vowStats(vow);
  const M = vow.commitments.length || 1;
  const today = ymd();
  const days: string[] = [];
  let cur = vow.startDate;
  for (let i = 0; i < s.dayTotal; i++) { days.push(cur); cur = addDays(cur, 1); }
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {days.map((d) => {
          const future = d > today;
          const done = s.dayDone[d] ?? 0;
          const ratio = future ? 0 : done / M;
          const bg = future ? "transparent" : ratio === 0 ? "color-mix(in srgb, var(--color-label) 7%, transparent)"
            : ratio >= 1 ? SAFFRON : `color-mix(in srgb, ${SAFFRON} ${Math.round(30 + ratio * 55)}%, transparent)`;
          const isToday = d === today;
          return (
            <span key={d} title={`${fmtDate(d)} · ${done}/${M}`}
              style={{ width: 15, height: 15, borderRadius: 4, background: bg, border: future ? `1px dashed ${HAIR}` : isToday ? `1.5px solid ${SAFFRON}` : "none", boxSizing: "border-box" }} />
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontFamily: FT, fontSize: "var(--text-caption)", color: L3 }}>
        <span>меньше</span>
        {[0.12, 0.4, 0.7, 1].map((r, i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 3, background: r >= 1 ? SAFFRON : `color-mix(in srgb, ${SAFFRON} ${Math.round(30 + r * 55)}%, transparent)` }} />)}
        <span>больше</span>
      </div>
    </div>
  );
}

/* ── Дашборд активного обета ───────────────────────────────────────────────── */
function VowDashboard({ vow }: { vow: Vow }) {
  const s = vowStats(vow);
  const today = ymd();
  const [confirmClose, setConfirmClose] = useState<null | "completed" | "abandoned">(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800); };

  const shareReport = async () => {
    const text = vowReportText(vow);
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> }) : null;
    try { if (nav?.share) { await nav.share({ title: vow.title, text }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(text); flash("Отчёт скопирован"); } catch { flash("Не удалось скопировать"); }
  };

  const card: React.CSSProperties = { borderRadius: 18, border: `0.5px solid ${HAIR}`, background: BG2, padding: 16 };
  const stepBtn: React.CSSProperties = { width: 38, height: 36, border: "none", background: "none", color: L2, fontSize: "var(--text-title2)", fontWeight: 400, cursor: "pointer", lineHeight: 1, display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" };
  const stepNum: React.CSSProperties = { minWidth: 30, height: 36, border: "none", borderLeft: `0.5px solid ${HAIR}`, borderRight: `0.5px solid ${HAIR}`, background: "none", fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 700, cursor: "pointer", padding: "0 8px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* заголовок + кольцо */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 16 }}>
        <Ring pct={s.pct} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FD, fontSize: "var(--text-title3)", fontWeight: 800, letterSpacing: "-0.3px", color: L1, lineHeight: 1.12 }}>{vow.title}</div>
          <div style={{ marginTop: 5, fontFamily: FT, fontSize: "var(--text-footnote)", color: L2 }}>{fmtDate(vow.startDate)} — {fmtDate(vow.endDate)}</div>
          <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, background: `color-mix(in srgb, ${SAFFRON} 13%, transparent)`, color: SAFFRON, fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 700 }}>
            {s.overdue ? "Срок завершён" : !s.started ? "Начнётся скоро" : `Осталось ${s.remaining} ${pluralDays(s.remaining)}`}
          </div>
        </div>
      </div>

      {/* отметка за сегодня */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, color: L1 }}>Сегодня</h3>
          <span style={{ fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600, color: s.todayDone.length === vow.commitments.length ? SAFFRON : L3 }}>{s.todayDone.length} из {vow.commitments.length}</span>
        </div>
        {s.overdue ? (
          <p style={{ margin: "6px 0 0", fontFamily: FT, fontSize: "var(--text-footnote)", color: L3, lineHeight: 1.5 }}>Срок обета завершён. Подведите итог ниже.</p>
        ) : (
          <div>
            {vow.commitments.map((c, i) => {
              const numeric = isNumeric(c);
              const cnt = (vow.log[today] || {})[c.id] || 0;
              const done = s.todayDone.includes(c.id);
              const target = c.target || 1;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i === 0 ? "none" : `0.5px solid ${HAIR}` }}>
                  {numeric ? (
                    <span style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: "50%", border: done ? "none" : `2px solid ${HAIR}`, background: done ? SAFFRON : "transparent" }}>{done && <Check />}</span>
                  ) : (
                    <button type="button" aria-label={done ? "Снять отметку" : "Отметить выполнено"} onClick={() => toggleCommitment(today, c.id)}
                      style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: "50%", border: done ? "none" : `2px solid ${HAIR}`, background: done ? SAFFRON : "transparent", cursor: "pointer", padding: 0, transition: "background .15s", WebkitTapHighlightColor: "transparent" }}>{done && <Check />}</button>
                  )}
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontFamily: FT, fontSize: "var(--text-callout)", fontWeight: 600, color: L1, letterSpacing: "-0.1px" }}>{c.label}</span>
                    {(c.detail || numeric) && <span style={{ display: "block", fontFamily: FT, fontSize: "var(--text-footnote)", color: L3 }}>{numeric ? `${cnt} из ${target}${c.unit ? " " + c.unit : ""}` : c.detail}</span>}
                  </span>
                  {numeric && (
                    <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", borderRadius: 10, border: `0.5px solid ${HAIR}`, overflow: "hidden" }}>
                      <button type="button" aria-label="Меньше" onClick={() => setCount(today, c.id, Math.max(0, cnt - 1))} style={stepBtn}>−</button>
                      <button type="button" aria-label="Отметить полностью" onClick={() => setCount(today, c.id, cnt >= target ? 0 : target)} style={{ ...stepNum, color: done ? SAFFRON : L1 }}>{cnt}</button>
                      <button type="button" aria-label="Больше" onClick={() => setCount(today, c.id, Math.min(target, cnt + 1))} style={stepBtn}>+</button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* отчёт */}
      <div style={card}>
        <h3 style={{ margin: "0 0 12px", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, color: L1 }}>Отчёт</h3>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[{ k: "Серия", v: `${s.current}` }, { k: "Лучшая", v: `${s.longest}` }, { k: "Пройдено", v: `${s.elapsed}/${s.dayTotal}` }].map((m) => (
            <div key={m.k} style={{ flex: 1, textAlign: "center", padding: "12px 6px", borderRadius: 13, background: "color-mix(in srgb, var(--color-label) 4%, transparent)" }}>
              <div style={{ fontFamily: FD, fontSize: "var(--text-title2)", fontWeight: 800, color: L1, lineHeight: 1 }}>{m.v}</div>
              <div style={{ marginTop: 4, fontFamily: FT, fontSize: "var(--text-caption)", color: L3 }}>{m.k}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {s.per.map((p) => (
            <div key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                <span style={{ fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600, color: L1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{p.label}</span>
                <span style={{ flexShrink: 0, fontFamily: FT, fontSize: 12.5, fontWeight: 700, color: L2 }}>{p.numeric ? `${p.sum}${p.unit ? " " + p.unit : ""} · ${p.pct}%` : `${p.done}/${p.total} · ${p.pct}%`}</span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: HAIR, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${p.pct}%`, borderRadius: 999, background: SAFFRON, transition: "width .5s ease" }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600, color: L3, marginBottom: 9 }}>Карта дней</div>
          <Heatmap vow={vow} />
        </div>
      </div>

      {/* действия */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button type="button" onClick={() => void shareReport()} style={{ height: 48, borderRadius: 14, border: `0.5px solid ${HAIR}`, background: BG2, color: L1, fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Поделиться отчётом</button>
        {confirmClose ? (
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontFamily: FT, fontSize: "var(--text-subhead)", color: L1, marginBottom: 12, lineHeight: 1.45 }}>
              {confirmClose === "completed" ? "Завершить обет и перенести его в архив?" : "Отказаться от обета? Он перейдёт в архив как незавершённый."}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setConfirmClose(null)} style={{ flex: 1, height: 44, borderRadius: 12, border: `0.5px solid ${HAIR}`, background: "none", color: L1, fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer" }}>Отмена</button>
              <button type="button" onClick={() => { closeVow(confirmClose); }} style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: confirmClose === "completed" ? SAFFRON : "#C8473A", color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer" }}>
                {confirmClose === "completed" ? "Завершить" : "Отказаться"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setConfirmClose("completed")} style={{ flex: 1, height: 46, borderRadius: 13, border: "none", background: SAFFRON, color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Завершить обет</button>
            <button type="button" onClick={() => setConfirmClose("abandoned")} style={{ flexShrink: 0, height: 46, padding: "0 18px", borderRadius: 13, border: `0.5px solid ${HAIR}`, background: "none", color: L2, fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Отказаться</button>
          </div>
        )}
      </div>

      {toast && <div style={{ position: "fixed", left: "50%", bottom: "calc(40px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 90, padding: "11px 18px", borderRadius: 999, background: L1, color: "var(--color-bg)", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 500, boxShadow: "var(--shadow-card)" }}>{toast}</div>}
    </div>
  );
}

/* ── Создание обета ────────────────────────────────────────────────────────── */
function VowCreate({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [dur, setDur] = useState<string>("30");
  const [customEnd, setCustomEnd] = useState("");
  const [sel, setSel] = useState<Record<string, Commitment>>(() => ({ japa: japaCommitment(16), reading: PRESET_COMMITMENTS[1] }));
  const [japaRounds, setJapaRounds] = useState(16);
  const [customLabel, setCustomLabel] = useState("");
  const [customTarget, setCustomTarget] = useState("");
  const [customUnit, setCustomUnit] = useState("");

  const tomorrow = addDays(ymd(), 1);
  const count = Object.keys(sel).length;
  const valid = count > 0 && (dur !== "custom" || !!customEnd);

  const toggle = (c: Commitment) => setSel((s) => { const n = { ...s }; if (n[c.id]) delete n[c.id]; else n[c.id] = c.id === "japa" ? japaCommitment(japaRounds) : c; return n; });
  const changeRounds = (val: number) => { const r = Math.max(1, Math.min(192, Math.round(val))); setJapaRounds(r); setSel((s) => (s.japa ? { ...s, japa: japaCommitment(r) } : s)); };
  const addCustom = () => {
    const label = customLabel.trim(); if (!label) return;
    const id = `c_${Date.now().toString(36)}`;
    const t = parseInt(customTarget, 10);
    const target = Number.isFinite(t) && t > 1 ? t : undefined;
    const unit = target ? (customUnit.trim() || undefined) : undefined;
    const detail = target ? `${target}${unit ? " " + unit : ""}` : undefined;
    setSel((s) => ({ ...s, [id]: { id, label, target, unit, detail } }));
    setCustomLabel(""); setCustomTarget(""); setCustomUnit("");
  };
  const submit = () => {
    if (!valid) return;
    const commitments = Object.values(sel);
    if (dur === "custom") createVow({ title, endDate: customEnd, commitments });
    else createVow({ title, days: DURATION_PRESETS.find((d) => d.id === dur)?.days ?? 30, commitments });
    onDone();
  };

  const sectionTitle: React.CSSProperties = { fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 700, color: L1, margin: "0 0 10px" };
  const chip = (on: boolean): React.CSSProperties => ({ height: 36, padding: "0 15px", borderRadius: 999, border: on ? "none" : `0.5px solid ${HAIR}`, cursor: "pointer", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 600, background: on ? SAFFRON : BG2, color: on ? "#fff" : L2, WebkitTapHighlightColor: "transparent" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <p style={{ margin: 0, fontFamily: FT, fontSize: "var(--text-subhead)", color: L2, lineHeight: 1.5 }}>
        Санкальпа — решимость на конкретный срок и конкретные служения. Выберите, к чему вы себя обязываете, и приложение будет вести ежедневный учёт.
      </p>

      {/* название */}
      <div>
        <h3 style={sectionTitle}>Название</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Картика-врата"
          style={{ width: "100%", boxSizing: "border-box", height: 46, padding: "0 14px", borderRadius: 12, border: `0.5px solid ${HAIR}`, background: BG2, fontFamily: FT, fontSize: "var(--text-subhead)", color: L1, outline: "none" }} />
      </div>

      {/* срок */}
      <div>
        <h3 style={sectionTitle}>Срок</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {DURATION_PRESETS.map((d) => <button key={d.id} type="button" onClick={() => setDur(d.id)} style={chip(dur === d.id)}>{d.label}</button>)}
          <button type="button" onClick={() => setDur("custom")} style={chip(dur === "custom")}>Своя дата</button>
        </div>
        {dur === "custom" && (
          <div style={{ marginTop: 12 }}>
            <input type="date" value={customEnd} min={tomorrow} onChange={(e) => setCustomEnd(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", height: 46, padding: "0 14px", borderRadius: 12, border: `0.5px solid ${HAIR}`, background: BG2, fontFamily: FT, fontSize: "var(--text-subhead)", color: L1, outline: "none" }} />
            <div style={{ marginTop: 6, fontFamily: FT, fontSize: "var(--text-footnote)", color: L3 }}>Дата окончания (включительно). Начало — сегодня.</div>
          </div>
        )}
      </div>

      {/* служения */}
      <div>
        <h3 style={sectionTitle}>Служения <span style={{ fontWeight: 500, color: L3, fontSize: "var(--text-footnote)" }}>· {count} выбрано</span></h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PRESET_COMMITMENTS.flatMap((c) => {
            const on = !!sel[c.id];
            const detail = c.id === "japa" ? `${japaRounds} ${roundsWord(japaRounds)}` : c.detail;
            const stepBtn: React.CSSProperties = { width: 40, height: 38, border: "none", background: "none", color: L2, fontSize: "var(--text-title2)", cursor: "pointer", lineHeight: 1, display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" };
            const nodes = [
              <button key={c.id} type="button" onClick={() => toggle(c)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 13, border: on ? `1.5px solid ${SAFFRON}` : `0.5px solid ${HAIR}`, background: on ? `color-mix(in srgb, ${SAFFRON} 7%, transparent)` : BG2, cursor: "pointer", textAlign: "left" as const, WebkitTapHighlightColor: "transparent" }}>
                <span style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", border: on ? "none" : `2px solid ${HAIR}`, background: on ? SAFFRON : "transparent" }}>{on && <Check size={13} />}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 600, color: L1 }}>{c.label}</span>
                  {detail && <span style={{ display: "block", fontFamily: FT, fontSize: "var(--text-footnote)", color: L3 }}>{detail}</span>}
                </span>
              </button>,
            ];
            if (c.id === "japa" && on) {
              nodes.push(
                <div key="japa-rounds" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderRadius: 13, background: "color-mix(in srgb, var(--color-label) 4%, transparent)" }}>
                  <span style={{ fontFamily: FT, fontSize: "var(--text-footnote)", color: L2 }}>Кругов в день</span>
                  <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 10, border: `0.5px solid ${HAIR}`, overflow: "hidden", background: BG2 }}>
                    <button type="button" aria-label="Меньше" onClick={() => changeRounds(japaRounds - 1)} style={stepBtn}>−</button>
                    <span style={{ minWidth: 46, textAlign: "center", fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 700, color: L1 }}>{japaRounds}</span>
                    <button type="button" aria-label="Больше" onClick={() => changeRounds(japaRounds + 1)} style={stepBtn}>+</button>
                  </span>
                </div>,
              );
            }
            return nodes;
          })}
          {/* свои служения */}
          {Object.values(sel).filter((c) => !PRESET_COMMITMENTS.some((p) => p.id === c.id)).map((c) => (
            <button key={c.id} type="button" onClick={() => toggle(c)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 13, border: `1.5px solid ${SAFFRON}`, background: `color-mix(in srgb, ${SAFFRON} 7%, transparent)`, cursor: "pointer", textAlign: "left" }}>
              <span style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", background: SAFFRON }}><Check size={13} /></span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 600, color: L1 }}>{c.label}</span>
                {c.detail && <span style={{ display: "block", fontFamily: FT, fontSize: "var(--text-footnote)", color: L3 }}>{c.detail}</span>}
              </span>
              <span style={{ flexShrink: 0, fontFamily: FT, fontSize: "var(--text-footnote)", color: L3 }}>убрать</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }} placeholder="Своё служение"
              style={{ flex: 1, minWidth: 0, height: 44, padding: "0 14px", borderRadius: 12, border: `0.5px solid ${HAIR}`, background: BG2, fontFamily: FT, fontSize: "var(--text-subhead)", color: L1, outline: "none" }} />
            <button type="button" onClick={addCustom} disabled={!customLabel.trim()} aria-label="Добавить служение" style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, border: "none", background: customLabel.trim() ? SAFFRON : HAIR, color: "#fff", fontSize: "var(--text-title2)", fontWeight: 400, cursor: customLabel.trim() ? "pointer" : "default", lineHeight: 1 }}>+</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" inputMode="numeric" min={2} value={customTarget} onChange={(e) => setCustomTarget(e.target.value)} placeholder="цель/день"
              style={{ width: 112, height: 40, boxSizing: "border-box", padding: "0 12px", borderRadius: 10, border: `0.5px solid ${HAIR}`, background: BG2, fontFamily: FT, fontSize: "var(--text-subhead)", color: L1, outline: "none" }} />
            <input value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }} placeholder="единица (поклонов, страниц…)" disabled={!(parseInt(customTarget, 10) > 1)}
              style={{ flex: 1, minWidth: 0, height: 40, padding: "0 12px", borderRadius: 10, border: `0.5px solid ${HAIR}`, background: BG2, fontFamily: FT, fontSize: "var(--text-subhead)", color: L1, outline: "none", opacity: parseInt(customTarget, 10) > 1 ? 1 : 0.5 }} />
          </div>
          <div style={{ fontFamily: FT, fontSize: "var(--text-caption)", color: L3, lineHeight: 1.45 }}>Цель и единица — необязательно. С целью служение считается числом (например, 108 · поклонов).</div>
        </div>
      </div>

      {/* действия */}
      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button type="button" onClick={onCancel} style={{ flexShrink: 0, height: 50, padding: "0 20px", borderRadius: 14, border: `0.5px solid ${HAIR}`, background: "none", color: L2, fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer" }}>Отмена</button>
        <button type="button" onClick={submit} disabled={!valid} style={{ flex: 1, height: 50, borderRadius: 14, border: "none", background: valid ? SAFFRON : HAIR, color: "#fff", fontFamily: FT, fontSize: "var(--text-callout)", fontWeight: 700, cursor: valid ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}>Принять обет</button>
      </div>
    </div>
  );
}

/* ── Архив прошлых обетов ─────────────────────────────────────────────────── */
function ArchiveList({ items }: { items: Vow[] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 26 }}>
      <h3 style={{ margin: "0 0 12px", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, color: L1 }}>Прошлые обеты</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((v) => {
          const s = vowStats(v);
          return (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 14, border: `0.5px solid ${HAIR}`, background: BG2 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 600, color: L1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.title}</div>
                <div style={{ marginTop: 2, fontFamily: FT, fontSize: 12.5, color: L3 }}>{fmtDate(v.startDate)} — {fmtDate(v.endDate)} · {v.status === "completed" ? "завершён" : "прерван"} · {s.pct}%</div>
              </div>
              <button type="button" aria-label="Удалить" onClick={() => deleteArchived(v.id)} style={{ flexShrink: 0, width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L3, cursor: "pointer" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" /></svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const fmtNum = (n: number): string => n.toLocaleString("ru-RU");
function membersWord(n: number): string { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return "участник"; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "участника"; return "участников"; }

/** Совместные враты — сангха без ленты/чата: общий итог, участники, мой вклад. */
function CollectiveVowsSection() {
  const [items, setItems] = useState<CollectiveVow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { let a = true; void listCollectiveVows().then((x) => { if (a) setItems(x); }); return () => { a = false; }; }, []);
  if (!items || !items.length) return null;

  async function add(v: CollectiveVow, amount: number) {
    if (busy) return;
    setBusy(v.id); setNote(null);
    const r = await contributeCollective(v.id, amount);
    setBusy(null);
    if (r === "auth") { setNote("Войдите в кабинет, чтобы участвовать."); return; }
    if (r) setItems(r);
  }

  return (
    <section style={{ marginTop: 28 }}>
      <h3 style={{ margin: "0 4px 4px", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>Совместные враты</h3>
      <p style={{ margin: "0 4px 14px", fontFamily: FT, fontSize: "var(--text-footnote)", lineHeight: 1.5, color: L3 }}>Сангха без ленты и переписки — общее памятование и движение к цели вместе.</p>
      {items.map((v) => {
        const pct = v.target > 0 ? Math.min(100, Math.round((v.total / v.target) * 100)) : 0;
        return (
          <div key={v.id} style={{ background: "var(--color-bg-2)", borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", padding: "16px 16px", marginBottom: 12 }}>
            <div style={{ fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, color: L1 }}>{v.title}</div>
            {v.description && <div style={{ fontFamily: FT, fontSize: "var(--text-footnote)", lineHeight: 1.5, color: L2, marginTop: 5 }}>{v.description}</div>}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 14 }}>
              <span style={{ fontFamily: FD, fontSize: "var(--text-title3)", fontWeight: 800, color: SAFFRON }}>{fmtNum(v.total)}</span>
              <span style={{ fontFamily: FT, fontSize: "var(--text-footnote)", color: L3 }}>из {fmtNum(v.target)} {v.unit}</span>
            </div>
            <div style={{ height: 8, borderRadius: 8, background: "rgba(120,120,128,0.18)", marginTop: 8, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 8, background: SAFFRON, transition: "width .3s" }} />
            </div>
            <div style={{ fontFamily: FT, fontSize: 12.5, color: L3, marginTop: 8 }}>{fmtNum(v.members)} {membersWord(v.members)}{v.mine > 0 ? ` · мой вклад ${fmtNum(v.mine)}` : ""}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[1, 4, 16].map((n) => (
                <button key={n} type="button" disabled={busy === v.id} onClick={() => void add(v, n)}
                  style={{ flex: 1, height: 40, borderRadius: 11, border: `1px solid ${SAFFRON}`, background: "transparent", color: SAFFRON, fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: busy === v.id ? "default" : "pointer", opacity: busy === v.id ? 0.5 : 1, WebkitTapHighlightColor: "transparent" }}>
                  +{n} {v.unit === "кругов" ? "" : ""}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {note && <div style={{ fontFamily: FT, fontSize: "var(--text-footnote)", color: L3, textAlign: "center", marginTop: 2 }}>{note}</div>}
    </section>
  );
}

export default function VowScreen({ onBack }: { onBack: () => void }) {
  const active = useActiveVow();
  const archive = useArchive();
  const [creating, setCreating] = useState(false);
  const heading = useMemo(() => (creating ? "Принять обет" : active ? "Мой обет" : "Обет"), [creating, active]);
  useEffect(() => { void pullVows(); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
        background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: `0.5px solid ${HAIR}` }}>
        <button type="button" aria-label="Назад" onClick={() => (creating ? setCreating(false) : onBack())} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>{heading}</div>
        <span style={{ width: 38 }} />
      </header>

      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>
          {creating ? (
            <VowCreate onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
          ) : active ? (
            <>
              <VowDashboard vow={active} />
              <CollectiveVowsSection />
              <ArchiveList items={archive} />
            </>
          ) : (
            <>
              {/* онбординг */}
              <div style={{ textAlign: "center", padding: "28px 12px 8px" }}>
                <div style={{ width: 76, height: 76, margin: "0 auto 18px", borderRadius: "50%", display: "grid", placeItems: "center", background: `color-mix(in srgb, ${SAFFRON} 12%, transparent)`, color: SAFFRON }}>
                  <svg width="38" height="38" viewBox="0 0 24 24" aria-hidden><path {...STROKE} strokeWidth={1.6} d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5L12 21l-5 2.1 1-5.5-4-3.9 5.5-.8z" /></svg>
                </div>
                <h2 style={{ margin: 0, fontFamily: FD, fontSize: "var(--text-title2)", fontWeight: 800, letterSpacing: "-0.4px", color: L1 }}>Дайте обет</h2>
                <p style={{ margin: "10px auto 0", maxWidth: 320, fontFamily: FT, fontSize: "var(--text-subhead)", lineHeight: 1.55, color: L2 }}>
                  Санкальпа укрепляет духовную практику. Возьмите на себя конкретные служения на выбранный срок — и ведите ежедневный учёт с честным отчётом.
                </p>
              </div>
              <button type="button" onClick={() => setCreating(true)} style={{ width: "100%", height: 52, marginTop: 22, borderRadius: 15, border: "none", background: SAFFRON, color: "#fff", fontFamily: FT, fontSize: "var(--text-callout)", fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Принять обет</button>
              <CollectiveVowsSection />
              <ArchiveList items={archive} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

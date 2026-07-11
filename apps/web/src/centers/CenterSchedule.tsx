/**
 * CenterSchedule — управление расписанием центра (программы дня).
 *
 * Для админа центра: список программ + добавление/правка/удаление (тип, дни
 * недели, время, заметка). Эстетика приложения: золото + мягкая заливка, токены
 * темы, инлайн-SVG. Данные — через centersClient (POST/PATCH/DELETE
 * /api/centers/:id/programs). Карточка центра показывает это расписание.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAuthed, requireAuth } from "./../account/track";
import { centersClient, pickI18n, type CenterCard, type CenterProgram } from "./api";

/* ───────────────────── палитра ───────────────────── */
const GOLD = "var(--color-gold)";
const GOLDT = "#9c7c15";
const RED = "var(--color-danger-text)";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL = "var(--color-glass-thin)";
const FILL2 = "var(--color-glass-regular)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";

const RU_WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const QUICK = ["Мангала-арати", "Гуру-пуджа", "Даршан-арати", "Шримад-Бхагаватам", "Сандхья-арати", "Киртан", "Харинама", "Воскресный пир", "Лекция"];
const PROGRAM_LABEL: Record<string, string> = {
  mangala_arati: "Мангала-арати", guru_puja: "Гуру-пуджа", darshan_arati: "Даршан-арати",
  bhagavatam: "Шримад-Бхагаватам", sandhya_arati: "Сандхья-арати", kirtan: "Киртан",
  harinama: "Харинама", feast: "Воскресный пир", lecture: "Лекция",
};
const programLabel = (t: string) => PROGRAM_LABEL[t] || t.replace(/_/g, " ");

function fmtDays(days: number[]): string {
  if (!days || days.length === 0) return "Без дня";
  if (days.length >= 7) return "Ежедневно";
  return DAY_ORDER.filter((d) => days.includes(d)).map((d) => RU_WD[d]).join(", ");
}
function fmtTime(a: string | null, b: string | null): string {
  const t = (s: string | null) => (s ? s.slice(0, 5) : "");
  if (a && b) return `${t(a)}–${t(b)}`;
  return t(a) || t(b) || "";
}

const Back = () => (
  <svg width="11" height="19" viewBox="0 0 11 19" fill="none" aria-hidden>
    <path d="M9 1.5L2 9.5l7 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Plus = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
);
const Chev = () => (
  <svg width="8" height="13" viewBox="0 0 9 15" fill="none" aria-hidden><path d="M1.5 1.5L7 7.5l-5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Clock = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);

const card: CSSProperties = { padding: 16, borderRadius: 18, background: FILL };
const eyebrow: CSSProperties = { fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: L3, margin: "0 4px 8px" };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", fontFamily: FT, fontSize: 15.5, color: L1, background: FILL2, border: "none", outline: "none", borderRadius: 12, padding: "11px 13px", WebkitTapHighlightColor: "transparent" };

type Editing = { mode: "new" } | { mode: "edit"; program: CenterProgram } | null;

export default function CenterSchedule({
  slug,
  onBack,
  flash,
}: {
  slug: string;
  onBack: () => void;
  flash?: (m: string) => void;
}) {
  const authed = useAuthed();
  const [data, setData] = useState<CenterCard | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "notfound">("loading");
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // поля формы
  const [fType, setFType] = useState("");
  const [fDays, setFDays] = useState<number[]>([]);
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fNote, setFNote] = useState("");

  const load = useCallback(() => {
    setPhase("loading");
    centersClient
      .get(slug)
      .then((d) => {
        setData(d);
        setPhase("ready");
      })
      .catch((e: { code?: string }) => setPhase(e?.code === "center_not_found" ? "notfound" : "error"));
  }, [slug]);

  useEffect(() => {
    if (!authed) {
      setPhase("ready");
      return;
    }
    load();
  }, [authed, load]);

  const openNew = () => {
    setErr(null);
    setFType(""); setFDays([1, 2, 3, 4, 5, 6, 0]); setFStart(""); setFEnd(""); setFNote("");
    setEditing({ mode: "new" });
  };
  const openEdit = (pr: CenterProgram) => {
    setErr(null);
    setFType(programLabel(pr.type));
    setFDays(pr.days_of_week || []);
    setFStart(pr.start_time ? pr.start_time.slice(0, 5) : "");
    setFEnd(pr.end_time ? pr.end_time.slice(0, 5) : "");
    setFNote(pickI18n(pr.notes_i18n));
    setEditing({ mode: "edit", program: pr });
  };

  const toggleDay = (d: number) => setFDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const allDays = fDays.length >= 7;

  const centerId = data?.center.id;

  const save = useCallback(() => {
    if (saving || !centerId || !editing) return;
    if (fType.trim().length < 1) {
      setErr("Укажите программу.");
      return;
    }
    setErr(null);
    setSaving(true);
    const payload = {
      type: fType.trim(),
      days_of_week: fDays,
      start_time: fStart || null,
      end_time: fEnd || null,
      notes_i18n: fNote.trim() ? { ru: fNote.trim() } : {},
    };
    const op =
      editing.mode === "new"
        ? centersClient.addProgram(centerId, payload)
        : centersClient.updateProgram(centerId, editing.program.id, payload);
    op
      .then(() => {
        flash?.(editing.mode === "new" ? "Программа добавлена" : "Сохранено");
        setEditing(null);
        load();
      })
      .catch(() => setErr("Не удалось сохранить. Попробуйте ещё раз."))
      .finally(() => setSaving(false));
  }, [saving, centerId, editing, fType, fDays, fStart, fEnd, fNote, flash, load]);

  const remove = useCallback(() => {
    if (saving || !centerId || !editing || editing.mode !== "edit") return;
    setSaving(true);
    centersClient
      .deleteProgram(centerId, editing.program.id)
      .then(() => {
        flash?.("Программа удалена");
        setEditing(null);
        load();
      })
      .catch(() => setErr("Не удалось удалить."))
      .finally(() => setSaving(false));
  }, [saving, centerId, editing, flash, load]);

  /* ── оболочка ── */
  const navStyle: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
    borderBottom: `0.5px solid ${HAIR}`,
  };
  const iconBtn: CSSProperties = { display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  const Shell = ({ children, title, right }: { children: ReactNode; title: string; right?: ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={editing ? () => setEditing(null) : onBack} style={iconBtn}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>{title}</div>
        {right ?? <span style={{ width: 38 }} />}
      </header>
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "14px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>{children}</div>
      </div>
    </div>
  );

  if (!authed) {
    return (
      <Shell title="Расписание">
        <div style={{ ...card, textAlign: "center", padding: "30px 22px", marginTop: 8 }}>
          <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, color: L1 }}>Войдите, чтобы продолжить</div>
          <button type="button" onClick={requireAuth} style={{ marginTop: 16, padding: "12px 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer" }}>Войти</button>
        </div>
      </Shell>
    );
  }
  if (phase === "loading") {
    return (
      <Shell title="Расписание">
        <div style={{ display: "grid", placeItems: "center", padding: "70px 0", color: L3 }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${HAIR}`, borderTopColor: GOLD, animation: "csSpin .8s linear infinite" }} />
        </div>
        <style>{`@keyframes csSpin{to{transform:rotate(360deg)}}`}</style>
      </Shell>
    );
  }
  if (phase === "notfound" || phase === "error" || !data) {
    return (
      <Shell title="Расписание">
        <div style={{ ...card, textAlign: "center", marginTop: 8 }}>
          <p style={{ margin: 0, fontFamily: FT, fontSize: 14.5, color: L2 }}>{phase === "notfound" ? "Центр не найден." : "Не удалось загрузить."}</p>
          {phase === "error" && <button type="button" onClick={load} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 12, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>Повторить</button>}
        </div>
      </Shell>
    );
  }
  if (data.can_manage === false) {
    return (
      <Shell title="Расписание">
        <div style={{ ...card, textAlign: "center", marginTop: 8 }}>
          <p style={{ margin: 0, fontFamily: FT, fontSize: 14.5, color: L2 }}>Нет прав на изменение расписания этого центра.</p>
        </div>
      </Shell>
    );
  }

  /* ── форма ── */
  if (editing) {
    return (
      <Shell title={editing.mode === "new" ? "Новая программа" : "Программа"}>
        <section>
          <div style={eyebrow}>Программа</div>
          <input style={inputStyle} value={fType} onChange={(e) => setFType(e.target.value)} placeholder="Напр. Мангала-арати" maxLength={40} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setFType(q)} style={{ padding: "6px 11px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: FT, fontSize: 12.5, fontWeight: 600, background: fType === q ? GOLD : FILL2, color: fType === q ? "#fff" : L2, WebkitTapHighlightColor: "transparent" }}>{q}</button>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Дни недели</div>
          <div style={{ display: "flex", gap: 6 }}>
            {DAY_ORDER.map((d) => {
              const on = fDays.includes(d);
              return (
                <button key={d} type="button" onClick={() => toggleDay(d)} style={{ flex: 1, minWidth: 0, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: FD, fontSize: "var(--text-footnote)", fontWeight: 700, background: on ? GOLD : FILL2, color: on ? "#fff" : L2, WebkitTapHighlightColor: "transparent" }}>{RU_WD[d]}</button>
              );
            })}
          </div>
          <button type="button" onClick={() => setFDays(allDays ? [] : [1, 2, 3, 4, 5, 6, 0])} style={{ marginTop: 9, background: "none", border: "none", padding: "2px 4px", cursor: "pointer", fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLDT, WebkitTapHighlightColor: "transparent" }}>
            {allDays ? "Снять все" : "Ежедневно"}
          </button>
        </section>

        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Время</div>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontFamily: FT, fontSize: 14.5, color: L1 }}>Начало</span>
              <input type="time" value={fStart} onChange={(e) => setFStart(e.target.value)} style={{ fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 700, color: L1, background: FILL2, border: "none", borderRadius: 10, padding: "8px 12px", WebkitTapHighlightColor: "transparent" }} />
            </div>
            <div style={{ height: 1, background: HAIR, margin: "13px 0" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontFamily: FT, fontSize: 14.5, color: L1 }}>Окончание</span>
              <input type="time" value={fEnd} onChange={(e) => setFEnd(e.target.value)} style={{ fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 700, color: L1, background: FILL2, border: "none", borderRadius: 10, padding: "8px 12px", WebkitTapHighlightColor: "transparent" }} />
            </div>
          </div>
        </section>

        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Заметка</div>
          <input style={inputStyle} value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Напр. в храмовом зале" maxLength={200} />
        </section>

        {err && (
          <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", color: RED, fontFamily: FT, fontSize: 13.5, fontWeight: 600 }}>{err}</div>
        )}

        <button type="button" onClick={save} disabled={saving} style={{ marginTop: 22, width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-callout)", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
          {saving ? "Сохраняю…" : "Сохранить"}
        </button>
        {editing.mode === "edit" && (
          <button type="button" onClick={remove} disabled={saving} style={{ marginTop: 10, width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: "color-mix(in srgb, var(--color-danger) 11%, transparent)", color: RED, fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
            Удалить программу
          </button>
        )}
      </Shell>
    );
  }

  /* ── список ── */
  const programs = data.programs;
  return (
    <Shell title="Расписание" right={<button type="button" aria-label="Добавить" onClick={openNew} style={{ ...iconBtn, color: GOLDT }}><Plus /></button>}>
      <p style={{ margin: "2px 4px 14px", fontFamily: FT, fontSize: "var(--text-footnote)", lineHeight: 1.5, color: L3 }}>
        Программы дня центра «{data.center.name}». Они отображаются на странице центра.
      </p>
      {programs.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "30px 22px" }}>
          <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}><Clock size={26} /></span>
          <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, color: L1 }}>Расписание пусто</div>
          <p style={{ margin: "9px auto 18px", maxWidth: 300, fontFamily: FT, fontSize: 14, lineHeight: 1.5, color: L2 }}>Добавьте мангала-арати, гуру-пуджу, лекцию по «Бхагаватам», воскресный пир и другие программы.</p>
          <button type="button" onClick={openNew} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            <Plus size={18} />Добавить программу
          </button>
        </div>
      ) : (
        <div style={{ background: FILL, borderRadius: 18, overflow: "hidden" }}>
          {programs.map((pr, i) => {
            const time = fmtTime(pr.start_time, pr.end_time);
            const note = pickI18n(pr.notes_i18n);
            return (
              <button key={pr.id} type="button" onClick={() => openEdit(pr)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "13px 14px", background: "none", border: "none", borderBottom: i === programs.length - 1 ? "none" : `0.5px solid ${HAIR}`, cursor: "pointer", textAlign: "left", fontFamily: FT, WebkitTapHighlightColor: "transparent" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FT, fontSize: 15.5, fontWeight: 600, color: L1 }}>{programLabel(pr.type)}</span>
                  <span style={{ display: "block", marginTop: 2, fontFamily: FT, fontSize: 12.5, color: L3 }}>{fmtDays(pr.days_of_week)}{note ? ` · ${note}` : ""}</span>
                </span>
                {time && <span style={{ fontFamily: FD, fontSize: "var(--text-subhead)", fontWeight: 700, color: GOLDT, whiteSpace: "nowrap" }}>{time}</span>}
                <span style={{ color: L3, flexShrink: 0 }}><Chev /></span>
              </button>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

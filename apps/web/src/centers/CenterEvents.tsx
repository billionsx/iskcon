/**
 * CenterEvents — управление событиями центра (фестивали, программы).
 *
 * Для админа центра: список ближайших событий + добавление/правка/удаление
 * (название, описание, дата и время, окончание, трансляция, фото). Эстетика
 * приложения: золото + мягкая заливка, токены темы, инлайн-SVG. Данные — через
 * centersClient (POST/PATCH/DELETE /api/centers/:id/events). Карточка центра
 * показывает ближайшие события.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAuthed, requireAuth } from "./../account/track";
import { centersClient, pickI18n, type CenterCard, type CenterEvent } from "./api";
import EntityPicker from "./EntityPicker";

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
const RU_MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const Back = () => (
  <svg width="11" height="19" viewBox="0 0 11 19" fill="none" aria-hidden><path d="M9 1.5L2 9.5l7 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Plus = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
);
const Chev = () => (
  <svg width="8" height="13" viewBox="0 0 9 15" fill="none" aria-hidden><path d="M1.5 1.5L7 7.5l-5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Cal = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
);

const card: CSSProperties = { padding: 16, borderRadius: 18, background: FILL };
const eyebrow: CSSProperties = { fontFamily: FT, fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: L3, margin: "0 4px 8px" };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", fontFamily: FT, fontSize: 15.5, color: L1, background: FILL2, border: "none", outline: "none", borderRadius: 12, padding: "11px 13px", WebkitTapHighlightColor: "transparent" };
const dtStyle: CSSProperties = { fontFamily: FD, fontSize: 15, fontWeight: 600, color: L1, background: FILL2, border: "none", borderRadius: 10, padding: "9px 12px", WebkitTapHighlightColor: "transparent" };

function toInput(s: string | null): string {
  return s ? s.replace(" ", "T").slice(0, 16) : "";
}
function fmtEventDate(s: string): string {
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return s;
  const time = d.getUTCHours() || d.getUTCMinutes() ? `, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` : "";
  return `${d.getUTCDate()} ${RU_MON[d.getUTCMonth()]} ${d.getUTCFullYear()}${time}`;
}

type Editing = { mode: "new" } | { mode: "edit"; event: CenterEvent } | null;

export default function CenterEvents({ slug, onBack, flash }: { slug: string; onBack: () => void; flash?: (m: string) => void }) {
  const authed = useAuthed();
  const [data, setData] = useState<CenterCard | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "notfound">("loading");
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fStart, setFStart] = useState("");
  const [fEnd, setFEnd] = useState("");
  const [fLive, setFLive] = useState("");
  const [fImage, setFImage] = useState("");
  const [fEntity, setFEntity] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    setPhase("loading");
    centersClient.get(slug)
      .then((d) => { setData(d); setPhase("ready"); })
      .catch((e: { code?: string }) => setPhase(e?.code === "center_not_found" ? "notfound" : "error"));
  }, [slug]);
  useEffect(() => { if (!authed) { setPhase("ready"); return; } load(); }, [authed, load]);

  const openNew = () => { setErr(null); setFTitle(""); setFDesc(""); setFStart(""); setFEnd(""); setFLive(""); setFImage(""); setFEntity(null); setEditing({ mode: "new" }); };
  const openEdit = (e: CenterEvent) => {
    setErr(null);
    setFTitle(pickI18n(e.title_i18n));
    setFDesc(pickI18n(e.description_i18n));
    setFStart(toInput(e.starts_at));
    setFEnd(toInput(e.ends_at));
    setFLive(e.livestream_url || "");
    setFImage(e.images[0] || "");
    setFEntity(e.festival_entity_id ? { id: e.festival_entity_id, name: e.festival_entity_name || e.festival_entity_id } : null);
    setEditing({ mode: "edit", event: e });
  };

  const centerId = data?.center.id;
  const save = useCallback(() => {
    if (saving || !centerId || !editing) return;
    if (fTitle.trim().length < 1) { setErr("Укажите название события."); return; }
    if (!fStart) { setErr("Укажите дату и время."); return; }
    setErr(null); setSaving(true);
    const payload = {
      title_i18n: { ru: fTitle.trim() },
      description_i18n: fDesc.trim() ? { ru: fDesc.trim() } : {},
      starts_at: fStart,
      ends_at: fEnd || null,
      livestream_url: fLive.trim() || null,
      images: fImage.trim() ? [fImage.trim()] : [],
      festival_entity_id: fEntity?.id || null,
    };
    const op = editing.mode === "new" ? centersClient.addEvent(centerId, payload) : centersClient.updateEvent(centerId, editing.event.id, payload);
    op.then(() => { flash?.(editing.mode === "new" ? "Событие добавлено" : "Сохранено"); setEditing(null); load(); })
      .catch((e: { code?: string }) => setErr(e?.code === "bad_event_date" ? "Проверьте дату и время." : "Не удалось сохранить."))
      .finally(() => setSaving(false));
  }, [saving, centerId, editing, fTitle, fDesc, fStart, fEnd, fLive, fImage, fEntity, flash, load]);

  const remove = useCallback(() => {
    if (saving || !centerId || !editing || editing.mode !== "edit") return;
    setSaving(true);
    centersClient.deleteEvent(centerId, editing.event.id)
      .then(() => { flash?.("Удалено"); setEditing(null); load(); })
      .catch(() => setErr("Не удалось удалить."))
      .finally(() => setSaving(false));
  }, [saving, centerId, editing, flash, load]);

  const navStyle: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: `0.5px solid ${HAIR}`,
  };
  const iconBtn: CSSProperties = { display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  const Shell = ({ children, title, right }: { children: ReactNode; title: string; right?: ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={editing ? () => setEditing(null) : onBack} style={iconBtn}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>{title}</div>
        {right ?? <span style={{ width: 38 }} />}
      </header>
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "14px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>{children}</div>
      </div>
    </div>
  );

  if (!authed) {
    return (<Shell title="События"><div style={{ ...card, textAlign: "center", padding: "30px 22px", marginTop: 8 }}><div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, color: L1 }}>Войдите, чтобы продолжить</div><button type="button" onClick={requireAuth} style={{ marginTop: 16, padding: "12px 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Войти</button></div></Shell>);
  }
  if (phase === "loading") {
    return (<Shell title="События"><div style={{ display: "grid", placeItems: "center", padding: "70px 0", color: L3 }}><span style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${HAIR}`, borderTopColor: GOLD, animation: "cevSpin .8s linear infinite" }} /></div><style>{`@keyframes cevSpin{to{transform:rotate(360deg)}}`}</style></Shell>);
  }
  if (phase === "notfound" || phase === "error" || !data) {
    return (<Shell title="События"><div style={{ ...card, textAlign: "center", marginTop: 8 }}><p style={{ margin: 0, fontFamily: FT, fontSize: 14.5, color: L2 }}>{phase === "notfound" ? "Центр не найден." : "Не удалось загрузить."}</p>{phase === "error" && <button type="button" onClick={load} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 12, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>Повторить</button>}</div></Shell>);
  }
  if (data.can_manage === false) {
    return (<Shell title="События"><div style={{ ...card, textAlign: "center", marginTop: 8 }}><p style={{ margin: 0, fontFamily: FT, fontSize: 14.5, color: L2 }}>Нет прав на изменение.</p></div></Shell>);
  }

  if (editing) {
    return (
      <Shell title={editing.mode === "new" ? "Новое событие" : "Событие"}>
        <section>
          <div style={eyebrow}>Название</div>
          <input style={inputStyle} value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Напр. Джанмаштами" maxLength={160} />
        </section>
        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Описание</div>
          <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3} maxLength={1000} placeholder="Кратко о событии…" style={{ ...inputStyle, resize: "vertical", minHeight: 64, lineHeight: 1.5 }} />
        </section>
        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Дата и время</div>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontFamily: FT, fontSize: 14.5, color: L1 }}>Начало</span>
              <input type="datetime-local" value={fStart} onChange={(e) => setFStart(e.target.value)} style={dtStyle} />
            </div>
            <div style={{ height: 1, background: HAIR, margin: "13px 0" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontFamily: FT, fontSize: 14.5, color: L1 }}>Окончание</span>
              <input type="datetime-local" value={fEnd} onChange={(e) => setFEnd(e.target.value)} style={dtStyle} />
            </div>
          </div>
        </section>
        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Трансляция (ссылка)</div>
          <input style={inputStyle} value={fLive} onChange={(e) => setFLive(e.target.value)} placeholder="https://youtube.com/…" maxLength={300} autoCapitalize="off" />
        </section>
        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Фото (ссылка)</div>
          <input style={inputStyle} value={fImage} onChange={(e) => setFImage(e.target.value)} placeholder="https://…" maxLength={300} autoCapitalize="off" />
        </section>
        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Связь с реестром</div>
          <EntityPicker value={fEntity} onChange={setFEntity} placeholder="Найти праздник в реестре…" />
          <p style={{ margin: "9px 4px 0", fontFamily: FT, fontSize: 12.5, lineHeight: 1.5, color: L3 }}>Свяжите с праздником из реестра — со страницы события можно перейти к нему, а на его странице появится этот центр.</p>
        </section>
        {err && <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", color: RED, fontFamily: FT, fontSize: 13.5, fontWeight: 600 }}>{err}</div>}
        <button type="button" onClick={save} disabled={saving} style={{ marginTop: 22, width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>{saving ? "Сохраняю…" : "Сохранить"}</button>
        {editing.mode === "edit" && <button type="button" onClick={remove} disabled={saving} style={{ marginTop: 10, width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: "color-mix(in srgb, var(--color-danger) 11%, transparent)", color: RED, fontFamily: FT, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>Удалить</button>}
      </Shell>
    );
  }

  const events = data.events;
  return (
    <Shell title="События" right={<button type="button" aria-label="Добавить" onClick={openNew} style={{ ...iconBtn, color: GOLDT }}><Plus /></button>}>
      <p style={{ margin: "2px 4px 14px", fontFamily: FT, fontSize: 13, lineHeight: 1.5, color: L3 }}>Ближайшие события центра «{data.center.name}» — фестивали, программы, трансляции.</p>
      {events.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "30px 22px" }}>
          <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}><Cal size={26} /></span>
          <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, color: L1 }}>Событий пока нет</div>
          <p style={{ margin: "9px auto 18px", maxWidth: 300, fontFamily: FT, fontSize: 14, lineHeight: 1.5, color: L2 }}>Добавьте фестивали и программы: Джанмаштами, Гаура-Пурнима, воскресные праздники.</p>
          <button type="button" onClick={openNew} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 15, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Plus size={18} />Добавить событие</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {events.map((ev) => {
            const title = pickI18n(ev.title_i18n) || "Событие";
            return (
              <button key={ev.id} type="button" onClick={() => openEdit(ev)} style={{ display: "flex", width: "100%", alignItems: "flex-start", gap: 13, padding: 14, borderRadius: 18, border: "none", background: FILL, cursor: "pointer", textAlign: "left", fontFamily: FT, WebkitTapHighlightColor: "transparent" }}>
                <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: `color-mix(in srgb, ${GOLD} 13%, transparent)`, color: GOLDT }}><Cal size={20} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FD, fontSize: 15.5, fontWeight: 700, color: L1 }}>{title}</span>
                  <span style={{ display: "block", marginTop: 2, fontFamily: FT, fontSize: 12.5, color: L3 }}>{fmtEventDate(ev.starts_at)}{ev.livestream_url ? " · трансляция" : ""}</span>
                </span>
                <span style={{ color: L3, flexShrink: 0, marginTop: 4 }}><Chev /></span>
              </button>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

/**
 * CenterDeities — управление Божествами центра.
 *
 * Для админа центра: список Божеств + добавление/правка/удаление (имя, время
 * даршана, фото). Эстетика приложения: золото + мягкая заливка, токены темы,
 * инлайн-SVG. Данные — через centersClient (POST/PATCH/DELETE
 * /api/centers/:id/deities). Карточка центра показывает Божеств.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAuthed, requireAuth } from "./../account/track";
import { centersClient, pickI18n, type CenterCard, type CenterDeity } from "./api";
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

const Back = () => (
  <svg width="11" height="19" viewBox="0 0 11 19" fill="none" aria-hidden><path d="M9 1.5L2 9.5l7 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Plus = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
);
const Chev = () => (
  <svg width="8" height="13" viewBox="0 0 9 15" fill="none" aria-hidden><path d="M1.5 1.5L7 7.5l-5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Lotus = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 12c0-3 1.6-6 0-8-1.6 2 0 5 0 8z" /><path d="M12 12c2.1-2.1 5.4-2.4 7.5-1.6-.6 2.6-3.4 4.1-5.6 3.6M12 12c-2.1-2.1-5.4-2.4-7.5-1.6.6 2.6 3.4 4.1 5.6 3.6" /><path d="M5 13c1 3.5 4 5 7 5s6-1.5 7-5" />
  </svg>
);

const card: CSSProperties = { padding: 16, borderRadius: 18, background: FILL };
const eyebrow: CSSProperties = { fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: L3, margin: "0 4px 8px" };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", fontFamily: FT, fontSize: "var(--text-callout)", color: L1, background: FILL2, border: "none", outline: "none", borderRadius: 12, padding: "11px 13px", WebkitTapHighlightColor: "transparent" };

type Editing = { mode: "new" } | { mode: "edit"; deity: CenterDeity } | null;

export default function CenterDeities({ slug, onBack, flash }: { slug: string; onBack: () => void; flash?: (m: string) => void }) {
  const authed = useAuthed();
  const [data, setData] = useState<CenterCard | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "notfound">("loading");
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fName, setFName] = useState("");
  const [fDarshan, setFDarshan] = useState("");
  const [fPhoto, setFPhoto] = useState("");
  const [fEntity, setFEntity] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    setPhase("loading");
    centersClient.get(slug)
      .then((d) => { setData(d); setPhase("ready"); })
      .catch((e: { code?: string }) => setPhase(e?.code === "center_not_found" ? "notfound" : "error"));
  }, [slug]);

  useEffect(() => { if (!authed) { setPhase("ready"); return; } load(); }, [authed, load]);

  const openNew = () => { setErr(null); setFName(""); setFDarshan(""); setFPhoto(""); setFEntity(null); setEditing({ mode: "new" }); };
  const openEdit = (d: CenterDeity) => {
    setErr(null);
    setFName(pickI18n(d.local_name_i18n));
    setFDarshan(pickI18n(d.darshan_times));
    setFPhoto(d.photos[0] || "");
    setFEntity(d.deity_entity_id ? { id: d.deity_entity_id, name: d.deity_entity_name || d.deity_entity_id } : null);
    setEditing({ mode: "edit", deity: d });
  };

  const centerId = data?.center.id;
  const save = useCallback(() => {
    if (saving || !centerId || !editing) return;
    if (fName.trim().length < 1) { setErr("Укажите имя Божества."); return; }
    setErr(null); setSaving(true);
    const payload = {
      local_name_i18n: { ru: fName.trim() },
      darshan_times: fDarshan.trim() ? { ru: fDarshan.trim() } : {},
      photos: fPhoto.trim() ? [fPhoto.trim()] : [],
      deity_entity_id: fEntity?.id || null,
    };
    const op = editing.mode === "new" ? centersClient.addDeity(centerId, payload) : centersClient.updateDeity(centerId, editing.deity.id, payload);
    op.then(() => { flash?.(editing.mode === "new" ? "Божество добавлено" : "Сохранено"); setEditing(null); load(); })
      .catch(() => setErr("Не удалось сохранить."))
      .finally(() => setSaving(false));
  }, [saving, centerId, editing, fName, fDarshan, fPhoto, fEntity, flash, load]);

  const remove = useCallback(() => {
    if (saving || !centerId || !editing || editing.mode !== "edit") return;
    setSaving(true);
    centersClient.deleteDeity(centerId, editing.deity.id)
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
      <Shell title="Божества">
        <div style={{ ...card, textAlign: "center", padding: "30px 22px", marginTop: 8 }}>
          <div style={{ fontFamily: FD, fontSize: "var(--text-title3)", fontWeight: 800, color: L1 }}>Войдите, чтобы продолжить</div>
          <button type="button" onClick={requireAuth} style={{ marginTop: 16, padding: "12px 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer" }}>Войти</button>
        </div>
      </Shell>
    );
  }
  if (phase === "loading") {
    return (<Shell title="Божества"><div style={{ display: "grid", placeItems: "center", padding: "70px 0", color: L3 }}><span style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${HAIR}`, borderTopColor: GOLD, animation: "cdSpin .8s linear infinite" }} /></div><style>{`@keyframes cdSpin{to{transform:rotate(360deg)}}`}</style></Shell>);
  }
  if (phase === "notfound" || phase === "error" || !data) {
    return (<Shell title="Божества"><div style={{ ...card, textAlign: "center", marginTop: 8 }}><p style={{ margin: 0, fontFamily: FT, fontSize: "var(--text-subhead)", color: L2 }}>{phase === "notfound" ? "Центр не найден." : "Не удалось загрузить."}</p>{phase === "error" && <button type="button" onClick={load} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 12, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer" }}>Повторить</button>}</div></Shell>);
  }
  if (data.can_manage === false) {
    return (<Shell title="Божества"><div style={{ ...card, textAlign: "center", marginTop: 8 }}><p style={{ margin: 0, fontFamily: FT, fontSize: "var(--text-subhead)", color: L2 }}>Нет прав на изменение.</p></div></Shell>);
  }

  if (editing) {
    return (
      <Shell title={editing.mode === "new" ? "Новое Божество" : "Божество"}>
        <section>
          <div style={eyebrow}>Имя Божества</div>
          <input style={inputStyle} value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Напр. Шри Шри Радха-Мадхава" maxLength={120} />
        </section>
        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Время даршана</div>
          <input style={inputStyle} value={fDarshan} onChange={(e) => setFDarshan(e.target.value)} placeholder="Напр. 4:30, 7:15, 12:30, 18:00" maxLength={200} />
        </section>
        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Фото (ссылка)</div>
          <input style={inputStyle} value={fPhoto} onChange={(e) => setFPhoto(e.target.value)} placeholder="https://…" maxLength={300} autoCapitalize="off" />
          {fPhoto.trim() && <div style={{ marginTop: 10, width: 90, height: 90, borderRadius: 14, background: `center/cover no-repeat url("${fPhoto.trim()}")` }} />}
        </section>
        <section style={{ marginTop: 20 }}>
          <div style={eyebrow}>Связь с реестром</div>
          <EntityPicker value={fEntity} onChange={setFEntity} placeholder="Найти Божество в реестре…" />
          <p style={{ margin: "9px 4px 0", fontFamily: FT, fontSize: "var(--text-footnote)", lineHeight: 1.5, color: L3 }}>Свяжите с Божеством из общего реестра — со страницы центра можно будет перейти к Нему, а на Его странице появится этот центр.</p>
        </section>
        {err && <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", color: RED, fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600 }}>{err}</div>}
        <button type="button" onClick={save} disabled={saving} style={{ marginTop: 22, width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-callout)", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>{saving ? "Сохраняю…" : "Сохранить"}</button>
        {editing.mode === "edit" && <button type="button" onClick={remove} disabled={saving} style={{ marginTop: 10, width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: "color-mix(in srgb, var(--color-danger) 11%, transparent)", color: RED, fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>Удалить</button>}
      </Shell>
    );
  }

  const deities = data.deities;
  return (
    <Shell title="Божества" right={<button type="button" aria-label="Добавить" onClick={openNew} style={{ ...iconBtn, color: GOLDT }}><Plus /></button>}>
      <p style={{ margin: "2px 4px 14px", fontFamily: FT, fontSize: "var(--text-footnote)", lineHeight: 1.5, color: L3 }}>Божества центра «{data.center.name}» с временем даршана — отображаются на странице центра.</p>
      {deities.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "30px 22px" }}>
          <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}><Lotus size={26} /></span>
          <div style={{ fontFamily: FD, fontSize: "var(--text-title3)", fontWeight: 800, color: L1 }}>Божества не добавлены</div>
          <p style={{ margin: "9px auto 18px", maxWidth: 300, fontFamily: FT, fontSize: "var(--text-subhead)", lineHeight: 1.5, color: L2 }}>Добавьте Божеств храма и время даршана.</p>
          <button type="button" onClick={openNew} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Plus size={18} />Добавить Божество</button>
        </div>
      ) : (
        <div style={{ background: FILL, borderRadius: 18, overflow: "hidden" }}>
          {deities.map((d, i) => {
            const name = pickI18n(d.local_name_i18n) || "Божество";
            const times = pickI18n(d.darshan_times);
            return (
              <button key={d.id} type="button" onClick={() => openEdit(d)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "12px 14px", background: "none", border: "none", borderBottom: i === deities.length - 1 ? "none" : `0.5px solid ${HAIR}`, cursor: "pointer", textAlign: "left", fontFamily: FT, WebkitTapHighlightColor: "transparent" }}>
                <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, display: "grid", placeItems: "center", background: d.photos[0] ? `center/cover no-repeat url("${d.photos[0]}")` : `color-mix(in srgb, ${GOLD} 13%, transparent)`, color: GOLDT }}>{!d.photos[0] && <Lotus size={22} />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 700, color: L1 }}>{name}</span>
                  {times && <span style={{ display: "block", marginTop: 2, fontFamily: FT, fontSize: "var(--text-footnote)", color: L3 }}>Даршан: {times}</span>}
                </span>
                <span style={{ color: L3, flexShrink: 0 }}><Chev /></span>
              </button>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

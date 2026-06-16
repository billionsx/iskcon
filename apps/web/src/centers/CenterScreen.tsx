/**
 * CenterScreen — публичная карточка центра ИСККОН (Ятра).
 *
 * Эстетика приложения (iOS-26 · Liquid Glass): золото + мягкая заливка без
 * обводок, токены темы, только инлайн-SVG. Карточка отдаётся воркером
 * (apps/web/src/centers/server.ts): опубликованный центр виден всем, черновик/
 * review — только админу центра (превью). Если статус ≠ live, значит зритель —
 * админ, поэтому показываем баннер превью и действия управления.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  centersClient,
  CENTER_TYPE_LABEL,
  pickI18n,
  type CenterCard,
  type CenterProgram,
} from "./api";
import { CenterHeroCard } from "./CenterHeroCard";
import { QrSheet } from "../QrSheet";
import { requestNote } from "../notes";
import { NotesAtSource } from "../NotesAtSource";

/* ───────────────────── палитра / токены ───────────────────── */
const GOLD = "#D2AA1B";
const GOLDT = "#9c7c15";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL = "var(--color-glass-thin)";
const FILL2 = "var(--color-glass-regular)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";

const RU_WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const RU_MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/* ───────────────────── глифы ───────────────────── */
const Back = () => (
  <svg width="11" height="19" viewBox="0 0 11 19" fill="none" aria-hidden>
    <path d="M9 1.5L2 9.5l7 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Temple = ({ size = 26, color = GOLD }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2.5l5 3.2H7L12 2.5z" /><path d="M7 5.7v3M17 5.7v3M5 21v-7.5M19 21v-7.5M9 21v-5a3 3 0 0 1 6 0v5" /><path d="M3.5 21h17M4.5 13.5h15" />
  </svg>
);
const Share = ({ size = 19 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v13M12 3L8 7M12 3l4 4" /><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
  </svg>
);
const Pencil = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20h4L18.5 9.5a2 2 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" />
  </svg>
);
const Phone = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z" />
  </svg>
);
const Chat = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-5.2A8 8 0 1 1 21 11.5z" />
  </svg>
);
const Globe = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </svg>
);
const Pin = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.4" />
  </svg>
);
const ClockG = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5l3 2" />
  </svg>
);
const LotusG = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 12c0-3 1.6-6 0-8-1.6 2 0 5 0 8z" /><path d="M12 12c2.1-2.1 5.4-2.4 7.5-1.6-.6 2.6-3.4 4.1-5.6 3.6M12 12c-2.1-2.1-5.4-2.4-7.5-1.6.6 2.6 3.4 4.1 5.6 3.6" /><path d="M5 13c1 3.5 4 5 7 5s6-1.5 7-5" />
  </svg>
);
const CalG = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);
const ImageG = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5L5 19" />
  </svg>
);

/* ───────────────────── формат ───────────────────── */
function fmtDays(days: number[]): string {
  if (!days || days.length === 0) return "";
  if (days.length >= 7) return "Ежедневно";
  const ord = [1, 2, 3, 4, 5, 6, 0];
  return ord.filter((d) => days.includes(d)).map((d) => RU_WD[d]).join(", ");
}
function fmtTimeRange(a: string | null, b: string | null): string {
  const t = (s: string | null) => (s ? s.slice(0, 5) : "");
  if (a && b) return `${t(a)}–${t(b)}`;
  return t(a) || t(b) || "";
}
function fmtEventDate(s: string): string {
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return s;
  const day = d.getUTCDate();
  const mon = RU_MON[d.getUTCMonth()];
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  const time = hh || mm ? `, ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` : "";
  return `${day} ${mon}${time}`;
}
const PROGRAM_LABEL: Record<string, string> = {
  mangala_arati: "Мангала-арати",
  guru_puja: "Гуру-пуджа",
  darshan_arati: "Даршан-арати",
  bhagavatam: "Шримад-Бхагаватам",
  sandhya_arati: "Сандхья-арати",
  kirtan: "Киртан",
  harinama: "Харинама",
  feast: "Воскресный пир",
  lecture: "Лекция",
};
const programLabel = (t: string) => PROGRAM_LABEL[t] || t.replace(/_/g, " ");

/* ───────────────────── переиспользуемые ───────────────────── */
const eyebrow: CSSProperties = {
  fontFamily: FT, fontSize: 11, fontWeight: 700, letterSpacing: "0.6px",
  textTransform: "uppercase", color: L3, margin: "0 2px 9px",
};
const card: CSSProperties = { padding: 16, borderRadius: 18, background: FILL };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={eyebrow}>{title}</div>
      {children}
    </section>
  );
}

function ActionTile({ icon, label, href, onClick }: { icon: ReactNode; label: string; href?: string; onClick?: () => void }) {
  const inner = (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span style={{ display: "grid", placeItems: "center", width: 46, height: 46, borderRadius: 14, background: FILL2, color: GOLDT }}>{icon}</span>
      <span style={{ fontFamily: FT, fontSize: 11.5, fontWeight: 600, color: L2 }}>{label}</span>
    </span>
  );
  const style: CSSProperties = { flex: 1, minWidth: 0, textDecoration: "none", background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{inner}</a>;
  return <button type="button" onClick={onClick} style={style}>{inner}</button>;
}

function ProgramRow({ p, last }: { p: CenterProgram; last: boolean }) {
  const days = fmtDays(p.days_of_week);
  const time = fmtTimeRange(p.start_time, p.end_time);
  const note = pickI18n(p.notes_i18n);
  return (
    <div style={{ padding: "12px 0", borderBottom: last ? "none" : `0.5px solid ${HAIR}` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontFamily: FT, fontSize: 15, fontWeight: 600, color: L1 }}>{programLabel(p.type)}</span>
        {time && <span style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: GOLDT, whiteSpace: "nowrap" }}>{time}</span>}
      </div>
      {(days || note) && (
        <div style={{ marginTop: 3, fontFamily: FT, fontSize: 12.5, color: L3 }}>
          {days}{days && note ? " · " : ""}{note}
        </div>
      )}
    </div>
  );
}

/* ───────────────────── экран ───────────────────── */
export default function CenterScreen({
  slug,
  onBack,
  onOpenPath,
  flash,
}: {
  slug: string;
  onBack: () => void;
  onOpenPath: (p: string) => void;
  flash?: (m: string) => void;
}) {
  const [data, setData] = useState<CenterCard | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState(false);

  const load = useCallback(() => {
    setPhase("loading");
    centersClient
      .get(slug)
      .then((d) => {
        setData(d);
        setPhase("ready");
      })
      .catch((e: { code?: string } | unknown) => {
        const code = (e as { code?: string })?.code;
        setPhase(code === "center_not_found" || code === "not_found" ? "notfound" : "error");
      });
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const c = data?.center;
  // Если статус не live, а карточка пришла — значит зритель админ этого центра.
  const isManager = !!c && c.status !== "live";
  // Точный флаг управления с сервера (админ/редактор или глоб. редактор); запасной —
  // эвристика по статусу (на случай старого ответа без поля).
  const canManage = !!data?.can_manage || isManager;
  // Право публикации/возврата — у глобального редактора (модератора ИСККОН).
  const canPublish = !!data?.can_publish;

  const submitReview = useCallback(() => {
    if (!c || busy) return;
    setBusy(true);
    centersClient
      .update(c.id, { status: "review" })
      .then(() => {
        flash?.("Заявка отправлена на проверку ИСККОН");
        load();
      })
      .catch(() => flash?.("Не удалось отправить заявку"))
      .finally(() => setBusy(false));
  }, [c, busy, flash, load]);

  // Модерация (глобальный редактор): публикация / возврат / снятие.
  const moderate = useCallback(
    (next: "live" | "draft", okMsg: string) => {
      if (!c || busy) return;
      setBusy(true);
      centersClient
        .update(c.id, { status: next })
        .then(() => {
          flash?.(okMsg);
          load();
        })
        .catch(() => flash?.("Не удалось обновить статус"))
        .finally(() => setBusy(false));
    },
    [c, busy, flash, load],
  );

  const onShare = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/center/${slug}`;
    const title = c?.name || "Центр ИСККОН";
    const nav = window.navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
    if (nav.share) {
      void nav.share({ title, url }).catch(() => undefined);
      return;
    }
    try {
      void window.navigator.clipboard?.writeText(url);
      flash?.("Ссылка скопирована");
    } catch {
      flash?.(url);
    }
  }, [slug, c, flash]);

  /* ── оболочка ── */
  const navStyle: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
    borderBottom: `0.5px solid ${HAIR}`,
  };
  const iconBtn: CSSProperties = {
    display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none",
    color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent",
  };
  const Shell = ({ title, children }: { title: string; children: ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={onBack} style={iconBtn}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: L1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px" }}>{title}</div>
        {data ? (
          <button type="button" aria-label="Поделиться" onClick={onShare} style={iconBtn}><Share /></button>
        ) : <span style={{ width: 38 }} />}
      </header>
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 calc(40px + env(safe-area-inset-bottom,0px))" }}>{children}</div>
      </div>
    </div>
  );

  if (phase === "loading") {
    return (
      <Shell title="">
        <div style={{ display: "grid", placeItems: "center", padding: "80px 0", color: L3 }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${HAIR}`, borderTopColor: GOLD, animation: "cenSpin .8s linear infinite" }} />
        </div>
        <style>{`@keyframes cenSpin{to{transform:rotate(360deg)}}`}</style>
      </Shell>
    );
  }
  if (phase === "notfound" || phase === "error" || !c) {
    return (
      <Shell title="">
        <div style={{ ...card, textAlign: "center", margin: "16px", padding: "30px 22px" }}>
          <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}><Temple size={26} /></span>
          <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, color: L1 }}>
            {phase === "notfound" ? "Центр не найден" : "Не удалось загрузить"}
          </div>
          <p style={{ margin: "9px auto 0", maxWidth: 300, fontFamily: FT, fontSize: 14, lineHeight: 1.5, color: L2 }}>
            {phase === "notfound"
              ? "Возможно, центр ещё не опубликован или ссылка устарела."
              : "Проверьте соединение и попробуйте снова."}
          </p>
          {phase === "error" && (
            <button type="button" onClick={load} style={{ marginTop: 16, padding: "10px 22px", borderRadius: 12, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
              Повторить
            </button>
          )}
        </div>
      </Shell>
    );
  }

  const place = [c.city, c.country].filter(Boolean).join(", ");
  const mapsHref = c.lat != null && c.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`
    : c.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`
      : null;
  const waHref = c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/[^0-9]/g, "")}` : null;
  const site = c.website ? (c.website.startsWith("http") ? c.website : `https://${c.website}`) : null;
  const hasActions = !!(c.phone || waHref || site || mapsHref);

  const onMenu = (id: string) => {
    if (id === "share") onShare();
    else if (id === "qr") setQr(true);
    else if (id === "route" && mapsHref) { try { window.open(mapsHref, "_blank", "noopener"); } catch { /* noop */ } }
    else if (id === "note") requestNote({ kind: "centre", ref: c.id, title: c.name, subtitle: place || CENTER_TYPE_LABEL[c.type], href: `/center/${slug}` });
    else if (id === "edit") onOpenPath(`/center/${slug}/edit`);
    else if (id === "schedule") onOpenPath(`/center/${slug}/schedule`);
    else if (id === "report") flash?.("Спасибо! Передадим команде ИСККОН.");
  };

  return (
    <Shell title={c.name}>
      {/* ─── герой (ПКП) ─── */}
      <div style={{ padding: "16px 16px 0" }}>
        <CenterHeroCard center={c} onMenuSelect={onMenu} canManage={canManage} flash={flash} />
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={{ marginTop: 16 }}><NotesAtSource kind="centre" refId={c.id} /></div>
        {/* ─── управление (админ/редактор) ─── */}
        {canManage && (
          <div style={{ marginTop: 16, padding: 15, borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 9%, var(--color-glass-thin))` }}>
            <div style={{ fontFamily: FT, fontSize: 13.5, fontWeight: 700, color: GOLDT }}>
              {canPublish && c.status !== "live"
                ? c.status === "review" ? "Заявка на модерации" : "Черновик центра"
                : c.status === "review" ? "Заявка на проверке ИСККОН" : c.status === "draft" ? "Это превью" : "Вы управляете центром"}
            </div>
            <p style={{ margin: "5px 0 0", fontFamily: FT, fontSize: 13, lineHeight: 1.5, color: L2 }}>
              {canPublish && c.status !== "live"
                ? c.status === "review"
                  ? "Проверьте профиль и расписание, затем опубликуйте либо верните на доработку."
                  : "Центр ещё не отправлен на проверку. Вы можете опубликовать его сразу."
                : c.status === "review"
                  ? "Центр виден только вам, пока ИСККОН не подтвердит публикацию."
                  : c.status === "draft"
                    ? "Центр виден только вам. Заполните профиль и расписание, затем отправьте на проверку."
                    : "Центр опубликован. Изменения видны всем сразу."}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              {[
                { icon: <Pencil size={16} />, label: "Профиль", to: `/center/${slug}/edit` },
                { icon: <ImageG size={16} />, label: "Фото", to: `/center/${slug}/photos` },
                { icon: <ClockG size={16} />, label: "Расписание", to: `/center/${slug}/schedule` },
                { icon: <LotusG size={16} />, label: "Божества", to: `/center/${slug}/deities` },
                { icon: <CalG size={16} />, label: "События", to: `/center/${slug}/events` },
              ].map((m) => (
                <button key={m.label} type="button" onClick={() => onOpenPath(m.to)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 12, border: "none", background: FILL2, color: L1, fontFamily: FT, fontSize: 14, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  {m.icon}{m.label}
                </button>
              ))}
            </div>
            {canPublish ? (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {c.status !== "live" ? (
                  <>
                    <button type="button" onClick={() => moderate("live", "Центр опубликован")} disabled={busy} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>Опубликовать</button>
                    {c.status === "review" && (
                      <button type="button" onClick={() => moderate("draft", "Возвращено на доработку")} disabled={busy} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: FILL2, color: L1, fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>Вернуть</button>
                    )}
                  </>
                ) : (
                  <button type="button" onClick={() => moderate("draft", "Снято с публикации")} disabled={busy} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: FILL2, color: L1, fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>Снять с публикации</button>
                )}
              </div>
            ) : c.status === "draft" ? (
              <button type="button" onClick={submitReview} disabled={busy} style={{ marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
                Отправить на проверку
              </button>
            ) : null}
          </div>
        )}

        {/* ─── действия ─── */}
        {hasActions && (
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {c.phone && <ActionTile icon={<Phone />} label="Позвонить" href={`tel:${c.phone}`} />}
            {waHref && <ActionTile icon={<Chat />} label="WhatsApp" href={waHref} />}
            {site && <ActionTile icon={<Globe />} label="Сайт" href={site} />}
            {mapsHref && <ActionTile icon={<Pin />} label="Маршрут" href={mapsHref} />}
          </div>
        )}

        {/* ─── адрес / языки ─── */}
        {(c.address || c.languages.length > 0) && (
          <Section title="О центре">
            <div style={card}>
              {c.address && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: GOLDT, marginTop: 1 }}><Pin /></span>
                  <span style={{ fontFamily: FT, fontSize: 14.5, lineHeight: 1.5, color: L1 }}>{c.address}</span>
                </div>
              )}
              {c.languages.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: c.address ? 13 : 0 }}>
                  {c.languages.map((l) => (
                    <span key={l} style={{ fontFamily: FT, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: FILL2, color: L2, textTransform: "uppercase", letterSpacing: "0.3px" }}>{l}</span>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ─── расписание ─── */}
        {data.programs.length > 0 ? (
          <Section title="Расписание">
            <div style={card}>
              {data.programs.map((p, i) => (
                <ProgramRow key={p.id} p={p} last={i === data.programs.length - 1} />
              ))}
            </div>
          </Section>
        ) : canManage ? (
          <Section title="Расписание">
            <div style={{ ...card, textAlign: "center" }}>
              <div style={{ fontFamily: FT, fontSize: 13.5, color: L3 }}>Расписание программ пока не заполнено.</div>
              <button type="button" onClick={() => onOpenPath(`/center/${slug}/schedule`)} style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 11, border: "none", background: FILL2, color: GOLDT, fontFamily: FT, fontSize: 13.5, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                <ClockG size={15} />Заполнить расписание
              </button>
            </div>
          </Section>
        ) : null}

        {/* ─── божества ─── */}
        {data.deities.length > 0 && (
          <Section title="Божества">
            <div style={card}>
              {data.deities.map((d, i) => {
                const name = pickI18n(d.local_name_i18n) || d.canonical_name || "Божества";
                const times = pickI18n(d.darshan_times) || Object.values(d.darshan_times || {}).join(" · ");
                return (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i === data.deities.length - 1 ? "none" : `0.5px solid ${HAIR}` }}>
                    {d.photos[0] && <span style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: `center/cover no-repeat url("${d.photos[0]}")` }} />}
                    <div style={{ minWidth: 0 }}>
                      {d.deity_entity_id ? (
                        <button type="button" onClick={() => onOpenPath(`/entity/${d.deity_entity_id}`)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: FD, fontSize: 15.5, fontWeight: 700, color: L1, textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
                          {name}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
                        </button>
                      ) : (
                        <div style={{ fontFamily: FD, fontSize: 15.5, fontWeight: 700, color: L1 }}>{name}</div>
                      )}
                      {times && <div style={{ fontFamily: FT, fontSize: 12.5, color: L3, marginTop: 2 }}>Даршан: {times}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ─── события ─── */}
        {data.events.length > 0 && (
          <Section title="Ближайшие события">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.events.map((ev) => (
                <div key={ev.id} style={{ ...card, display: "flex", gap: 13, alignItems: "flex-start" }}>
                  <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: `color-mix(in srgb, ${GOLD} 13%, transparent)`, color: GOLDT, fontFamily: FD, fontWeight: 800, fontSize: 12, lineHeight: 1, textAlign: "center" }}>
                    {fmtEventDate(ev.starts_at).split(" ").slice(0, 2).join(" ")}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {ev.festival_entity_id ? (
                      <button type="button" onClick={() => onOpenPath(`/entity/${ev.festival_entity_id}`)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: FD, fontSize: 15.5, fontWeight: 700, color: L1, textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
                        {pickI18n(ev.title_i18n)}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
                      </button>
                    ) : (
                      <div style={{ fontFamily: FD, fontSize: 15.5, fontWeight: 700, color: L1 }}>{pickI18n(ev.title_i18n)}</div>
                    )}
                    {pickI18n(ev.description_i18n) && (
                      <p style={{ margin: "3px 0 0", fontFamily: FT, fontSize: 13, lineHeight: 1.45, color: L2 }}>{pickI18n(ev.description_i18n)}</p>
                    )}
                    {ev.livestream_url && (
                      <a href={ev.livestream_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontFamily: FT, fontSize: 13, fontWeight: 700, color: GOLDT, textDecoration: "none" }}>
                        Трансляция →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ─── поделиться ─── */}
        <button type="button" onClick={onShare} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24, padding: "13px 0", borderRadius: 14, border: "none", background: FILL, color: L1, fontFamily: FT, fontSize: 15, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <Share size={17} />Поделиться центром
        </button>
        <p style={{ textAlign: "center", fontFamily: FT, fontSize: 12, color: L3, margin: "18px 0 0" }}>gaurangers.com · ИСККОН</p>
      </div>
      {qr && typeof window !== "undefined" && (
        <QrSheet
          url={`${window.location.origin}/center/${slug}`}
          data={{ kind: "card", title: c.name, subtitle: place || CENTER_TYPE_LABEL[c.type] }}
          onClose={() => setQr(false)}
        />
      )}
    </Shell>
  );
}

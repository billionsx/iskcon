/**
 * MyCentersScreen — «Мои центры» в личном кабинете (служение/севa).
 *
 * Список центров, которыми управляет вошедший преданный (GET /api/me/centers).
 * Эстетика приложения: золото + мягкая заливка, токены темы, инлайн-SVG. Гостю
 * предлагается войти. Тап по центру открывает карточку (для черновика — превью с
 * правкой); «+» создаёт новый центр.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAuthed, requireAuth } from "./../account/track";
import { centersClient, CENTER_TYPE_LABEL, STATUS_LABEL, type MyCenterItem, type CenterStatus } from "./api";

import { SITE_HOST } from "../routes";
/* ───────────────────── палитра ───────────────────── */
const GOLD = "var(--color-gold)";
const GOLDT = "#9c7c15";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL = "var(--color-glass-thin)";
const FILL2 = "var(--color-glass-regular)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";

const Back = () => (
  <svg width="11" height="19" viewBox="0 0 11 19" fill="none" aria-hidden>
    <path d="M9 1.5L2 9.5l7 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Plus = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const Temple = ({ size = 26, color = GOLD }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2.5l5 3.2H7L12 2.5z" /><path d="M7 5.7v3M17 5.7v3M5 21v-7.5M19 21v-7.5M9 21v-5a3 3 0 0 1 6 0v5" /><path d="M3.5 21h17M4.5 13.5h15" />
  </svg>
);
const Chev = () => (
  <svg width="8" height="13" viewBox="0 0 9 15" fill="none" aria-hidden><path d="M1.5 1.5L7 7.5l-5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Shield = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z" /><path d="M9 12l2 2 4-4" />
  </svg>
);

const STATUS_TONE: Record<CenterStatus, { bg: string; fg: string }> = {
  draft: { bg: "color-mix(in srgb, var(--color-label) 10%, transparent)", fg: L2 },
  review: { bg: "color-mix(in srgb, #ff9f0a 18%, transparent)", fg: "#9a6200" },
  live: { bg: "color-mix(in srgb, #34C759 20%, transparent)", fg: "#1c7d3e" },
};

const card: CSSProperties = { padding: 16, borderRadius: 18, background: FILL };

export default function MyCentersScreen({
  onBack,
  onOpenPath,
}: {
  onBack: () => void;
  onOpenPath: (p: string) => void;
  flash?: (m: string) => void;
}) {
  const authed = useAuthed();
  const [items, setItems] = useState<MyCenterItem[] | null>(null);
  const [ge, setGe] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    setPhase("loading");
    centersClient
      .mine()
      .then((d) => {
        setItems(d.items);
        setGe(!!d.is_global_editor);
        setReviewCount(d.review_count ?? 0);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }, []);

  useEffect(() => {
    if (!authed) {
      setPhase("ready");
      return;
    }
    load();
  }, [authed, load]);

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
  const Shell = ({ children, showAdd }: { children: ReactNode; showAdd?: boolean }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={onBack} style={iconBtn}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>Мои центры</div>
        {showAdd ? (
          <button type="button" aria-label="Добавить центр" onClick={() => onOpenPath("/my/centers/new")} style={{ ...iconBtn, color: GOLDT }}><Plus /></button>
        ) : <span style={{ width: 38 }} />}
      </header>
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: "var(--sheet-max)", margin: "0 auto", padding: "14px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>{children}</div>
      </div>
    </div>
  );

  /* ── гость ── */
  if (!authed) {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center", padding: "30px 22px", marginTop: 8 }}>
          <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}><Temple size={26} /></span>
          <div style={{ fontFamily: FD, fontSize: "var(--text-title2)", fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>Мои центры</div>
          <p style={{ margin: "9px auto 0", maxWidth: 320, fontFamily: FT, fontSize: "var(--text-subhead)", lineHeight: 1.5, color: L2 }}>
            Войдите, чтобы добавить храм, нама-хатту или проповеднический центр и вести его страницу на {SITE_HOST}.
          </p>
          <button type="button" onClick={requireAuth} style={{ marginTop: 18, width: "100%", padding: "13px 0", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-callout)", fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            Войти
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "loading") {
    return (
      <Shell>
        <div style={{ display: "grid", placeItems: "center", padding: "70px 0", color: L3 }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${HAIR}`, borderTopColor: GOLD, animation: "mcSpin .8s linear infinite" }} />
        </div>
        <style>{`@keyframes mcSpin{to{transform:rotate(360deg)}}`}</style>
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center", marginTop: 8 }}>
          <p style={{ margin: 0, fontFamily: FT, fontSize: "var(--text-subhead)", color: L2 }}>Не удалось загрузить список.</p>
          <button type="button" onClick={load} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 12, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer" }}>
            Повторить
          </button>
        </div>
      </Shell>
    );
  }

  const list = items ?? [];
  const modEntry = ge ? (
    <button
      type="button"
      onClick={() => onOpenPath("/centers/review")}
      style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: 14, borderRadius: 18, border: "none", background: `color-mix(in srgb, ${GOLD} 12%, var(--color-glass-thin))`, cursor: "pointer", textAlign: "left", fontFamily: FT, marginBottom: 12, WebkitTapHighlightColor: "transparent" }}
    >
      <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, flexShrink: 0, borderRadius: 13, background: `color-mix(in srgb, ${GOLD} 20%, transparent)`, color: GOLDT }}><Shield size={22} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 800, letterSpacing: "-0.01em", color: L1 }}>Модерация центров</span>
        <span style={{ display: "block", marginTop: 2, fontFamily: FT, fontSize: "var(--text-footnote)", color: L3 }}>{reviewCount > 0 ? `${reviewCount} на проверке` : "Очередь пуста"}</span>
      </span>
      {reviewCount > 0 && (
        <span style={{ display: "grid", placeItems: "center", minWidth: 22, height: 22, padding: "0 6px", borderRadius: 999, background: GOLD, color: "#fff", fontFamily: FD, fontSize: "var(--text-caption)", fontWeight: 800 }}>{reviewCount}</span>
      )}
      <span style={{ color: L3, flexShrink: 0 }}><Chev /></span>
    </button>
  ) : null;

  return (
    <Shell showAdd={list.length > 0}>
      {modEntry}
      {list.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "30px 22px", marginTop: modEntry ? 0 : 8 }}>
          <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}><Temple size={26} /></span>
          <div style={{ fontFamily: FD, fontSize: "var(--text-title3)", fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>Здесь будут ваши центры</div>
          <p style={{ margin: "9px auto 18px", maxWidth: 300, fontFamily: FT, fontSize: "var(--text-subhead)", lineHeight: 1.5, color: L2 }}>
            Добавьте храм, нама-хатту, ферму или ресторан. После проверки ИСККОН центр появится в общем каталоге.
          </p>
          <button type="button" onClick={() => onOpenPath("/my/centers/new")} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            <Plus size={18} />Добавить центр
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((it) => {
            const tone = STATUS_TONE[it.status];
            const place = [it.city, it.country].filter(Boolean).join(", ");
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onOpenPath(`/iskcon/centers/${it.slug}`)}
                style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: 14, borderRadius: 18, border: "none", background: FILL, cursor: "pointer", textAlign: "left", fontFamily: FT, WebkitTapHighlightColor: "transparent" }}
              >
                <span style={{ display: "grid", placeItems: "center", width: 50, height: 50, flexShrink: 0, borderRadius: 14, overflow: "hidden", background: it.photos[0] ? `center/cover no-repeat url("${it.photos[0]}")` : `color-mix(in srgb, ${GOLD} 13%, transparent)`, color: GOLDT }}>
                  {!it.photos[0] && <Temple size={24} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 700, color: L1, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                  <span style={{ display: "block", marginTop: 2, fontFamily: FT, fontSize: "var(--text-footnote)", color: L3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {CENTER_TYPE_LABEL[it.type]}{place ? ` · ${place}` : ""}
                  </span>
                  <span style={{ display: "inline-block", marginTop: 7, fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: tone.bg, color: tone.fg }}>
                    {STATUS_LABEL[it.status]}
                  </span>
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

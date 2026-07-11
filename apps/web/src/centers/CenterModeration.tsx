/**
 * CenterModeration — очередь модерации центров (глобальный редактор ИСККОН).
 *
 * Показывает центры со статусом «review» (отправлены на проверку). Тап открывает
 * карточку-превью центра, где глобальный редактор публикует (live) или возвращает
 * на доработку (draft). Доступ — только глобальному редактору; иначе мягкое «нет
 * доступа». Эстетика приложения: золото + мягкая заливка, токены темы.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAuthed, requireAuth } from "./../account/track";
import { centersClient, CENTER_TYPE_LABEL, type MyCenterItem } from "./api";

const GOLD = "var(--color-gold)";
const GOLDT = "#9c7c15";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL = "var(--color-glass-thin)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";

const Back = () => (
  <svg width="11" height="19" viewBox="0 0 11 19" fill="none" aria-hidden><path d="M9 1.5L2 9.5l7 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Temple = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2.5l5 3.2H7L12 2.5z" /><path d="M7 5.7v3M17 5.7v3M5 21v-7.5M19 21v-7.5M9 21v-5a3 3 0 0 1 6 0v5" /><path d="M3.5 21h17M4.5 13.5h15" />
  </svg>
);
const Shield = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z" /><path d="M9 12l2 2 4-4" />
  </svg>
);
const Chev = () => (
  <svg width="8" height="13" viewBox="0 0 9 15" fill="none" aria-hidden><path d="M1.5 1.5L7 7.5l-5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const card: CSSProperties = { padding: 16, borderRadius: 18, background: FILL };

function ago(iso: string): string {
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  if (isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return `${Math.floor(s / 86400)} дн назад`;
}

export default function CenterModeration({
  onBack,
  onOpenPath,
}: {
  onBack: () => void;
  onOpenPath: (p: string) => void;
  flash?: (m: string) => void;
}) {
  const authed = useAuthed();
  const [items, setItems] = useState<MyCenterItem[] | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "forbidden">("loading");

  const load = useCallback(() => {
    setPhase("loading");
    centersClient
      .reviewQueue()
      .then((d) => {
        setItems(d.items);
        setPhase("ready");
      })
      .catch((e: { code?: string }) => setPhase(e?.code === "forbidden" ? "forbidden" : "error"));
  }, []);

  useEffect(() => {
    if (!authed) {
      setPhase("ready");
      return;
    }
    load();
  }, [authed, load]);

  const navStyle: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: `0.5px solid ${HAIR}`,
  };
  const iconBtn: CSSProperties = { display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  const Shell = ({ children }: { children: ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={onBack} style={iconBtn}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>Модерация</div>
        <span style={{ width: 38 }} />
      </header>
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "14px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>{children}</div>
      </div>
    </div>
  );

  if (!authed) {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center", padding: "30px 22px", marginTop: 8 }}>
          <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, color: L1 }}>Войдите, чтобы продолжить</div>
          <button type="button" onClick={requireAuth} style={{ marginTop: 16, padding: "12px 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer" }}>Войти</button>
        </div>
      </Shell>
    );
  }
  if (phase === "loading") {
    return (
      <Shell>
        <div style={{ display: "grid", placeItems: "center", padding: "70px 0", color: L3 }}><span style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${HAIR}`, borderTopColor: GOLD, animation: "cmodSpin .8s linear infinite" }} /></div>
        <style>{`@keyframes cmodSpin{to{transform:rotate(360deg)}}`}</style>
      </Shell>
    );
  }
  if (phase === "forbidden") {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center", padding: "30px 22px", marginTop: 8 }}>
          <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}><Shield size={26} /></span>
          <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, color: L1 }}>Доступ только для редакторов</div>
          <p style={{ margin: "9px auto 0", maxWidth: 300, fontFamily: FT, fontSize: 14, lineHeight: 1.5, color: L2 }}>Модерация центров доступна глобальным редакторам ИСККОН.</p>
        </div>
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center", marginTop: 8 }}>
          <p style={{ margin: 0, fontFamily: FT, fontSize: 14.5, color: L2 }}>Не удалось загрузить очередь.</p>
          <button type="button" onClick={load} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 12, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>Повторить</button>
        </div>
      </Shell>
    );
  }

  const list = items ?? [];
  return (
    <Shell>
      <p style={{ margin: "2px 4px 14px", fontFamily: FT, fontSize: "var(--text-footnote)", lineHeight: 1.5, color: L3 }}>
        Центры, отправленные на проверку. Откройте центр, чтобы опубликовать его или вернуть на доработку.
      </p>
      {list.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "30px 22px" }}>
          <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}><Shield size={26} /></span>
          <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, color: L1 }}>Очередь пуста</div>
          <p style={{ margin: "9px auto 0", maxWidth: 300, fontFamily: FT, fontSize: 14, lineHeight: 1.5, color: L2 }}>Новых заявок на проверку нет.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((it) => {
            const place = [it.city, it.country].filter(Boolean).join(", ");
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onOpenPath(`/center/${it.slug}`)}
                style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: 14, borderRadius: 18, border: "none", background: FILL, cursor: "pointer", textAlign: "left", fontFamily: FT, WebkitTapHighlightColor: "transparent" }}
              >
                <span style={{ display: "grid", placeItems: "center", width: 50, height: 50, flexShrink: 0, borderRadius: 14, overflow: "hidden", background: it.photos[0] ? `center/cover no-repeat url("${it.photos[0]}")` : `color-mix(in srgb, ${GOLD} 13%, transparent)`, color: GOLDT }}>
                  {!it.photos[0] && <Temple size={24} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 700, color: L1, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                  <span style={{ display: "block", marginTop: 2, fontFamily: FT, fontSize: 12.5, color: L3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {CENTER_TYPE_LABEL[it.type]}{place ? ` · ${place}` : ""} · {ago(it.updated_at)}
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

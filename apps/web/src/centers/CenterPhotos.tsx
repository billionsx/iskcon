/**
 * CenterPhotos — управление фотографиями центра (обложка + галерея).
 *
 * Для админа центра: добавить фото по ссылке, переупорядочить, назначить обложку
 * (первая в списке), удалить. Первая фотография становится обложкой на странице
 * центра (CenterHeroCard). Сохранение — PATCH /api/centers/:id { photos }.
 * Эстетика приложения: золото + мягкая заливка, токены темы, инлайн-SVG.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAuthed, requireAuth } from "./../account/track";
import { centersClient, type CenterCard } from "./api";

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
const MAX_PHOTOS = 12;

const Back = () => (
  <svg width="11" height="19" viewBox="0 0 11 19" fill="none" aria-hidden><path d="M9 1.5L2 9.5l7 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const ImageIco = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5L5 19" />
  </svg>
);
const Star = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z" /></svg>
);
const Up = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M6 11l6-6 6 6" /></svg>
);
const Trash = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>
);

const card: CSSProperties = { padding: 16, borderRadius: 18, background: FILL };
const eyebrow: CSSProperties = { fontFamily: FT, fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: L3, margin: "0 4px 8px" };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", fontFamily: FT, fontSize: 15.5, color: L1, background: FILL2, border: "none", outline: "none", borderRadius: 12, padding: "11px 13px", WebkitTapHighlightColor: "transparent" };
const pill: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 10, border: "none", background: FILL2, color: L1, fontFamily: FT, fontSize: 12.5, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" };

export default function CenterPhotos({ slug, onBack, flash }: { slug: string; onBack: () => void; flash?: (m: string) => void }) {
  const authed = useAuthed();
  const [data, setData] = useState<CenterCard | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "notfound">("loading");
  const [photos, setPhotos] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setPhase("loading");
    centersClient
      .get(slug)
      .then((d) => {
        setData(d);
        setPhotos(d.center.photos || []);
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

  const centerId = data?.center.id;
  const persist = useCallback(
    (next: string[], okMsg: string) => {
      if (!centerId || busy) return;
      const prev = photos;
      setPhotos(next); // оптимистично
      setBusy(true);
      setErr(null);
      centersClient
        .update(centerId, { photos: next })
        .then(() => flash?.(okMsg))
        .catch(() => {
          setPhotos(prev); // откат
          setErr("Не удалось сохранить. Попробуйте ещё раз.");
        })
        .finally(() => setBusy(false));
    },
    [centerId, busy, photos, flash],
  );

  const add = () => {
    const url = draft.trim();
    if (url.length < 4) {
      setErr("Вставьте ссылку на изображение.");
      return;
    }
    if (photos.includes(url)) {
      setErr("Эта фотография уже добавлена.");
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      setErr(`Максимум ${MAX_PHOTOS} фотографий.`);
      return;
    }
    setDraft("");
    persist([...photos, url], "Фото добавлено");
  };
  const removeAt = (i: number) => persist(photos.filter((_, idx) => idx !== i), "Фото удалено");
  const moveUp = (i: number) => {
    if (i <= 0) return;
    const next = photos.slice();
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    persist(next, "Порядок изменён");
  };
  const makeHero = (i: number) => {
    if (i <= 0) return;
    const next = [photos[i], ...photos.filter((_, idx) => idx !== i)];
    persist(next, "Обложка обновлена");
  };

  const navStyle: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: `0.5px solid ${HAIR}`,
  };
  const iconBtn: CSSProperties = { display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  const Shell = ({ children }: { children: ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={onBack} style={iconBtn}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>Фотографии</div>
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
          <button type="button" onClick={requireAuth} style={{ marginTop: 16, padding: "12px 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Войти</button>
        </div>
      </Shell>
    );
  }
  if (phase === "loading") {
    return (<Shell><div style={{ display: "grid", placeItems: "center", padding: "70px 0", color: L3 }}><span style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${HAIR}`, borderTopColor: GOLD, animation: "cpSpin .8s linear infinite" }} /></div><style>{`@keyframes cpSpin{to{transform:rotate(360deg)}}`}</style></Shell>);
  }
  if (phase === "notfound" || phase === "error" || !data) {
    return (<Shell><div style={{ ...card, textAlign: "center", marginTop: 8 }}><p style={{ margin: 0, fontFamily: FT, fontSize: 14.5, color: L2 }}>{phase === "notfound" ? "Центр не найден." : "Не удалось загрузить."}</p>{phase === "error" && <button type="button" onClick={load} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 12, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>Повторить</button>}</div></Shell>);
  }
  if (data.can_manage === false) {
    return (<Shell><div style={{ ...card, textAlign: "center", marginTop: 8 }}><p style={{ margin: 0, fontFamily: FT, fontSize: 14.5, color: L2 }}>Нет прав на изменение.</p></div></Shell>);
  }

  return (
    <Shell>
      <section>
        <div style={eyebrow}>Добавить фото</div>
        <input style={inputStyle} value={draft} onChange={(e) => { setDraft(e.target.value); if (err) setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="https://… ссылка на изображение" maxLength={300} autoCapitalize="off" autoCorrect="off" />
        {draft.trim().length > 3 && (
          <div style={{ marginTop: 10, width: "100%", aspectRatio: "16 / 9", borderRadius: 14, background: `center/cover no-repeat url("${draft.trim()}"), ${FILL2}` }} />
        )}
        <button type="button" onClick={add} disabled={busy} style={{ marginTop: 12, width: "100%", padding: "13px 0", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 15.5, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
          Добавить фото
        </button>
        {err && <div style={{ marginTop: 12, padding: "11px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", color: RED, fontFamily: FT, fontSize: 13.5, fontWeight: 600 }}>{err}</div>}
      </section>

      <div style={{ height: 1, background: HAIR, margin: "20px 0" }} />

      {photos.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "30px 22px" }}>
          <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}><ImageIco size={26} /></span>
          <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, color: L1 }}>Фотографий пока нет</div>
          <p style={{ margin: "9px auto 0", maxWidth: 300, fontFamily: FT, fontSize: 14, lineHeight: 1.5, color: L2 }}>Добавьте фото храма, алтаря, Божеств. Первая станет обложкой страницы центра.</p>
        </div>
      ) : (
        <>
          <p style={{ margin: "0 4px 12px", fontFamily: FT, fontSize: 13, lineHeight: 1.5, color: L3 }}>Первая фотография — обложка центра. Перетаскивать нельзя, но можно поднять выше или назначить обложкой.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {photos.map((src, i) => (
              <div key={src + i} style={{ borderRadius: 16, overflow: "hidden", background: FILL }}>
                <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: `center/cover no-repeat url("${src}"), ${FILL2}` }}>
                  {i === 0 && (
                    <span style={{ position: "absolute", top: 10, left: 10, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: "color-mix(in srgb, #000 55%, transparent)", color: "#fff", fontFamily: FT, fontSize: 11.5, fontWeight: 700, backdropFilter: "blur(6px)" }}>
                      <Star size={13} />Обложка
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, padding: 10, flexWrap: "wrap" }}>
                  {i > 0 && <button type="button" onClick={() => makeHero(i)} disabled={busy} style={{ ...pill, color: GOLDT }}><Star size={14} />Сделать обложкой</button>}
                  {i > 0 && <button type="button" onClick={() => moveUp(i)} disabled={busy} style={pill}><Up size={14} />Выше</button>}
                  <button type="button" onClick={() => removeAt(i)} disabled={busy} style={{ ...pill, color: RED, marginLeft: "auto" }}><Trash size={14} />Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

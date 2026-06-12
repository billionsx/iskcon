/**
 * cardActions — единый слой действий КАЖДОЙ карточки приложения (витринной и
 * подробной): центр, ресторан, личность, документ, бхаджан, киртан-альбом и
 * киртан-дорожка. В точности повторяет книжный эталон (BookHeroCard):
 *
 *   ♥ Избранное (персистентно, localStorage)  ·  ⋯ → BookMenuSheet:
 *   Поделиться / Скачать PDF / QR-код / Задонатить / Сообщить об ошибке.
 *
 * PDF — по книжному стандарту: серверный рендер Cloudflare Browser Rendering
 * (/pdf?kind=card → headless Chrome → печатный режим SPA /?pdf=card), с полями
 * и колонтитулами ISKCON ONE LOVE — НЕ window.print().
 *
 * Подключение хоста — две строки:
 *   const fav = useFavorite(`place:${id}`);
 *   const { openCardMenu } = useCardActions();
 *   …<CardActionBtns fav={fav} onMore={() => openCardMenu(ctx)} />
 */
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { BookMenuSheet } from "./BookMenuSheet";
import { QrSheet } from "./QrSheet";
import { ReportSheet } from "./ReportSheet";
import { HeartIcon, MoreIcon } from "./ui/icons";

/* ── Избранное: localStorage `fav:<key>`; key = `<type>:<id>` ─────────────── */
const favListeners = new Set<() => void>();
function favEmit() { favListeners.forEach((l) => l()); }
function favRead(key: string): boolean { try { return localStorage.getItem(`fav:${key}`) === "1"; } catch { return false; } }
export function useFavorite(key: string): { on: boolean; toggle: (flash?: (m: string) => void) => void } {
  const on = useSyncExternalStore(
    useCallback((cb) => { favListeners.add(cb); return () => favListeners.delete(cb); }, []),
    () => favRead(key),
  );
  const toggle = useCallback((flash?: (m: string) => void) => {
    const v = !favRead(key);
    try { if (v) localStorage.setItem(`fav:${key}`, "1"); else localStorage.removeItem(`fav:${key}`); } catch { /* приватный режим */ }
    favEmit();
    flash?.(v ? "Добавлено в избранное" : "Убрано из избранного");
  }, [key]);
  return { on, toggle };
}

/* ── Круглая стеклянная кнопка — копия книжного ActionBtn (34px на карточках) ── */
export function RoundBtn({ ariaLabel, onClick, active, activeColor, dark, size = 34, children }: {
  ariaLabel: string; onClick: () => void; active?: boolean; activeColor?: string; dark?: boolean; size?: number; children: ReactNode;
}) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={active}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      style={{ display: "grid", height: size, width: size, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
        background: dark ? "rgba(255,255,255,.14)" : "rgba(120,120,128,.14)",
        color: active && activeColor ? activeColor : dark ? "#fff" : "var(--color-label)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", transition: "background .2s, color .2s", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}

/* ── Пара ♥ + ⋯ — стандартный блок действий карточки ─────────────────────── */
export function CardActionBtns({ favKey, onMore, flash, dark, size = 34 }: {
  favKey: string; onMore: () => void; flash?: (m: string) => void; dark?: boolean; size?: number;
}) {
  const fav = useFavorite(favKey);
  return (
    <span style={{ display: "inline-flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
      <RoundBtn ariaLabel="В избранное" active={fav.on} activeColor="#FF453A" dark={dark} size={size} onClick={() => fav.toggle(flash)}>
        <HeartIcon size={Math.round(size * 0.53)} filled={fav.on} />
      </RoundBtn>
      <RoundBtn ariaLabel="Ещё" dark={dark} size={size} onClick={onMore}>
        <MoreIcon size={Math.round(size * 0.47)} />
      </RoundBtn>
    </span>
  );
}

/* ── Контекст карточки для меню ──────────────────────────────────────────── */
export type CardCtx = {
  /** тип печатной карточки и deep-link */
  type: "place" | "restaurant" | "entity" | "doc" | "bhajan" | "kirtan-album" | "kirtan-track";
  id: string;
  /** заголовок (для QR-подписи, share-текста и имени PDF-файла) */
  title: string;
  subtitle?: string;
  /** канонический URL карточки (share/QR) */
  url: string;
  /** строка контекста для «Сообщить об ошибке» — адрес карточки */
  context: string;
  /** доп. параметры печати (киртан: album/track) */
  pdfExtra?: Record<string, string>;
};

type CardActionsApi = { openCardMenu: (ctx: CardCtx) => void };
const Ctx = createContext<CardActionsApi>({ openCardMenu: () => {} });
export function useCardActions() { return useContext(Ctx); }

async function downloadCardPdf(ctx: CardCtx, flash: (m: string) => void) {
  flash("Готовим PDF…");
  const q = new URLSearchParams({ kind: "card", type: ctx.type, id: ctx.id, name: ctx.title, ...(ctx.pdfExtra || {}) });
  try {
    const r = await fetch(`/pdf?${q.toString()}`);
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ctx.title.replace(/[\\/:*?"<>|]+/g, "·")}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    flash("PDF сохранён");
  } catch { flash("Не удалось собрать PDF — попробуйте ещё раз"); }
}

/**
 * Провайдер: монтируется один раз НА УРОВНЕ App (оборачивает и Screen, и все
 * полноэкранные оверлеи — личность/бхаджан/киртан/коллекция), поэтому ⋯ доступен
 * везде. Владеет шитом меню, QR, формой ошибки, собственным тостом и исполнением
 * действий. Donate — глобальный оверлей приложения.
 */
export function CardActionsProvider({ children, onDonate }: { children: ReactNode; onDonate: () => void }) {
  const [ctx, setCtx] = useState<CardCtx | null>(null);
  const [menu, setMenu] = useState(false);
  const [qr, setQr] = useState<CardCtx | null>(null);
  const [report, setReport] = useState<CardCtx | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const tRef = useState<{ id: ReturnType<typeof setTimeout> | null }>({ id: null })[0];
  const flash = useCallback((m: string) => {
    setToast(m);
    if (tRef.id) clearTimeout(tRef.id);
    tRef.id = setTimeout(() => setToast(null), 2400);
  }, [tRef]);
  const api = useMemo<CardActionsApi>(() => ({ openCardMenu: (c) => { setCtx(c); setMenu(true); } }), []);
  const pick = (id: string) => {
    const c = ctx; if (!c) return;
    if (id === "share") {
      const payload = { title: c.title, text: c.subtitle ? `${c.title} — ${c.subtitle}` : c.title, url: c.url };
      if (typeof navigator !== "undefined" && navigator.share) navigator.share(payload).catch(() => {});
      else { navigator.clipboard?.writeText(c.url).catch(() => {}); flash("Ссылка скопирована"); }
      return;
    }
    if (id === "pdf") { void downloadCardPdf(c, flash); return; }
    if (id === "qr") { setQr(c); return; }
    if (id === "donate") { onDonate(); return; }
    if (id === "report") { setReport(c); return; }
  };
  return (
    <Ctx.Provider value={api}>
      {children}
      <BookMenuSheet open={menu} onClose={() => setMenu(false)} onSelect={pick} />
      {qr && <QrSheet url={qr.url} data={{ kind: "card", title: qr.title, subtitle: qr.subtitle }} onClose={() => setQr(null)} />}
      <ReportSheet open={!!report} onClose={() => setReport(null)} context={report ? report.context : ""} />
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 2200, background: "rgba(28,28,30,0.96)", color: "#fff", padding: "13px 18px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.5, fontFamily: "var(--font-text)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", width: "calc(100% - 40px)", maxWidth: 380, textAlign: "center" }}>{toast}</div>
      )}
    </Ctx.Provider>
  );
}

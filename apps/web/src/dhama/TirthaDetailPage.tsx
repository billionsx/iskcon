/**
 * TirthaDetailPage — страница одного святого места (тиртхи).
 *
 * Hero — градиент в цвете-акценте дхамы (фотографий отдельных мест нет),
 * поверх — категория, IAST и название. Далее: описание места, раздел «Лила»
 * (что здесь происходило), «Связанные личности» (чипы — тап резолвит героя
 * через /api/entities?q=… и открывает его страницу) и ссылка «Открыть в картах».
 *
 * Тексты — оригинальная редакционная проза (не копии парикрам-гайдов): связи
 * лила→место→личность традиционны и общеизвестны.
 */
import { useEffect, useRef, useState } from "react";
import { BackIcon } from "../ui/icons";
import { api } from "../api";
import { mapsQuery, type Dhama, type Person, type Tirtha } from "./dhamas";
import { TirthaHeroCard } from "./TirthaHeroCard";
import { QrSheet } from "../QrSheet";
import { requestNote } from "../notes";
import { NotesAtSource } from "../NotesAtSource";

const NAV_H = 52;

function PinIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

/** Чип связанной личности: тап → резолв id по имени → открытие страницы героя. */
function PersonChip({ person, accent, onOpenEntity, onMiss }: { person: Person; accent: string; onOpenEntity: (id: string, type: string | null) => void; onMiss: () => void }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (busy) return;
    // Точный путь: id из FK (tirtha_persons.entity_id) — открываем мгновенно, без поиска.
    if (person.entityId) { onOpenEntity(person.entityId, "personality"); return; }
    setBusy(true);
    try {
      const r = await fetch(api(`/entities?q=${encodeURIComponent(person.q)}&limit=1`));
      const d = await r.json();
      const id = (d?.items as { id: string }[] | undefined)?.[0]?.id;
      if (id) onOpenEntity(id, "personality");
      else onMiss();
    } catch {
      onMiss();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={() => void open()} disabled={busy}
      onPointerDown={(e) => (e.currentTarget.style.background = `color-mix(in srgb, ${accent} 22%, transparent)`)}
      onPointerUp={(e) => (e.currentTarget.style.background = `color-mix(in srgb, ${accent} 11%, transparent)`)}
      onPointerLeave={(e) => (e.currentTarget.style.background = `color-mix(in srgb, ${accent} 11%, transparent)`)}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, cursor: busy ? "default" : "pointer",
        fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600, letterSpacing: "-0.1px", color: "var(--color-label)",
        background: `color-mix(in srgb, ${accent} 11%, transparent)`, border: `0.5px solid color-mix(in srgb, ${accent} 34%, transparent)`,
        opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
      {person.name}
    </button>
  );
}

function NotFound({ dhama, onBack }: { dhama: Dhama; onBack: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)" }}>
      <header style={{ height: NAV_H, display: "flex", alignItems: "center", padding: "0 6px", borderBottom: "0.5px solid var(--color-hairline)" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <BackIcon size={22} />
        </button>
      </header>
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--color-label)" }}>Место не найдено</div>
          <p style={{ margin: "6px 0 0", fontFamily: "var(--font-text)", fontSize: 15, color: "var(--color-label-2)" }}>Эта тиртха отсутствует в дхаме «{dhama.name}».</p>
        </div>
      </div>
    </div>
  );
}

export default function TirthaDetailPage({ dhama, tirthaId, onBack, onOpenEntity }: { dhama: Dhama; tirthaId: string; onBack: () => void; onOpenEntity: (id: string, type: string | null) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => { setToast(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1800); };
  const [qr, setQr] = useState(false);

  const t: Tirtha | undefined = dhama.tirthas.find((x) => x.id === tirthaId);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [tirthaId]);

  if (!t) return <NotFound dhama={dhama} onBack={onBack} />;

  const accent = dhama.accent;
  const clusterTitle = dhama.clusters.find((c) => c.id === t.cluster)?.title;
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(mapsQuery(t))}`;

  const onMenu = (id: string) => {
    if (id === "share") {
      const url = `${window.location.origin}/dhama/${dhama.id}/${t.id}`;
      const nav = window.navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
      if (nav.share) void nav.share({ title: t.name, url }).catch(() => undefined);
      else { try { void window.navigator.clipboard?.writeText(url); flash("Ссылка скопирована"); } catch { flash(url); } }
    } else if (id === "qr") setQr(true);
    else if (id === "route") { try { window.open(mapsHref, "_blank", "noopener"); } catch { /* noop */ } }
    else if (id === "note") requestNote({ kind: "place", ref: t.id, title: t.name, subtitle: dhama.name, href: `/dhama/${dhama.id}/${t.id}` });
    else if (id === "report") flash("Спасибо! Передадим редакции.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0, background: "var(--color-bg)" }}>
      {/* sticky навбар «жидкое стекло» */}
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: NAV_H, display: "flex", alignItems: "center", gap: 4, padding: "0 6px",
        background: "var(--color-glass-nav)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: "0.5px solid var(--color-hairline)" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <BackIcon size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
        <span style={{ width: 38, flexShrink: 0 }} />
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {/* hero (ПКП) */}
        <div style={{ padding: "16px 16px 0" }}>
          <TirthaHeroCard dhamaId={dhama.id} tirtha={t} accent={accent} dhamaName={dhama.name} clusterTitle={clusterTitle} onMenuSelect={onMenu} flash={flash} />
        </div>

        <div style={{ padding: "20px 16px calc(env(safe-area-inset-bottom,0px) + 64px)" }}>
          <div style={{ marginBottom: 18 }}><NotesAtSource kind="place" refId={t.id} accent={accent} /></div>
          {/* описание */}
          <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{t.about}</p>

          {/* лила */}
          {t.lila && (
            <section style={{ marginTop: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: accent }}>Лила</div>
              <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: "var(--radius-lg)", background: `color-mix(in srgb, ${accent} 7%, var(--color-bg-2))`, border: `0.5px solid color-mix(in srgb, ${accent} 22%, var(--color-hairline))` }}>
                <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: 15.5, lineHeight: 1.55, color: "var(--color-label)" }}>{t.lila}</p>
              </div>
            </section>
          )}

          {/* связанные личности */}
          {t.persons && t.persons.length > 0 && (
            <section style={{ marginTop: 26 }}>
              <h3 style={{ margin: "0 0 11px", fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>Связанные личности</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {t.persons.map((p) => (
                  <PersonChip key={p.q} person={p} accent={accent} onOpenEntity={onOpenEntity} onMiss={() => flash(`${p.name}: страница появится позже`)} />
                ))}
              </div>
            </section>
          )}

          {/* карты */}
          <section style={{ marginTop: 26 }}>
            <a href={mapsHref} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: "var(--radius-lg)", textDecoration: "none",
                background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", color: "var(--color-label)" }}>
              <span aria-hidden style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 11, flexShrink: 0, color: accent, background: `color-mix(in srgb, ${accent} 13%, transparent)` }}>
                <PinIcon size={19} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600, letterSpacing: "-0.2px" }}>Открыть в Google Картах</span>
                <span style={{ display: "block", marginTop: 1, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)" }}>Местоположение тиртхи</span>
              </span>
              <span aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)", fontSize: 17 }}>↗</span>
            </a>
          </section>

          {/* сноска об источнике */}
          <p style={{ margin: "22px 2px 0", fontFamily: "var(--font-text)", fontSize: 12, lineHeight: 1.5, color: "var(--color-label-3)" }}>
            Описание подготовлено редакцией gaurangers.com на основе традиционных источников. Координаты приблизительны.
          </p>
        </div>
      </div>

      {toast && <div style={{ position: "fixed", left: "50%", bottom: "calc(40px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 90, padding: "11px 18px", borderRadius: 999, maxWidth: "86vw", textAlign: "center", background: "var(--color-label)", color: "var(--color-bg)", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, boxShadow: "var(--shadow-card)" }}>{toast}</div>}
      {qr && typeof window !== "undefined" && (
        <QrSheet url={`${window.location.origin}/dhama/${dhama.id}/${t.id}`} data={{ kind: "card", title: t.name, subtitle: [dhama.name, clusterTitle].filter(Boolean).join(" · ") }} onClose={() => setQr(false)} />
      )}
    </div>
  );
}

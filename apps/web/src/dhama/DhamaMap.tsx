/**
 * DhamaMap — интерактивная карта тиртх дхамы.
 *
 * Leaflet подгружается лениво с CDN (не в бандле): CSS+JS один раз на сессию.
 * Тайлы — CARTO Voyager (бесплатные, читаемы в обеих темах). Маркеры —
 * лёгкие circleMarker в цвете-акценте дхамы (без image-ассетов, чтобы обойти
 * классическую проблему «битых» иконок Leaflet). Тап по маркеру открывает тиртху.
 *
 * Деградация: если CDN недоступен — вместо карты показываем аккуратный список
 * мест со ссылками «Открыть в картах», ничего не падает.
 */
import { useEffect, useRef, useState } from "react";
import type { Dhama, Tirtha } from "./dhamas";
import { KIND_RU, mapsQuery } from "./dhamas";

const LEAFLET_VER = "1.9.4";
const CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.css`;
const JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.js`;

// Глобальный синглтон-загрузчик: один <link>/<script> на всё приложение.
let leafletPromise: Promise<unknown> | null = null;
function loadLeaflet(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  const w = window as unknown as { L?: unknown };
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[data-leaflet]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS_URL;
      link.setAttribute("data-leaflet", "1");
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = JS_URL;
    s.async = true;
    s.onload = () => resolve((window as unknown as { L?: unknown }).L);
    s.onerror = () => reject(new Error("leaflet load failed"));
    document.head.appendChild(s);
  });
  return leafletPromise;
}

export default function DhamaMap({ dhama, height = 340, onOpen }: { dhama: Dhama; height?: number; onOpen: (id: string) => void }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [failed, setFailed] = useState(false);
  // Замыкание onOpen может устаревать в обработчиках маркеров — держим в ref.
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    let alive = true;
    loadLeaflet()
      .then((Lraw) => {
        if (!alive || !elRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = Lraw as any;
        if (mapRef.current) return;
        const map = L.map(elRef.current, {
          center: [dhama.center.lat, dhama.center.lng],
          zoom: dhama.center.zoom,
          scrollWheelZoom: false,
          attributionControl: true,
        });
        mapRef.current = map;
        L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`, {
          subdomains: "abcd",
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap &copy; CARTO',
        }).addTo(map);

        const accent = dhama.accent;
        const pts: [number, number][] = [];
        for (const t of dhama.tirthas) {
          pts.push([t.lat, t.lng]);
          const m = L.circleMarker([t.lat, t.lng], {
            radius: 7,
            color: "#ffffff",
            weight: 2,
            fillColor: accent,
            fillOpacity: 1,
          }).addTo(map);
          m.bindTooltip(`${t.name}`, { direction: "top", offset: [0, -6] });
          m.on("click", () => onOpenRef.current(t.id));
        }
        if (pts.length > 1) {
          try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 }); } catch { /* noop */ }
        }
        // Размеры контейнера могли быть не готовы на момент init.
        setTimeout(() => { try { map.invalidateSize(); } catch { /* noop */ } }, 120);
      })
      .catch(() => { if (alive) setFailed(true); });

    return () => {
      alive = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = mapRef.current as any;
      if (m && typeof m.remove === "function") { try { m.remove(); } catch { /* noop */ } }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dhama.id]);

  if (failed) return <FallbackList dhama={dhama} onOpen={onOpen} />;

  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-3)", boxShadow: "var(--shadow-card)" }}>
      <div ref={elRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

/** Запасной список при недоступности карты. */
function FallbackList({ dhama, onOpen }: { dhama: Dhama; onOpen: (id: string) => void }) {
  return (
    <div style={{ borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)", borderBottom: "0.5px solid var(--color-hairline)" }}>
        Карта недоступна — список мест:
      </div>
      {dhama.tirthas.map((t: Tirtha) => (
        <button key={t.id} type="button" onClick={() => onOpen(t.id)}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "11px 14px", background: "none", border: "none", borderBottom: "0.5px solid var(--color-hairline)", cursor: "pointer" }}>
          <span style={{ flexShrink: 0, width: 9, height: 9, borderRadius: "50%", background: dhama.accent }} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
            <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 12, color: "var(--color-label-3)" }}>{KIND_RU[t.kind]}</span>
          </span>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(mapsQuery(t))}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-brand-blue)", textDecoration: "none" }}>Карты ↗</a>
        </button>
      ))}
    </div>
  );
}

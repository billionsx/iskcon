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

export default function DhamaMap({ dhama, height = 340, onOpen, ordered = false, stops }: { dhama: Dhama; height?: number; onOpen: (id: string) => void; ordered?: boolean; stops?: Tirtha[] }) {
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
        const list = stops && stops.length ? stops : dhama.tirthas;
        // На карте — только места с валидными координатами; места без координат
        // (напр. редкие тиртхи из книг) остаются в списке и доступны по ссылке на карты.
        const geo = list.filter((t) => t.lat != null && t.lng != null && !(t.lat === 0 && t.lng === 0));
        const pts: [number, number][] = geo.map((t) => [t.lat as number, t.lng as number]);

        if (ordered) {
          // маршрут-парикрама: пунктирная линия + нумерованные пины поверх неё
          if (!document.querySelector("style[data-dhama-pin]")) {
            const st = document.createElement("style");
            st.setAttribute("data-dhama-pin", "1");
            st.textContent = ".leaflet-div-icon.dhama-seq-pin{background:transparent;border:0;}";
            document.head.appendChild(st);
          }
          if (pts.length > 1) L.polyline(pts, { color: accent, weight: 3, opacity: 0.72, dashArray: "1 7", lineCap: "round" }).addTo(map);
          geo.forEach((t, i) => {
            const icon = L.divIcon({
              className: "dhama-seq-pin",
              html: `<div style="display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:${accent};color:#fff;font:700 12px/1 var(--font-text,sans-serif);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35)">${i + 1}</div>`,
              iconSize: [24, 24], iconAnchor: [12, 12],
            });
            const m = L.marker([t.lat as number, t.lng as number], { icon }).addTo(map);
            m.bindTooltip(`${i + 1}. ${t.name}`, { direction: "top", offset: [0, -12] });
            m.on("click", () => onOpenRef.current(t.id));
          });
        } else {
          for (const t of geo) {
            const m = L.circleMarker([t.lat as number, t.lng as number], { radius: 7, color: "#ffffff", weight: 2, fillColor: accent, fillOpacity: 1 }).addTo(map);
            m.bindTooltip(`${t.name}`, { direction: "top", offset: [0, -6] });
            m.on("click", () => onOpenRef.current(t.id));
          }
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
  }, [dhama.id, ordered]);

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
      <div style={{ padding: "var(--space-3) var(--space-4)", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)", borderBottom: "0.5px solid var(--color-hairline)" }}>
        Карта недоступна — список мест:
      </div>
      {dhama.tirthas.map((t: Tirtha) => (
        <button key={t.id} type="button" className="tap-row" onClick={() => onOpen(t.id)}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "var(--space-3) var(--space-4)", background: "none", border: "none", borderBottom: "0.5px solid var(--color-hairline)", cursor: "pointer" }}>
          <span style={{ flexShrink: 0, width: 9, height: 9, borderRadius: "50%", background: dhama.accent }} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
            <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>{KIND_RU[t.kind]}</span>
          </span>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(mapsQuery(t))}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-brand-blue)", textDecoration: "none" }}>Карты ↗</a>
        </button>
      ))}
    </div>
  );
}

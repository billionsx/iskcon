/**
 * CentersMap — карта-локатор центров Ятры.
 *
 * Leaflet грузится лениво с CDN (как в DhamaMap), тайлы CARTO Voyager. Маркеры —
 * лёгкие circleMarker в золоте Ятры; тап по маркеру открывает карточку центра.
 * Загрузчик идемпотентен: повторно использует уже загруженный Leaflet (window.L)
 * и существующие теги, поэтому не конфликтует с картой дхам.
 *
 * Деградация: если CDN недоступен — короткое сообщение (список доступен по
 * переключателю «Список»).
 */
import { useEffect, useRef, useState } from "react";
import type { CenterListItem } from "./api";

const LEAFLET_VER = "1.9.4";
const CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.css`;
const JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VER}/dist/leaflet.js`;

let leafletPromise: Promise<unknown> | null = null;
function loadLeaflet(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  const w = window as unknown as { L?: unknown };
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-leaflet]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet"; link.href = CSS_URL; link.setAttribute("data-leaflet", "1");
      document.head.appendChild(link);
    }
    const existing = document.querySelector("script[data-leaflet-js]") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve((window as unknown as { L?: unknown }).L));
      existing.addEventListener("error", () => reject(new Error("leaflet load failed")));
      if ((window as unknown as { L?: unknown }).L) resolve((window as unknown as { L?: unknown }).L);
      return;
    }
    const s = document.createElement("script");
    s.src = JS_URL; s.async = true; s.setAttribute("data-leaflet-js", "1");
    s.onload = () => resolve((window as unknown as { L?: unknown }).L);
    s.onerror = () => reject(new Error("leaflet load failed"));
    document.head.appendChild(s);
  });
  return leafletPromise;
}

const GOLD = "var(--color-gold)";

export default function CentersMap({ items, onOpen, height = 460 }: { items: CenterListItem[]; onOpen: (slug: string) => void; height?: number }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [failed, setFailed] = useState(false);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const geo = items.filter((c) => typeof c.lat === "number" && typeof c.lng === "number");
  // ключ пересборки маркеров — состав точек
  const sig = geo.map((c) => c.id).join(",");

  useEffect(() => {
    let alive = true;
    loadLeaflet()
      .then((Lraw) => {
        if (!alive || !elRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = Lraw as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let map = mapRef.current as any;
        if (!map) {
          map = L.map(elRef.current, { center: [22, 30], zoom: 2, scrollWheelZoom: false, worldCopyJump: true, attributionControl: true });
          mapRef.current = map;
          L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            subdomains: "abcd", maxZoom: 19, attribution: "&copy; OpenStreetMap &copy; CARTO",
          }).addTo(map);
        } else {
          // очистить прежние маркеры при смене фильтра
          map.eachLayer((ly: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const l = ly as any;
            if (l instanceof L.CircleMarker) map.removeLayer(l);
          });
        }

        const pts: [number, number][] = [];
        for (const c of geo) {
          const lat = c.lat as number, lng = c.lng as number;
          pts.push([lat, lng]);
          const m = L.circleMarker([lat, lng], { radius: 6, color: "#ffffff", weight: 1.5, fillColor: GOLD, fillOpacity: 1 }).addTo(map);
          m.bindTooltip(c.name, { direction: "top", offset: [0, -5] });
          m.on("click", () => onOpenRef.current(c.slug));
        }
        if (pts.length > 1) { try { map.fitBounds(pts, { padding: [36, 36], maxZoom: 12 }); } catch { /* noop */ } }
        else if (pts.length === 1) { try { map.setView(pts[0], 11); } catch { /* noop */ } }
        setTimeout(() => { try { map.invalidateSize(); } catch { /* noop */ } }, 120);
      })
      .catch(() => { if (alive) setFailed(true); });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // полный размонтаж карты при уходе с экрана
  useEffect(() => () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = mapRef.current as any;
    if (m && typeof m.remove === "function") { try { m.remove(); } catch { /* noop */ } }
    mapRef.current = null;
  }, []);

  if (failed) {
    return (
      <div style={{ borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", padding: "22px 18px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)", lineHeight: 1.5 }}>
        Карта недоступна. Переключитесь на «Список», чтобы увидеть центры.
      </div>
    );
  }
  if (geo.length === 0) {
    return (
      <div style={{ borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", padding: "22px 18px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)", lineHeight: 1.5 }}>
        У найденных центров пока нет координат для карты.
      </div>
    );
  }
  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-3)", boxShadow: "var(--shadow-card)" }}>
      <div ref={elRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

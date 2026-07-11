import { useEffect, useState } from "react";

/* ───────── palette (matches QrSheet / BookDetailPage: white · graphite · gold) ───────── */
const PAPER = "#ffffff";
const INK = "#1f2024";
const INK2 = "#70727b";
const INK3 = "#a7a8b0";
const LINE = "rgba(0,0,0,0.08)";
const FILL = "#F4F4F7";
const GOLD = "var(--color-gold)";
const GOLDT = "#9c7c15";

const MAX = 2000;

const CATEGORIES = [
  { id: "audio", label: "Аудио" },
  { id: "text", label: "Текст / перевод" },
  { id: "design", label: "Оформление" },
  { id: "payment", label: "Оплата" },
  { id: "other", label: "Другое" },
];

type State = "idle" | "sending" | "done" | "error";

/** «Сообщить об ошибке» — лист обратной связи в стиле iOS. Уходит на support@billionsx.com. */
export function ReportSheet({ open, onClose, context }: { open: boolean; onClose: () => void; context?: string }) {
  const [cat, setCat] = useState("other");
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [dbg, setDbg] = useState("");

  useEffect(() => { if (open) { setCat("other"); setMsg(""); setEmail(""); setState("idle"); setDbg(""); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && state !== "sending") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, state, onClose]);

  if (!open || typeof document === "undefined") return null;

  const catLabel = CATEGORIES.find((c) => c.id === cat)?.label ?? "Другое";
  const trimmed = msg.trim();
  const canSend = trimmed.length > 0 && state !== "sending";

  function diagnostics() {
    return {
      url: typeof window !== "undefined" ? window.location.href : "",
      ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      viewport: typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "",
      lang: typeof navigator !== "undefined" ? navigator.language : "",
      ts: new Date().toISOString(),
      context: context || "",
    };
  }

  async function submit() {
    if (!canSend) return;
    setState("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, categoryLabel: catLabel, message: trimmed, email: email.trim() || null, ...diagnostics() }),
      });
      const j = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) throw new Error("bad status");
      if (j && ((j as { delivered?: boolean; emailed?: boolean }).delivered ?? (j as { emailed?: boolean }).emailed)) {
        setState("done");
        window.setTimeout(onClose, 1700);
      } else {
        setDbg((j as { dbg?: unknown }).dbg ? JSON.stringify((j as { dbg?: unknown }).dbg) : "не доставлено");
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: FILL, border: `0.5px solid ${LINE}`, borderRadius: 13, color: INK, fontSize: "var(--text-subhead)", fontFamily: "var(--font-text)", outline: "none" };

  return (
    <div onClick={() => { if (state !== "sending") onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Сообщить об ошибке"
        style={{ width: "min(440px, 100%)", maxHeight: "92vh", overflowY: "auto", background: PAPER, borderRadius: 24, padding: 22, fontFamily: "var(--font-text)", boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 30px 70px rgba(0,0,0,.28)", animation: "none" }}>

        {state === "done" ? (
          <div style={{ padding: "26px 6px 14px", textAlign: "center" }}>
            <div style={{ width: 60, height: 60, margin: "0 auto 14px", borderRadius: "50%", background: "rgba(210,170,27,0.14)", display: "grid", placeItems: "center" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={GOLDT} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5 10 17.5 19 6.5" /></svg>
            </div>
            <div style={{ fontSize: "var(--text-body)", fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>Спасибо!</div>
            <div style={{ fontSize: "var(--text-subhead)", color: INK2, marginTop: 4 }}>Ваше сообщение отправлено.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-body)", fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>Сообщить об ошибке</div>
                <div style={{ fontSize: "var(--text-footnote)", color: INK2, marginTop: 3, lineHeight: 1.35 }}>Опишите, что пошло не так — мы читаем каждое сообщение.</div>
              </div>
              <button type="button" aria-label="Закрыть" onClick={onClose} style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: "50%", border: "none", background: FILL, color: INK2, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {CATEGORIES.map((c) => {
                const on = c.id === cat;
                return (
                  <button key={c.id} type="button" onClick={() => setCat(c.id)}
                    style={{ padding: "7px 13px", borderRadius: 999, fontSize: "var(--text-footnote)", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-text)", transition: "background .15s, color .15s, border-color .15s",
                      background: on ? "rgba(210,170,27,0.15)" : FILL, color: on ? GOLDT : INK2, border: `1px solid ${on ? "rgba(210,170,27,0.55)" : "transparent"}` }}>
                    {c.label}
                  </button>
                );
              })}
            </div>

            <div style={{ position: "relative", marginTop: 12 }}>
              <textarea value={msg} maxLength={MAX} onChange={(e) => setMsg(e.target.value)} autoFocus
                placeholder="Что случилось? Чем подробнее — тем лучше."
                style={{ ...field, minHeight: 118, padding: "12px 14px 24px", resize: "vertical", lineHeight: 1.4 }} />
              <span style={{ position: "absolute", right: 12, bottom: 8, fontSize: "var(--text-caption)", color: INK3, fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}>{trimmed.length}/{MAX}</span>
            </div>

            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email"
              placeholder="Email для ответа (необязательно)"
              style={{ ...field, height: 46, padding: "0 14px", marginTop: 10 }} />

            <div style={{ fontSize: "var(--text-caption)", color: INK3, marginTop: 10, lineHeight: 1.4 }}>
              К сообщению приложатся страница, версия приложения и тип устройства{context ? ` · ${context}` : ""}.
            </div>

            {state === "error" && (
              <div style={{ marginTop: 12, fontSize: "var(--text-footnote)", color: "#c0392b", background: "rgba(192,57,43,0.08)", border: "0.5px solid rgba(192,57,43,0.25)", borderRadius: 12, padding: "10px 12px" }}>
                Не удалось отправить. Попробуйте ещё раз.
                {dbg && <div style={{ marginTop: 6, fontSize: "var(--text-caption2)", opacity: 0.8, wordBreak: "break-all", fontFamily: "ui-monospace, monospace" }}>debug: {dbg}</div>}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="button" onClick={onClose} disabled={state === "sending"}
                style={{ flexShrink: 0, height: 48, padding: "0 18px", borderRadius: 14, border: "none", background: FILL, color: INK, fontSize: "var(--text-callout)", fontWeight: 600, cursor: state === "sending" ? "default" : "pointer", fontFamily: "var(--font-text)", opacity: state === "sending" ? 0.5 : 1 }}>
                Отмена
              </button>
              <button type="button" onClick={submit} disabled={!canSend}
                style={{ flex: 1, height: 48, borderRadius: 14, border: "none", background: INK, color: "#fff", fontSize: "var(--text-callout)", fontWeight: 600, cursor: canSend ? "pointer" : "default", fontFamily: "var(--font-text)", opacity: canSend ? 1 : 0.4, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {state === "sending" ? (<>
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" /></path></svg>
                  Отправляем…
                </>) : "Отправить"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Онбординг (Ц2 · редизайн) — первые ~60 секунд в стандарте Apple 2026.
 *
 * Самогейтящийся полноэкранный оверлей: сам решает, показываться ли (флаг
 * onboarded в localStorage; вошедшему преданному со ступенью — не мешает).
 * Ветвится по ступени (Ц1): практикующим — норма кругов, инициированным —
 * духовное имя и гуру. В конце — мягкое предложение уведомлений (Ц3).
 *
 * Дизайн: тёмное «жидкое стекло» приложения + золото храмовой лампы, живое
 * движение (спринг-переходы, дыхание бренда, отклик на нажатие), глубина через
 * мягкое золотое свечение. Логика: оптимистичное завершение (не блокируем
 * праздничный переход сетью — локально пишем сразу, сервер фоном), защита от
 * двойного submit, сквозная навигация назад. Форс-регистрации нет.
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "./account/store";
import { enablePush, pushSupported } from "./push";
import { isOnboarded, markOnboarded, setLocalDevotee, getLocalDevotee, LEVEL_META } from "./devotee";
import type { DevoteeLevel } from "./account/api";

/* Палитра — золото храмовой лампы поверх глубокого чёрного (единый акцент). */
const GOLD = "#E9C35A";
const GOLD_GRAD = "linear-gradient(180deg,#F2CF5E 0%,#CE9E22 100%)";
const ON_GOLD = "#241a00";
const BG = "var(--color-bg)";
const INK = "var(--color-label)";
const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";
const SURF = "rgba(255,255,255,0.055)";
const SURF_STRK = "rgba(255,255,255,0.10)";
const DIV = "rgba(255,255,255,0.075)";
const DISPLAY = "var(--font-display)";
const TEXT = "var(--font-text)";

const CSS = `
.onb-root, .onb-root *{box-sizing:border-box}
.onb-press{transition:transform .16s cubic-bezier(.2,.8,.2,1),filter .16s,opacity .16s}
.onb-press:active{transform:scale(.966)}
.onb-tile{transition:background .22s cubic-bezier(.16,1,.3,1),border-color .22s,box-shadow .22s,transform .16s}
.onb-tile:active{transform:scale(.99)}
.onb-fwd{animation:onbFwd .42s cubic-bezier(.16,1,.3,1) both}
.onb-back{animation:onbBack .42s cubic-bezier(.16,1,.3,1) both}
.onb-rise{animation:onbRise .55s cubic-bezier(.16,1,.3,1) both}
.onb-pop{animation:onbPop .6s cubic-bezier(.16,1,.3,1) both}
.onb-glow{animation:onbGlow 4.8s ease-in-out infinite}
.onb-pulse{animation:onbPulse 2.8s ease-out infinite}
@keyframes onbFwd{from{opacity:0;transform:translate3d(26px,0,0)}to{opacity:1;transform:none}}
@keyframes onbBack{from{opacity:0;transform:translate3d(-26px,0,0)}to{opacity:1;transform:none}}
@keyframes onbRise{from{opacity:0;transform:translate3d(0,18px,0)}to{opacity:1;transform:none}}
@keyframes onbPop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
@keyframes onbGlow{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.72;transform:scale(1.09)}}
@keyframes onbPulse{0%{transform:scale(.9);opacity:.5}70%{opacity:0}100%{transform:scale(1.6);opacity:0}}
@media (prefers-reduced-motion:reduce){
 .onb-fwd,.onb-back,.onb-rise,.onb-pop{animation:none}
 .onb-glow,.onb-pulse{animation:none!important;opacity:.5}
}
`;

/* ── Иконки (штрих, 24×24). Путь духовного роста как нарастание света. ── */
const sv = (c: string, w = 1.7): CSSProperties => ({ fill: "none", stroke: c, strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" }) as CSSProperties;

function IcChevron({ c = INK2 }: { c?: string }) {
  return <svg width={22} height={22} viewBox="0 0 24 24" style={sv(c, 2)}><path d="M15 18l-6-6 6-6" /></svg>;
}
function LevelIcon({ id, c, size = 24 }: { id: DevoteeLevel; c: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", style: sv(c) } as const;
  switch (id) {
    case "guest": // компас — знакомство, поиск пути
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2 5.2-2z" /></svg>;
    case "neophyte": // росток — первые шаги
      return <svg {...p}><path d="M12 20v-7" /><path d="M12 13c0-2.4-2-4.3-4.4-4.3H6.2C6.2 11 8.1 13 10.5 13H12z" /><path d="M12 11.5c0-2.7 2.2-4.9 4.9-4.9h1.1c0 2.7-2.2 4.9-4.9 4.9H12z" /></svg>;
    case "practicing": // рассвет — ежедневная садхана
      return <svg {...p}><path d="M3 18.5h18" /><path d="M6.4 18.5a5.6 5.6 0 0 1 11.2 0" /><path d="M12 4.5v2.2M4.7 8.6l1.5 1.5M19.3 8.6l-1.5 1.5" /></svg>;
    case "initiated": // пламя — принял духовного учителя, дикша
      return <svg {...p}><path d="M12 22a6 6 0 0 0 6-6c0-4.2-4-6.2-4-10.2 0 0-3 2-3 5 0 1.6-1 2.2-1.6 2.8A6 6 0 0 0 12 22z" /><path d="M12 20a2.6 2.6 0 0 0 2.6-2.6c0-1.9-2.6-3.1-2.6-5.2 0 0-2 1.3-2 3.6A2.6 2.6 0 0 0 12 20z" /></svg>;
    case "guru": // сияющий свет — наставляет других
      return <svg {...p}><circle cx="12" cy="12" r="3.4" /><path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.7 5.7l1.9 1.9M16.4 16.4l1.9 1.9M18.3 5.7l-1.9 1.9M5.7 18.3l1.9-1.9" /></svg>;
  }
}
function IcBell({ c = GOLD, size = 34 }: { c?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" style={sv(c)}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>;
}
function IcSun({ c }: { c: string }) { return <svg width={19} height={19} viewBox="0 0 24 24" style={sv(c, 1.6)}><circle cx="12" cy="12" r="3.6" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18" /></svg>; }
function IcMoon({ c }: { c: string }) { return <svg width={19} height={19} viewBox="0 0 24 24" style={sv(c, 1.6)}><path d="M21 12.9A9 9 0 1 1 11.1 3 7 7 0 0 0 21 12.9z" /></svg>; }
function IcStar({ c }: { c: string }) { return <svg width={19} height={19} viewBox="0 0 24 24" style={sv(c, 1.6)}><path d="M12 3.2l1.9 4.9 5.1.5-3.9 3.4 1.2 5-4.4-2.7-4.4 2.7 1.2-5L4.9 8.6l5.1-.5L12 3.2z" /></svg>; }
function IcFlame({ c }: { c: string }) { return <svg width={19} height={19} viewBox="0 0 24 24" style={sv(c, 1.6)}><path d="M12 22a6 6 0 0 0 6-6c0-4.2-4-6.2-4-10.2 0 0-3 2-3 5 0 1.6-1 2.2-1.6 2.8A6 6 0 0 0 12 22z" /></svg>; }
function IcCheck({ c = ON_GOLD }: { c?: string }) { return <svg width={15} height={15} viewBox="0 0 24 24" style={sv(c, 2.6)}><path d="M20 6L9 17l-5-5" /></svg>; }

/* ── Кнопки ── */
function PrimaryBtn({ label, onClick, disabled, busy }: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button
      className="onb-press" onClick={onClick} disabled={disabled || busy}
      style={{
        width: "100%", padding: "16px 20px", borderRadius: 16, border: "none",
        cursor: disabled || busy ? "default" : "pointer", background: GOLD_GRAD, color: ON_GOLD,
        fontFamily: TEXT, fontSize: 17, fontWeight: 650, letterSpacing: 0.2,
        opacity: disabled ? 0.5 : 1,
        boxShadow: "0 1px 0 rgba(255,255,255,0.25) inset, 0 10px 30px rgba(206,158,34,0.34), 0 2px 8px rgba(0,0,0,0.4)",
        WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}
    >
      {busy && <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${ON_GOLD}`, borderTopColor: "transparent", display: "inline-block", animation: "onbSpin 0.7s linear infinite" }} />}
      {label}
    </button>
  );
}
function GhostBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="onb-press" onClick={onClick} disabled={disabled}
      style={{ width: "100%", padding: "14px 20px", borderRadius: 16, border: "none", background: "transparent", color: INK2, fontFamily: TEXT, fontSize: 16, fontWeight: 510, cursor: "pointer", WebkitTapHighlightColor: "transparent", opacity: disabled ? 0.5 : 1 }}>
      {label}
    </button>
  );
}

export function Onboarding({ navigate }: { navigate: (path: string) => void }) {
  const { user, status, updateProfile } = useAuth();
  const local = getLocalDevotee();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<DevoteeLevel | "">(user?.level ?? local.level ?? "");
  const [name, setName] = useState(user?.name ?? local.name ?? "");
  const [spiritual, setSpiritual] = useState(user?.spiritualName ?? local.spiritualName ?? "");
  const [guru, setGuru] = useState(user?.dikshaGuru ?? local.dikshaGuru ?? "");
  const [norm, setNorm] = useState<number>(local.chantNorm && local.chantNorm >= 1 ? local.chantNorm : 16);
  const [pushBusy, setPushBusy] = useState(false);
  const supported = pushSupported();

  const practicing = level === "practicing" || level === "initiated" || level === "guru";
  const initiated = level === "initiated" || level === "guru";

  // Гейт — после всех хуков: не мешаем вошедшему со ступенью и во время загрузки сессии.
  const show = !dismissed && status !== "loading" && !isOnboarded() && !(status === "authed" && !!user?.level);
  if (!show) return null;

  function go(n: number) { setDir(n >= step ? 1 : -1); setStep(n); }
  function goBack() { go(Math.max(0, step - 1)); }

  function finish(navTo?: string) {
    if (busy) return;
    setBusy(true);
    const lv = level || "";
    setLocalDevotee({ level: lv, name: name.trim(), spiritualName: spiritual.trim(), dikshaGuru: guru.trim(), chantNorm: practicing ? norm : undefined });
    markOnboarded();
    setDismissed(true);              // оптимистично: переход мгновенный
    if (navTo) navigate(navTo);
    if (status === "authed") {       // сервер — фоном, не блокируем
      void updateProfile({
        name: name.trim(), spiritualName: spiritual.trim(), level: lv,
        dikshaGuru: initiated ? guru.trim() : "",
        ...(practicing ? { chantNorm: norm } : {}),
      }).catch(() => { /* локально уже сохранено */ });
    }
  }

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try { await enablePush(); } catch { /* мягкий отказ */ } finally { setPushBusy(false); }
    go(4);
  }

  const wrap: CSSProperties = { position: "fixed", inset: 0, zIndex: 5000, background: BG, display: "flex", flexDirection: "column", fontFamily: TEXT, overflow: "hidden", isolation: "isolate", overscrollBehavior: "contain" };
  const aura: CSSProperties = {
    position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
    background:
      "radial-gradient(135% 92% at 50% -14%, rgba(233,195,90,0.20), rgba(233,195,90,0.05) 36%, transparent 64%)," +
      "radial-gradient(105% 72% at 50% 120%, rgba(227,149,58,0.11), transparent 58%)",
  };
  const header: CSSProperties = { position: "relative", zIndex: 2, padding: "calc(10px + env(safe-area-inset-top)) 16px 0" };
  const main: CSSProperties = { position: "relative", zIndex: 1, flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 24px", display: "flex", flexDirection: "column" };
  const footer: CSSProperties = { position: "relative", zIndex: 2, padding: "10px 24px calc(18px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 4 };
  const h1: CSSProperties = { fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, color: INK, lineHeight: 1.16, letterSpacing: -0.4, margin: 0 };
  const sub: CSSProperties = { fontSize: 16, lineHeight: 1.5, color: INK2, margin: "12px 0 0", fontWeight: 420 };
  const listCard: CSSProperties = { background: SURF, borderRadius: 18, border: `0.5px solid ${SURF_STRK}`, overflow: "hidden", boxShadow: "0 6px 20px rgba(0,0,0,0.28)" };
  const rowStyle: CSSProperties = { display: "flex", alignItems: "center", minHeight: 54, padding: "0 16px" };
  const input: CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 17, color: INK, fontFamily: TEXT, padding: "15px 0" };
  const hair = <div style={{ height: "0.5px", background: DIV, marginLeft: 16 }} />;

  const stepClass = dir >= 0 ? "onb-fwd" : "onb-back";

  /* Точки прогресса — 3 вопроса (ступень · о вас · уведомления). */
  const Dots = () => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16 }}>
      {[1, 2, 3].map((i) => (
        <span key={i} style={{ width: step === i ? 22 : 6, height: 6, borderRadius: 6, background: step === i ? GOLD : step > i ? "rgba(233,195,90,0.45)" : "rgba(120,120,128,0.3)", transition: "all .3s cubic-bezier(.16,1,.3,1)" }} />
      ))}
    </div>
  );

  const chromeSteps = step >= 1 && step <= 3;
  const Header = () => (
    <div style={header}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 32 }}>
        <button className="onb-press" aria-label="Назад" onClick={goBack} style={{ background: "none", border: "none", padding: 6, margin: -6, cursor: "pointer", display: "flex", WebkitTapHighlightColor: "transparent" }}><IcChevron /></button>
        {step <= 2
          ? <button className="onb-press" onClick={() => finish()} style={{ background: "none", border: "none", color: INK3, fontFamily: TEXT, fontSize: 15, fontWeight: 500, cursor: "pointer", padding: "6px 2px", WebkitTapHighlightColor: "transparent" }}>Пропустить</button>
          : <span style={{ width: 22 }} />}
      </div>
      <Dots />
    </div>
  );

  /* Мягкий диск-подставка под иконку (стиль iOS-настроек). */
  const Tile = ({ children, on }: { children: ReactNode; on?: boolean }) => (
    <div style={{ width: 44, height: 44, borderRadius: 12, flex: "0 0 auto", display: "grid", placeItems: "center", background: on ? GOLD_GRAD : "rgba(233,195,90,0.12)", boxShadow: on ? "0 4px 14px rgba(206,158,34,0.4)" : "none", transition: "background .22s, box-shadow .22s" }}>
      {children}
    </div>
  );

  let content: ReactNode = null;
  let foot: ReactNode = null;

  if (step === 0) {
    // Момент бренда: дышащее золотое свечение, знак, ступенчатое появление.
    content = (
      <div style={{ ...main, justifyContent: "center", alignItems: "center", textAlign: "center", paddingTop: "env(safe-area-inset-top)" }}>
        <div className="onb-pop" style={{ position: "relative", width: 132, height: 132, display: "grid", placeItems: "center", marginBottom: 30 }}>
          <div className="onb-glow" style={{ position: "absolute", width: 186, height: 186, borderRadius: "50%", background: "radial-gradient(circle, rgba(233,195,90,0.4), transparent 62%)", filter: "blur(4px)" }} />
          <img src="/iskcon-one-love-mark.svg" alt="" width={112} height={112} style={{ position: "relative" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        </div>
        <div className="onb-rise" style={{ animationDelay: ".08s", fontSize: 13, fontWeight: 600, letterSpacing: 3, color: GOLD, textTransform: "uppercase" }}>Харе Кришна</div>
        <h1 className="onb-rise" style={{ ...h1, animationDelay: ".16s", fontSize: 31, maxWidth: 340, marginTop: 14 }}>Добро пожаловать<br />в ISKCON ONE LOVE</h1>
        <p className="onb-rise" style={{ ...sub, animationDelay: ".24s", maxWidth: 320, color: INK2 }}>Ваш дом в сознании Кришны: священные тексты, святые имена, вайшнавский календарь, даршаны и живая садхана — в одном месте.</p>
      </div>
    );
    foot = <div style={footer} className="onb-rise"><div style={{ animationDelay: ".32s" }}><PrimaryBtn label="Начать" onClick={() => go(1)} /></div></div>;
  } else if (step === 1) {
    content = (
      <div key="s1" className={stepClass} style={main}>
        <h1 style={{ ...h1, marginTop: 18 }}>Где вы на духовном пути?</h1>
        <p style={sub}>Это настроит приложение под вас. Ответ можно изменить в любой момент.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22, paddingBottom: 16 }}>
          {LEVEL_META.map((o) => {
            const on = level === o.id;
            return (
              <button key={o.id} className="onb-tile" onClick={() => { setLevel(o.id); setTimeout(() => go(2), 180); }}
                style={{
                  display: "flex", alignItems: "center", gap: 14, textAlign: "left", padding: "13px 14px", borderRadius: 16, cursor: "pointer",
                  background: on ? "color-mix(in srgb, #E9C35A 14%, transparent)" : SURF,
                  border: `1px solid ${on ? GOLD : SURF_STRK}`,
                  boxShadow: on ? "0 6px 22px rgba(206,158,34,0.22)" : "0 4px 16px rgba(0,0,0,0.24)",
                  WebkitTapHighlightColor: "transparent",
                }}>
                <Tile on={on}><LevelIcon id={o.id} c={on ? ON_GOLD : GOLD} /></Tile>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 17, fontWeight: 600, color: INK, fontFamily: TEXT }}>{o.label}</span>
                  <span style={{ display: "block", fontSize: 13.5, color: INK2, fontFamily: TEXT, marginTop: 1 }}>{o.hint}</span>
                </span>
                <span style={{ width: 22, height: 22, borderRadius: "50%", flex: "0 0 auto", display: "grid", placeItems: "center", background: on ? GOLD_GRAD : "transparent", border: on ? "none" : `1.6px solid rgba(255,255,255,0.18)` }}>{on && <IcCheck />}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  } else if (step === 2) {
    const cardSub = initiated ? "Как к вам обращаться, ваше духовное имя и учитель." : practicing ? "Как к вам обращаться и ваша ежедневная норма святого имени." : "Как к вам обращаться? Можно пропустить.";
    content = (
      <div key="s2" className={stepClass} style={main}>
        <h1 style={{ ...h1, marginTop: 18 }}>Немного о вас</h1>
        <p style={sub}>{cardSub}</p>
        <div style={{ ...listCard, marginTop: 22 }}>
          <div style={rowStyle}><input style={input} placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></div>
          {initiated && <>{hair}<div style={rowStyle}><input style={input} placeholder="Духовное имя" value={spiritual} onChange={(e) => setSpiritual(e.target.value)} autoComplete="off" /></div></>}
          {initiated && <>{hair}<div style={rowStyle}><input style={input} placeholder="Дикша-гуру" value={guru} onChange={(e) => setGuru(e.target.value)} autoComplete="off" /></div></>}
          {practicing && (
            <>{hair}
              <div style={{ ...rowStyle, justifyContent: "space-between" }}>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 17, color: INK, fontFamily: TEXT }}>Норма кругов в день</span>
                  <span style={{ fontSize: 12.5, color: INK3, fontFamily: TEXT, marginTop: 1 }}>16 — стандарт для инициированных</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.06)", borderRadius: 11, padding: 3 }}>
                  <button className="onb-press" aria-label="Меньше" onClick={() => setNorm((n) => Math.max(1, n - 1))} style={stepBtn}>−</button>
                  <span style={{ minWidth: 30, textAlign: "center", fontSize: 18, fontWeight: 640, color: INK, fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>{norm}</span>
                  <button className="onb-press" aria-label="Больше" onClick={() => setNorm((n) => Math.min(64, n + 1))} style={stepBtn}>+</button>
                </div>
              </div>
            </>
          )}
        </div>
        <div style={{ flex: 1 }} />
      </div>
    );
    foot = <div style={footer}><PrimaryBtn label="Далее" onClick={() => go(3)} /></div>;
  } else if (step === 3) {
    const benefits: { ic: ReactNode; t: string }[] = [
      { ic: <IcSun c={GOLD} />, t: "Стих дня по утрам" },
      { ic: <IcMoon c={GOLD} />, t: "Канун Экадаши и пост" },
      { ic: <IcStar c={GOLD} />, t: "Праздники вайшнавского календаря" },
      { ic: <IcFlame c={GOLD} />, t: "Напоминание, если норма ещё не закрыта" },
    ];
    content = (
      <div key="s3" className={stepClass} style={{ ...main, textAlign: "center" }}>
        <div style={{ flex: "0 0 auto", height: 8 }} />
        <div style={{ position: "relative", width: 88, height: 88, margin: "12px auto 22px", display: "grid", placeItems: "center" }}>
          <div className="onb-glow" style={{ position: "absolute", width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle, rgba(233,195,90,0.32), transparent 64%)", filter: "blur(3px)" }} />
          <div style={{ position: "relative", width: 88, height: 88, borderRadius: 24, background: "rgba(233,195,90,0.13)", border: `0.5px solid rgba(233,195,90,0.3)`, display: "grid", placeItems: "center" }}><IcBell /></div>
        </div>
        <h1 style={{ ...h1, maxWidth: 320, margin: "0 auto" }}>Тихие напоминания о практике</h1>
        {supported ? (
          <>
            <p style={{ ...sub, maxWidth: 320, margin: "12px auto 0" }}>Без шума — только важное.</p>
            <div style={{ ...listCard, marginTop: 22, textAlign: "left" }}>
              {benefits.map((b, i) => (
                <div key={i}>
                  {i > 0 && hair}
                  <div style={{ ...rowStyle, gap: 14 }}>
                    <span style={{ width: 30, display: "grid", placeItems: "center", flex: "0 0 auto" }}>{b.ic}</span>
                    <span style={{ fontSize: 15.5, color: INK, fontFamily: TEXT }}>{b.t}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ ...sub, maxWidth: 320, margin: "12px auto 0" }}>На этом устройстве уведомления недоступны. На iPhone добавьте приложение на домашний экран через «Поделиться» → «На экран „Домой“», и они заработают.</p>
        )}
        <div style={{ flex: 1, minHeight: 12 }} />
      </div>
    );
    foot = supported
      ? <div style={footer}><PrimaryBtn label={pushBusy ? "Подключаем…" : "Включить уведомления"} busy={pushBusy} onClick={() => void togglePush()} /><GhostBtn label="Не сейчас" onClick={() => go(4)} disabled={pushBusy} /></div>
      : <div style={footer}><PrimaryBtn label="Далее" onClick={() => go(4)} /></div>;
  } else {
    const nm = name.trim();
    const lvHint = level === "guest"
      ? "Начните с даршанов и стиха дня — почувствуйте атмосферу вайшнавской традиции."
      : level === "neophyte"
      ? "Первые шаги — святое имя и «Бхагавад-гита». Всё готово, чтобы начать."
      : "Ваша садхана ждёт. Начните с кругов джапы — счётчик и стрик уже настроены.";
    const cta = practicing ? { label: "Начать джапу", to: "/practice/japa" as string | undefined }
      : level === "neophyte" ? { label: "Открыть «Бхагавад-гиту»", to: "/book/bg" }
      : { label: "Войти в приложение", to: undefined };
    content = (
      <div key="s4" className="onb-pop" style={{ ...main, justifyContent: "center", alignItems: "center", textAlign: "center", paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ position: "relative", width: 128, height: 128, display: "grid", placeItems: "center", marginBottom: 28 }}>
          <div className="onb-pulse" style={{ position: "absolute", width: 128, height: 128, borderRadius: "50%", border: `1.5px solid rgba(233,195,90,0.5)` }} />
          <div className="onb-glow" style={{ position: "absolute", width: 176, height: 176, borderRadius: "50%", background: "radial-gradient(circle, rgba(233,195,90,0.42), transparent 62%)", filter: "blur(4px)" }} />
          <img src="/iskcon-one-love-mark.svg" alt="" width={108} height={108} style={{ position: "relative" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 3, color: GOLD, textTransform: "uppercase" }}>Всё готово</div>
        <h1 style={{ ...h1, maxWidth: 330, marginTop: 12, fontSize: 29 }}>{nm ? `Харе Кришна, ${nm}!` : "Добро пожаловать домой"}</h1>
        <p style={{ ...sub, maxWidth: 320 }}>{lvHint}</p>
      </div>
    );
    foot = <div style={footer}><PrimaryBtn label={cta.label} busy={busy} onClick={() => finish(cta.to)} /></div>;
  }

  return (
    <div className="onb-root" style={wrap}>
      <style>{CSS + "@keyframes onbSpin{to{transform:rotate(360deg)}}"}</style>
      <div style={aura} />
      {chromeSteps && <Header />}
      {content}
      {foot}
    </div>
  );
}

const stepBtn: CSSProperties = { width: 34, height: 34, borderRadius: 9, border: "none", background: "rgba(255,255,255,0.08)", color: INK, fontFamily: TEXT, fontSize: 21, fontWeight: 500, lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" };

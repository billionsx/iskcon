/**
 * Онбординг (Ц2 · редизайн под Apple Fitness, светлая тема приложения).
 *
 * Самогейтящийся полноэкранный оверлей: сам решает, показываться ли (флаг
 * onboarded в localStorage; вошедшему преданному со ступенью — не мешает).
 * Ветвится по ступени (Ц1): практикующим — норма кругов, инициированным —
 * духовное имя и гуру. В конце — мягкое предложение уведомлений (Ц3).
 *
 * Дизайн строго на семантических токенах (var(--color-*)) → корректно в
 * светлой теме (белый холст, белые карточки на мягкой тени, near-black текст,
 * серый вторичный) и не ломается, если тему переключат. Язык Apple Fitness:
 * крупный дисплейный заголовок, воздух, объёмный образ по центру, серый
 * подзаголовок, золотая таблетка-CTA на всю ширину внизу (как на экране
 * Экадаши). Без ореолов, градиентов и пульсаций. Логика: оптимистичное
 * завершение (переход не ждёт сети), защита от двойного submit, навигация назад.
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "./account/store";
import { ROUTES } from "./routes";
import { enablePush, pushSupported } from "./push";
import { markOnboarded, setLocalDevotee, getLocalDevotee, LEVEL_META } from "./devotee";
import type { DevoteeLevel } from "./account/api";
import { ProviderButtons } from "./account/providers";

/* Единый акцент приложения — золото (как в TodayHub / Экадаши). */
const GOLD = "var(--color-gold)";
const GOLD_SOFT = "rgba(210,170,27,0.10)";
const ON_GOLD = "#1c1600";
/* Семантические токены темы. */
const BG = "var(--color-bg)";
const CARD = "var(--color-bg-2)";
const FILL = "var(--color-bg-3)";
const INK = "var(--color-label)";
const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";
const HAIR = "var(--color-hairline)";
const SHADOW = "var(--shadow-card)";
const DISPLAY = "var(--font-display)";
const TEXT = "var(--font-text)";

const CSS = `
.onb-root, .onb-root *{box-sizing:border-box}
.onb-press{transition:transform .16s cubic-bezier(.2,.8,.2,1),opacity .16s,background .18s}
.onb-press:active{transform:scale(.972)}
.onb-tile{transition:background .2s cubic-bezier(.16,1,.3,1),border-color .2s,transform .16s}
.onb-tile:active{transform:scale(.99)}
.onb-fwd{animation:onbFwd .42s cubic-bezier(.16,1,.3,1) both}
.onb-back{animation:onbBack .42s cubic-bezier(.16,1,.3,1) both}
.onb-rise{animation:onbRise .55s cubic-bezier(.16,1,.3,1) both}
@keyframes onbFwd{from{opacity:0;transform:translate3d(22px,0,0)}to{opacity:1;transform:none}}
@keyframes onbBack{from{opacity:0;transform:translate3d(-22px,0,0)}to{opacity:1;transform:none}}
@keyframes onbRise{from{opacity:0;transform:translate3d(0,16px,0)}to{opacity:1;transform:none}}
@keyframes onbSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.onb-fwd,.onb-back,.onb-rise{animation:none}}
`;

/* ── Иконки (штрих, 24×24). Путь: компас → росток → рассвет → пламя → сияние. ── */
const sv = (c: string, w = 1.7): CSSProperties => ({ fill: "none", stroke: c, strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" }) as CSSProperties;

function IcMail() {
  return <svg width={18} height={18} viewBox="0 0 24 24" style={sv(INK, 1.8)}><rect x="3" y="5.4" width="18" height="13.2" rx="2.2" /><path d="m4 7 8 5.6L20 7" /></svg>;
}
function IcChevron({ c = INK }: { c?: string }) {
  return <svg width={17} height={17} viewBox="0 0 24 24" style={sv(c, 2.4)}><path d="M15 18l-6-6 6-6" /></svg>;
}
function LevelIcon({ id, c, size = 23 }: { id: DevoteeLevel; c: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", style: sv(c) } as const;
  switch (id) {
    case "guest":
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2 5.2-2z" /></svg>;
    case "neophyte":
      return <svg {...p}><path d="M12 20v-7" /><path d="M12 13c0-2.4-2-4.3-4.4-4.3H6.2C6.2 11 8.1 13 10.5 13H12z" /><path d="M12 11.5c0-2.7 2.2-4.9 4.9-4.9h1.1c0 2.7-2.2 4.9-4.9 4.9H12z" /></svg>;
    case "practicing":
      return <svg {...p}><path d="M3 18.5h18" /><path d="M6.4 18.5a5.6 5.6 0 0 1 11.2 0" /><path d="M12 4.5v2.2M4.7 8.6l1.5 1.5M19.3 8.6l-1.5 1.5" /></svg>;
    case "initiated":
      return <svg {...p}><path d="M12 22a6 6 0 0 0 6-6c0-4.2-4-6.2-4-10.2 0 0-3 2-3 5 0 1.6-1 2.2-1.6 2.8A6 6 0 0 0 12 22z" /><path d="M12 20a2.6 2.6 0 0 0 2.6-2.6c0-1.9-2.6-3.1-2.6-5.2 0 0-2 1.3-2 3.6A2.6 2.6 0 0 0 12 20z" /></svg>;
    case "guru":
      return <svg {...p}><circle cx="12" cy="12" r="3.4" /><path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.7 5.7l1.9 1.9M16.4 16.4l1.9 1.9M18.3 5.7l-1.9 1.9M5.7 18.3l1.9-1.9" /></svg>;
  }
}
function IcCheck({ c = ON_GOLD }: { c?: string }) { return <svg width={13} height={13} viewBox="0 0 24 24" style={sv(c, 3)}><path d="M20 6L9 17l-5-5" /></svg>; }

/* ── Кнопки: золотая таблетка (как «Соблюдаю пост» на Экадаши) + вторичные. ── */
function PrimaryBtn({ label, onClick, disabled, busy }: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button className="onb-press" onClick={onClick} disabled={disabled || busy}
      style={{
        width: "100%", padding: "17px 20px", borderRadius: 16, border: "none",
        cursor: disabled || busy ? "default" : "pointer", background: GOLD, color: ON_GOLD,
        fontFamily: TEXT, fontSize: "var(--text-body)", fontWeight: 640, letterSpacing: 0.2, opacity: disabled ? 0.5 : 1,
        boxShadow: "0 6px 18px rgba(210,170,27,0.20)", WebkitTapHighlightColor: "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
      {busy && <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${ON_GOLD}`, borderTopColor: "transparent", display: "inline-block", animation: "onbSpin .7s linear infinite" }} />}
      {label}
    </button>
  );
}
function SubtleBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="onb-press" onClick={onClick} disabled={disabled}
      style={{ width: "100%", padding: "15px 20px", borderRadius: 16, border: "none", background: "transparent", color: INK2, fontFamily: TEXT, fontSize: "var(--text-callout)", fontWeight: 550, cursor: "pointer", WebkitTapHighlightColor: "transparent", opacity: disabled ? 0.5 : 1 }}>
      {label}
    </button>
  );
}

export function Onboarding({ navigate, onClose }: { navigate: (path: string) => void; onClose?: () => void }) {
  const { user, status, updateProfile } = useAuth();
  const local = getLocalDevotee();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
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

  function go(n: number) {
    // Вошедшему шаг входа не нужен — перешагиваем в обе стороны.
    if (n === 4 && status === "authed") n = dirOf(n) >= 0 ? 5 : 3;
    setDir(n >= step ? 1 : -1); setStep(n);
  }
  const dirOf = (n: number) => (n >= step ? 1 : -1);
  function goBack() { go(Math.max(0, step - 1)); }

  /** Зафиксировать ответы онбординга локально — вызывается и из finish(), и
   *  ПЕРЕД уходом на сайт провайдера (OAuth покидает страницу; после колбэка
   *  оверлей уже не должен показываться, а уровень — не потеряться). */
  function commitLocal() {
    setLocalDevotee({ level: level || "", name: name.trim(), spiritualName: spiritual.trim(), dikshaGuru: guru.trim(), chantNorm: practicing ? norm : undefined });
    markOnboarded();
  }

  function finish(navTo?: string) {
    if (busy) return;
    setBusy(true);
    const lv = level || "";
    commitLocal();
    onClose?.();
    if (navTo) navigate(navTo);
    if (status === "authed") {
      void updateProfile({
        name: name.trim(), spiritualName: spiritual.trim(), level: lv,
        dikshaGuru: initiated ? guru.trim() : "",
        ...(practicing ? { chantNorm: norm } : {}),
      }).catch(() => {});
    }
  }

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try { await enablePush(); } catch { /* мягкий отказ */ } finally { setPushBusy(false); }
    go(4);
  }

  const wrap: CSSProperties = { position: "fixed", inset: 0, zIndex: 5000, background: BG, display: "flex", justifyContent: "center", fontFamily: TEXT, overflow: "hidden", overscrollBehavior: "contain" };
  const shell: CSSProperties = { width: "100%", maxWidth: 480, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 };
  const header: CSSProperties = { padding: "calc(12px + env(safe-area-inset-top)) 20px 0" };
  const main: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 24px", display: "flex", flexDirection: "column" };
  const footer: CSSProperties = { padding: "12px 24px calc(20px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 2 };
  const h1: CSSProperties = { fontFamily: DISPLAY, fontSize: "var(--text-title1)", fontWeight: 700, color: INK, lineHeight: 1.12, letterSpacing: -0.5, margin: 0 };
  const sub: CSSProperties = { fontSize: "var(--text-body)", lineHeight: 1.45, color: INK2, margin: "13px 0 0", fontWeight: 400 };
  const groupCard: CSSProperties = { background: CARD, borderRadius: 18, border: `0.5px solid ${HAIR}`, boxShadow: SHADOW, overflow: "hidden" };
  const rowStyle: CSSProperties = { display: "flex", alignItems: "center", minHeight: 56, padding: "0 16px" };
  const input: CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: "var(--text-body)", color: INK, fontFamily: TEXT, padding: "16px 0" };
  const hair = <div style={{ height: "0.5px", background: HAIR, marginLeft: 16 }} />;
  const stepClass = dir >= 0 ? "onb-fwd" : "onb-back";

  const Dots = () => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 18 }}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} style={{ width: step === i ? 22 : 6, height: 6, borderRadius: 6, background: step === i ? GOLD : step > i ? "rgba(210,170,27,0.4)" : "rgba(120,120,128,0.28)", transition: "all .3s cubic-bezier(.16,1,.3,1)" }} />
      ))}
    </div>
  );
  const chromeSteps = step >= 1 && step <= 4;
  const Header = () => (
    <div style={header}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 30 }}>
        <button className="onb-press" aria-label="Назад" onClick={goBack} style={{ background: "none", border: "none", padding: 6, margin: -6, cursor: "pointer", display: "flex", WebkitTapHighlightColor: "transparent" }}><IcChevron /></button>
        {step <= 2
          ? <button className="onb-press" onClick={() => finish()} style={{ background: "none", border: "none", color: INK2, fontFamily: TEXT, fontSize: "var(--text-callout)", fontWeight: 500, cursor: "pointer", padding: "6px 2px", WebkitTapHighlightColor: "transparent" }}>Пропустить</button>
          : <span style={{ width: 20 }} />}
      </div>
      <Dots />
    </div>
  );
  /* Тонированный чип-подставка под иконку (как soft-surface в приложении). */
  const Chip = ({ children, on }: { children: ReactNode; on?: boolean }) => (
    <div style={{ width: 44, height: 44, borderRadius: 12, flex: "0 0 auto", display: "grid", placeItems: "center", background: on ? GOLD : GOLD_SOFT, transition: "background .2s" }}>{children}</div>
  );

  let content: ReactNode = null;
  let foot: ReactNode = null;

  if (step === 0) {
    content = (
      <div style={{ ...main, justifyContent: "center", alignItems: "center", textAlign: "center", paddingTop: "env(safe-area-inset-top)" }}>
        <img className="onb-rise" src="/iskcon-one-love-mark.svg" alt="" width={104} height={104} style={{ marginBottom: 30 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div className="onb-rise" style={{ animationDelay: ".08s", fontSize: "var(--text-footnote)", fontWeight: 700, letterSpacing: 2.5, color: GOLD, textTransform: "uppercase" }}>Харе Кришна</div>
        <h1 className="onb-rise" style={{ ...h1, animationDelay: ".16s", fontSize: "var(--text-display)", maxWidth: 340, marginTop: 14 }}>Добро пожаловать<br />в ISKCON ONE LOVE</h1>
        <p className="onb-rise" style={{ ...sub, animationDelay: ".24s", maxWidth: 322 }}>Ваш дом в сознании Кришны: священные тексты, святые имена, вайшнавский календарь, даршаны и живая садхана — в одном месте.</p>
      </div>
    );
    foot = <div style={footer} className="onb-rise"><div style={{ animationDelay: ".32s" }}><PrimaryBtn label="Начать" onClick={() => go(1)} /></div></div>;
  } else if (step === 1) {
    content = (
      <div key="s1" className={stepClass} style={main}>
        <h1 style={{ ...h1, marginTop: 18 }}>Где вы на духовном пути?</h1>
        <p style={sub}>Это настроит приложение под вас. Ответ можно изменить в любой момент.</p>
        <div style={{ ...groupCard, marginTop: 22, marginBottom: 16 }}>
          {LEVEL_META.map((o, i) => {
            const on = level === o.id;
            return (
              <div key={o.id}>
                {i > 0 && hair}
                <button className="onb-tile" onClick={() => { setLevel(o.id); setTimeout(() => go(2), 170); }}
                  style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", width: "100%", padding: "12px 16px", background: on ? GOLD_SOFT : "transparent", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  <Chip on={on}><LevelIcon id={o.id} c={on ? ON_GOLD : GOLD} /></Chip>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "var(--text-body)", fontWeight: 600, color: INK, fontFamily: TEXT }}>{o.label}</span>
                    <span style={{ display: "block", fontSize: "var(--text-footnote)", color: INK2, fontFamily: TEXT, marginTop: 1 }}>{o.hint}</span>
                  </span>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", flex: "0 0 auto", display: "grid", placeItems: "center", background: on ? GOLD : "transparent", border: on ? "none" : `1.6px solid ${INK3}` }}>{on && <IcCheck />}</span>
                </button>
              </div>
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
        <div style={{ ...groupCard, marginTop: 22 }}>
          <div style={rowStyle}><input style={input} placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></div>
          {initiated && <>{hair}<div style={rowStyle}><input style={input} placeholder="Духовное имя" value={spiritual} onChange={(e) => setSpiritual(e.target.value)} autoComplete="off" /></div></>}
          {initiated && <>{hair}<div style={rowStyle}><input style={input} placeholder="Дикша-гуру" value={guru} onChange={(e) => setGuru(e.target.value)} autoComplete="off" /></div></>}
          {practicing && (
            <>{hair}
              <div style={{ ...rowStyle, justifyContent: "space-between" }}>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "var(--text-body)", color: INK, fontFamily: TEXT }}>Норма кругов в день</span>
                  <span style={{ fontSize: "var(--text-footnote)", color: INK3, fontFamily: TEXT, marginTop: 1 }}>16 — стандарт для инициированных</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 2, background: FILL, borderRadius: 11, padding: 3 }}>
                  <button className="onb-press" aria-label="Меньше" onClick={() => setNorm((n) => Math.max(1, n - 1))} style={stepBtn}>−</button>
                  <span style={{ minWidth: 32, textAlign: "center", fontSize: "var(--text-body)", fontWeight: 650, color: INK, fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>{norm}</span>
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
    content = (
      <div key="s3" className={stepClass} style={{ ...main, textAlign: "center" }}>
        <div style={{ flex: "0 0 auto", height: 6 }} />
        {/* Образ: превью реального уведомления — по языку Apple Fitness. */}
        <div style={{ margin: "8px auto 26px", width: "100%", maxWidth: 320, background: FILL, borderRadius: 26, padding: "22px 16px 18px" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "var(--text-display)", fontWeight: 300, color: INK3, letterSpacing: 1, lineHeight: 1, marginBottom: 16 }}>09:41</div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", background: CARD, borderRadius: 15, border: `0.5px solid ${HAIR}`, boxShadow: SHADOW, padding: "11px 13px" }}>
            <img src="/iskcon-one-love-mark.svg" alt="" width={34} height={34} style={{ flex: "0 0 auto" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "var(--text-footnote)", fontWeight: 700, color: INK, fontFamily: TEXT, letterSpacing: 0.2 }}>ISKCON ONE LOVE</span>
              <span style={{ display: "block", fontSize: "var(--text-footnote)", color: INK2, fontFamily: TEXT, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Стих дня · «Бхагавад-гита» 1.1</span>
            </span>
          </div>
        </div>
        <h1 style={{ ...h1, maxWidth: 320, margin: "0 auto" }}>Тихие напоминания<br />о практике</h1>
        <p style={{ ...sub, maxWidth: 322, margin: "13px auto 0" }}>
          {supported
            ? "Стих дня по утрам, канун Экадаши, праздники календаря и мягкое напоминание, если норма кругов ещё не закрыта. Без шума — только важное."
            : "На этом устройстве уведомления недоступны. На iPhone добавьте приложение на экран «Домой» через «Поделиться» → «На экран „Домой“», и они заработают."}
        </p>
        <div style={{ flex: 1, minHeight: 16 }} />
      </div>
    );
    foot = supported
      ? <div style={footer}><PrimaryBtn label={pushBusy ? "Подключаем…" : "Включить уведомления"} busy={pushBusy} onClick={() => void togglePush()} /><SubtleBtn label="Не сейчас" onClick={() => go(4)} disabled={pushBusy} /></div>
      : <div style={footer}><PrimaryBtn label="Далее" onClick={() => go(4)} /></div>;
  } else if (step === 4) {
    content = (
      <div key="s5" className={stepClass} style={main}>
        <h1 style={{ ...h1, marginTop: 18 }}>Сохраните свой путь</h1>
        <p style={sub}>Вход синхронизирует садхану, закладки, обеты и прогресс чтения на всех ваших устройствах.</p>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          <ProviderButtons to="/" beforeLeave={commitLocal} />
          <button className="onb-press" onClick={() => finish(ROUTES.id())}
            style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 50, borderRadius: 14, cursor: "pointer", background: CARD, color: INK, border: `0.5px solid ${HAIR}`, boxShadow: SHADOW, fontFamily: TEXT, fontSize: "var(--text-body)", fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>
            <span style={{ position: "absolute", left: 16, display: "grid", placeItems: "center" }}><IcMail /></span>
            Войти по почте
          </button>
        </div>
        <p style={{ margin: "16px 4px 0", fontSize: "var(--text-caption)", lineHeight: 1.5, color: INK3, fontFamily: TEXT, textAlign: "center" }}>
          Можно продолжить и без входа — всё сохранится на этом устройстве.
        </p>
        <div style={{ flex: 1 }} />
      </div>
    );
    foot = <div style={footer}><SubtleBtn label="Позже" onClick={() => go(5)} /></div>;
  } else {
    const nm = name.trim();
    const lvHint = level === "guest"
      ? "Начните с даршанов и стиха дня — почувствуйте атмосферу вайшнавской традиции."
      : level === "neophyte"
      ? "Первые шаги — святое имя и «Бхагавад-гита». Всё готово, чтобы начать."
      : "Ваша садхана ждёт. Начните с кругов джапы — счётчик и стрик уже настроены.";
    const cta = practicing ? { label: "Начать джапу", to: "/japa" as string | undefined }
      : level === "neophyte" ? { label: "Открыть «Бхагавад-гиту»", to: "/books/bg" }
      : { label: "Войти в приложение", to: undefined };
    content = (
      <div key="s4" className="onb-rise" style={{ ...main, justifyContent: "center", alignItems: "center", textAlign: "center", paddingTop: "env(safe-area-inset-top)" }}>
        <img src="/iskcon-one-love-mark.svg" alt="" width={100} height={100} style={{ marginBottom: 28 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div style={{ fontSize: "var(--text-footnote)", fontWeight: 700, letterSpacing: 2.5, color: GOLD, textTransform: "uppercase" }}>Всё готово</div>
        <h1 style={{ ...h1, maxWidth: 330, marginTop: 12 }}>{nm ? `Харе Кришна, ${nm}!` : "Добро пожаловать домой"}</h1>
        <p style={{ ...sub, maxWidth: 320 }}>{lvHint}</p>
      </div>
    );
    foot = <div style={footer}><PrimaryBtn label={cta.label} busy={busy} onClick={() => finish(cta.to)} /></div>;
  }

  return (
    <div className="onb-root" style={wrap}>
      <style>{CSS}</style>
      <div style={shell}>
        {chromeSteps && <Header />}
        {content}
        {foot}
      </div>
    </div>
  );
}

const stepBtn: CSSProperties = { width: 34, height: 34, borderRadius: 9, border: "none", background: "transparent", color: INK, fontFamily: TEXT, fontSize: "var(--text-title2)", fontWeight: 500, lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" };

/**
 * Онбординг (Ц2) — первые ~60 секунд. Самогейтящийся полноэкранный оверлей:
 * сам решает, показываться ли (флаг onboarded в localStorage; вошедшему преданному
 * со ступенью — не мешает). Ветвится по ступени (Ц1): практикующим — норма кругов,
 * инициированным — духовное имя и гуру. В конце — мягкое предложение уведомлений
 * (Ц3). Ответы пишем локально (гость получает персонализацию сразу) и на сервер,
 * если преданный вошёл. Форс-регистрации нет — вход остаётся в кабинете.
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "./account/store";
import { enablePush, pushSupported } from "./push";
import { isOnboarded, markOnboarded, setLocalDevotee, getLocalDevotee, LEVEL_META } from "./devotee";
import type { DevoteeLevel } from "./account/api";

const GOLD = "#D2AA1B";
const BG = "var(--color-bg)";
const INK = "var(--color-label)";
const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";
const SURF = "var(--color-bg-2)";
const HAIR = "var(--color-hairline)";
const FONT = "var(--font-text)";

function PrimaryBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        width: "100%", padding: "15px 20px", borderRadius: 14, border: "none", cursor: disabled ? "default" : "pointer",
        background: GOLD, color: "#1a1400", fontFamily: FONT, fontSize: 17, fontWeight: 650, letterSpacing: 0.2,
        opacity: disabled ? 0.55 : 1, boxShadow: "0 6px 20px rgba(210,170,27,0.25)", WebkitTapHighlightColor: "transparent",
      }}
    >
      {label}
    </button>
  );
}
function GhostBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "13px 20px", borderRadius: 14, border: "none", background: "transparent", color: INK2, fontFamily: FONT, fontSize: 16, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
      {label}
    </button>
  );
}

export function Onboarding({ navigate }: { navigate: (path: string) => void }) {
  const { user, status, updateProfile } = useAuth();
  const local = getLocalDevotee();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [level, setLevel] = useState<DevoteeLevel | "">(user?.level ?? local.level ?? "");
  const [name, setName] = useState(user?.name ?? local.name ?? "");
  const [spiritual, setSpiritual] = useState(user?.spiritualName ?? local.spiritualName ?? "");
  const [guru, setGuru] = useState(user?.dikshaGuru ?? local.dikshaGuru ?? "");
  const [norm, setNorm] = useState(local.chantNorm ? String(local.chantNorm) : "16");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const supported = pushSupported();

  const practicing = level === "practicing" || level === "initiated" || level === "guru";
  const initiated = level === "initiated" || level === "guru";

  // Гейт — после всех хуков: не мешаем вошедшему со ступенью и во время загрузки сессии.
  const show = !dismissed && status !== "loading" && !isOnboarded() && !(status === "authed" && !!user?.level);
  if (!show) return null;

  const normNum = (() => { const n = parseInt(norm, 10); return Number.isFinite(n) && n >= 1 && n <= 64 ? n : 0; })();

  async function finish(navTo?: string) {
    const lv = level || "";
    setLocalDevotee({ level: lv, name: name.trim(), spiritualName: spiritual.trim(), dikshaGuru: guru.trim(), chantNorm: practicing && normNum ? normNum : undefined });
    markOnboarded();
    if (status === "authed") {
      try {
        await updateProfile({
          name: name.trim(), spiritualName: spiritual.trim(), level: lv,
          dikshaGuru: initiated ? guru.trim() : "",
          ...(practicing && normNum ? { chantNorm: normNum } : {}),
        });
      } catch { /* локально уже сохранено */ }
    }
    setDismissed(true);
    if (navTo) navigate(navTo);
  }

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try { const r = await enablePush(); setPushOn(r.ok); } finally { setPushBusy(false); }
    setStep(4);
  }

  const wrap: CSSProperties = { position: "fixed", inset: 0, zIndex: 5000, background: BG, display: "flex", flexDirection: "column", fontFamily: FONT };
  const body: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "0 24px", display: "flex", flexDirection: "column" };
  const footer: CSSProperties = { padding: "12px 24px calc(20px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 4 };
  const h1: CSSProperties = { fontSize: 27, fontWeight: 700, color: INK, lineHeight: 1.18, letterSpacing: -0.3, margin: 0 };
  const sub: CSSProperties = { fontSize: 16, lineHeight: 1.5, color: INK2, margin: "12px 0 0" };
  const fieldCard: CSSProperties = { background: SURF, borderRadius: 14, border: `0.5px solid ${HAIR}`, overflow: "hidden" };
  const inputRow: CSSProperties = { display: "flex", alignItems: "center", minHeight: 52, padding: "0 16px" };
  const input: CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 17, color: INK, fontFamily: FONT, padding: "14px 0" };
  const hair = <div style={{ height: "0.5px", background: HAIR, marginLeft: 16 }} />;

  const Dots = () => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "14px 0 4px" }}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} style={{ width: step === i ? 20 : 6, height: 6, borderRadius: 6, background: step >= i ? GOLD : "rgba(120,120,128,0.28)", transition: "all .25s" }} />
      ))}
    </div>
  );
  const SkipTop = ({ onSkip }: { onSkip: () => void }) => (
    <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "calc(10px + env(safe-area-inset-top))" }}>
      <button onClick={onSkip} style={{ background: "none", border: "none", color: INK3, fontFamily: FONT, fontSize: 15, cursor: "pointer", padding: "6px 2px" }}>Пропустить</button>
    </div>
  );

  let content: ReactNode = null;
  let foot: ReactNode = null;

  if (step === 0) {
    content = (
      <div style={{ ...body, justifyContent: "center", alignItems: "center", textAlign: "center", paddingTop: "env(safe-area-inset-top)" }}>
        <img src="/iskcon-one-love-mark.svg" alt="" width={92} height={92} style={{ marginBottom: 26 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 2, color: GOLD, textTransform: "uppercase", marginBottom: 12 }}>Харе Кришна</div>
        <h1 style={{ ...h1, fontSize: 30, maxWidth: 340 }}>Добро пожаловать в ISKCON ONE LOVE</h1>
        <p style={{ ...sub, maxWidth: 330 }}>Ваш дом в сознании Кришны: священные тексты, святые имена, вайшнавский календарь, даршаны и живая практика — в одном месте.</p>
      </div>
    );
    foot = <div style={footer}><PrimaryBtn label="Начать" onClick={() => setStep(1)} /></div>;
  } else if (step === 1) {
    content = (
      <div style={body}>
        <SkipTop onSkip={() => void finish()} />
        <Dots />
        <h1 style={{ ...h1, marginTop: 14 }}>Где вы на духовном пути?</h1>
        <p style={sub}>Это поможет настроить приложение под вас. Ответ можно изменить в любой момент.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22, paddingBottom: 12 }}>
          {LEVEL_META.map((o) => {
            const on = level === o.id;
            return (
              <button
                key={o.id}
                onClick={() => { setLevel(o.id); setStep(2); }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, textAlign: "left",
                  padding: "14px 16px", borderRadius: 14, cursor: "pointer", background: on ? "color-mix(in srgb, #D2AA1B 12%, transparent)" : SURF,
                  border: `1px solid ${on ? GOLD : HAIR}`, WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{ fontSize: 17, fontWeight: 600, color: INK, fontFamily: FONT }}>{o.label}</span>
                <span style={{ fontSize: 13.5, color: INK2, fontFamily: FONT }}>{o.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  } else if (step === 2) {
    content = (
      <div style={body}>
        <SkipTop onSkip={() => void finish()} />
        <Dots />
        <h1 style={{ ...h1, marginTop: 14 }}>Немного о вас</h1>
        <p style={sub}>{initiated ? "Как к вам обращаться, ваше духовное имя и учитель." : practicing ? "Как к вам обращаться и ваша норма святого имени." : "Как к вам обращаться? Можно пропустить."}</p>
        <div style={{ ...fieldCard, marginTop: 20 }}>
          <div style={inputRow}><input style={input} placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} /></div>
          {initiated && <>{hair}<div style={inputRow}><input style={input} placeholder="Духовное имя" value={spiritual} onChange={(e) => setSpiritual(e.target.value)} /></div></>}
          {initiated && <>{hair}<div style={inputRow}><input style={input} placeholder="Дикша-гуру" value={guru} onChange={(e) => setGuru(e.target.value)} /></div></>}
          {practicing && (
            <>{hair}
              <div style={inputRow}>
                <span style={{ fontSize: 17, color: INK, fontFamily: FONT }}>Норма кругов в день</span>
                <input inputMode="numeric" style={{ ...input, textAlign: "right", flex: "0 0 auto", width: 64 }} value={norm} onChange={(e) => setNorm(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} />
              </div>
            </>
          )}
        </div>
        <div style={{ flex: 1 }} />
      </div>
    );
    foot = <div style={footer}><PrimaryBtn label="Далее" onClick={() => setStep(3)} /><GhostBtn label="Назад" onClick={() => setStep(1)} /></div>;
  } else if (step === 3) {
    content = (
      <div style={{ ...body, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <Dots />
        <div style={{ flex: 1 }} />
        <div style={{ width: 76, height: 76, borderRadius: 20, background: "color-mix(in srgb, #D2AA1B 14%, transparent)", display: "grid", placeItems: "center", marginBottom: 22 }}>
          <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        </div>
        <h1 style={{ ...h1, maxWidth: 320 }}>Тихие напоминания о практике</h1>
        <p style={{ ...sub, maxWidth: 320 }}>{supported ? "Стих дня по утрам, канун Экадаши, праздники календаря и мягкое напоминание, если норма кругов ещё не закрыта. Без шума — только важное." : "На этом устройстве уведомления недоступны. Для iPhone добавьте приложение на домашний экран."}</p>
        <div style={{ flex: 1 }} />
      </div>
    );
    foot = supported
      ? <div style={footer}><PrimaryBtn label={pushBusy ? "Подключаем…" : "Включить уведомления"} disabled={pushBusy} onClick={() => void togglePush()} /><GhostBtn label="Не сейчас" onClick={() => setStep(4)} /></div>
      : <div style={footer}><PrimaryBtn label="Далее" onClick={() => setStep(4)} /></div>;
  } else {
    const lvHint = level === "guest" ? "Начните с даршанов и стиха дня — почувствуйте атмосферу." : level === "neophyte" ? "Сделайте первые шаги: святое имя и «Бхагавад-гита»." : "Ваша садхана ждёт. Начните с кругов джапы.";
    const goJapa = practicing;
    content = (
      <div style={{ ...body, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 46, marginBottom: 10 }}>🙏</div>
        <h1 style={{ ...h1, maxWidth: 320 }}>{name.trim() ? `Харе Кришна, ${name.trim()}!` : "Всё готово"}</h1>
        <p style={{ ...sub, maxWidth: 320 }}>{lvHint}</p>
        <div style={{ flex: 1 }} />
      </div>
    );
    foot = <div style={footer}><PrimaryBtn label={goJapa ? "Начать джапу" : "Войти в приложение"} onClick={() => void finish(goJapa ? "/practice/japa" : undefined)} /></div>;
  }

  return (
    <div style={wrap}>
      {content}
      {foot}
    </div>
  );
}

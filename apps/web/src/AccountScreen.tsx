/**
 * Личный кабинет — экран вкладки «account».
 *
 * Гость видит панель входа/регистрации (сегмент-контрол, e-mail + пароль) в
 * стиле iOS. Вошедший — дашборд садханы: профиль, метрики (прочитано /
 * прослушано / сохранено / книг), «продолжить чтение», «вы слушали»,
 * закладки и «моя библиотека» (выводится из истории чтения). Всё тянется из
 * D1 одним запросом GET /api/me/overview.
 *
 * Визуальный язык — сгруппированные карточки iOS (белые на светло-сером),
 * акцент — девотическое золото #D2AA1B; основное действие — графитовая кнопка.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "./account/store";
import { replaceUrl } from "./nav";
import { ROUTES, SITE_HOST } from "./routes";
import { accountClient, ApiError, type Overview, type ReadingItem, type ListenItem, type BookmarkItem, type SadhanaState, type DevoteeLevel, type Initiation, type IdentityItem } from "./account/api";
import { ProviderButtons, PROVIDER_META, PROVIDER_NAME, providerGlyph, oauthStartUrl, useAuthProviders, type ProviderId } from "./account/providers";
import { usePlayer } from "./player/store";
import { BOOKS, bookFullTitle, bookSlug } from "./books";
import { albumById } from "./kirtans";
import { useNotes, requestNote, requestOpenNote, shareNote, togglePin, type Note } from "./notes";
import { NoteHeroCard } from "./NoteHeroCard";
import { pushSupported, pushPermission, isSubscribed, enablePush, disablePush, updateCats, loadCats, type PushCats } from "./push";
import { levelLabel, atLeastLevel } from "./devotee";
import { plural } from "./ui/primitives";   // ЗКН-Д002: одна функция, не копия

/* ─────────────────────────── палитра/токены ─────────────────────────── */

const GOLD = "var(--color-gold)";
const GOLDT = "#9c7c15";
const GROUPED = "#f2f2f7";
const SURFACE = "var(--color-bg-2)";
const INK = "var(--color-label)";
const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";
const HAIR = "var(--color-hairline)";
const FONT = "var(--font-text)";

/* ─────────────────────────── мелкие иконки ─────────────────────────── */

interface IcoProps {
  size?: number;
}
const ico = (size = 22) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STR = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ChevR = ({ size = 18 }: IcoProps) => (
  <svg {...ico(size)}><path {...STR} d="M9 5l7 7-7 7" /></svg>
);
const PencilIco = ({ size = 18 }: IcoProps) => (
  <svg {...ico(size)}><path {...STR} d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
const BellIco = ({ size = 18 }: IcoProps) => (
  <svg {...ico(size)}><path {...STR} d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path {...STR} d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
);
const HeartIco = ({ size = 18 }: IcoProps) => (
  <svg {...ico(size)}><path fill="currentColor" d="M12 21s-7.5-4.6-10-9.2C.6 8.9 2 5.6 5.1 5.1 7 4.8 8.8 5.8 9.7 7.4 10.6 5.8 12.4 4.8 14.3 5.1c3.1.5 4.5 3.8 3.1 6.7C19.5 16.4 12 21 12 21Z" /></svg>
);
const BookIco = ({ size = 20 }: IcoProps) => (
  <svg {...ico(size)}><path {...STR} d="M12 6.6C10.4 5.4 8.3 4.9 5.5 5.3A1 1 0 0 0 4.6 6.3v10.9a1 1 0 0 0 1.1 1c2.5-.34 4.6.1 6.3 1.3 1.7-1.2 3.8-1.64 6.3-1.3a1 1 0 0 0 1.1-1V6.3a1 1 0 0 0-.9-1C15.7 4.9 13.6 5.4 12 6.6Z" /><path {...STR} d="M12 6.6v12.2" /></svg>
);
const HeartGift = ({ size = 20 }: IcoProps) => (
  <svg {...ico(size)}><path {...STR} d="M12 20s-6.5-4-8.5-8C2.2 9.4 3.4 6.7 6 6.3c1.6-.25 3.1.6 3.9 2 .8-1.4 2.3-2.25 3.9-2 2.6.4 3.8 3.1 2.5 5.7C18.5 16 12 20 12 20Z" /></svg>
);
const SignOutIco = ({ size = 20 }: IcoProps) => (
  <svg {...ico(size)}><path {...STR} d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" /><path {...STR} d="M10 8l-4 4 4 4" /><path {...STR} d="M6 12h11" /></svg>
);
const TempleIco = ({ size = 20 }: IcoProps) => (
  <svg {...ico(size)}><path {...STR} d="M12 3l5 3.2H7L12 3Z" /><path {...STR} d="M7 6.2v2.5M17 6.2v2.5M5 20v-7M19 20v-7M9.5 20v-4.5a2.5 2.5 0 0 1 5 0V20" /><path {...STR} d="M3.5 20h17M4.5 13h15" /></svg>
);
const EyeIco = ({ size = 20, off }: IcoProps & { off?: boolean }) =>
  off ? (
    <svg {...ico(size)}><path {...STR} d="M3 3l18 18" /><path {...STR} d="M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 9 5 9 7a12 12 0 0 1-2.2 2.7M6.3 6.3C3.7 7.9 2 10.7 2 12c0 2 4 7 9 7a9.7 9.7 0 0 0 3.6-.7" /><path {...STR} d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
  ) : (
    <svg {...ico(size)}><path {...STR} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle {...STR} cx="12" cy="12" r="3" /></svg>
  );
const NoteIco = ({ size = 20 }: IcoProps) => (
  <svg {...ico(size)}><path {...STR} d="M6 3.6h7.4L18.4 8.6V20a.9.9 0 0 1-.9.9H6a.9.9 0 0 1-.9-.9V4.5A.9.9 0 0 1 6 3.6Z" /><path {...STR} d="M13.2 3.7v4.6a.6.6 0 0 0 .6.6h4.4" /><path {...STR} d="M8 12.4h6.6M8 15.4h6.6M8 18.2h3.8" /></svg>
);
const PlusIco = ({ size = 16 }: IcoProps) => (
  <svg {...ico(size)}><path {...STR} d="M12 5v14M5 12h14" /></svg>
);

/* ─────────────────────────── утилиты ─────────────────────────── */

function initials(name: string | null, email: string | null): string {
  const src = (name || "").trim();
  if (src) {
    const parts = src.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase() || a.toUpperCase();
  }
  const e = (email || "").trim();
  return e ? e[0].toUpperCase() : "॥";
}

function errorText(code: string): string {
  switch (code) {
    case "bad_email":
      return "Проверьте адрес e-mail.";
    case "weak_password":
      return "Пароль должен быть не короче 8 символов.";
    case "email_taken":
      return "Этот e-mail уже зарегистрирован. Войдите.";
    case "bad_credentials":
      return "Неверный e-mail или пароль.";
    case "unauthorized":
      return "Сессия истекла. Войдите снова.";
    case "bad_code":
      return "Код не подошёл или устарел. Запросите новый.";
    case "last_method":
      return "Нельзя отключить единственный способ входа. Сначала задайте пароль.";
    case "no_email":
      return "У аккаунта нет почты — добавьте её в профиле.";
    case "cancelled":
      return "Вход отменён.";
    case "identity_taken":
      return "Этот внешний аккаунт уже привязан к другому пользователю.";
    case "state":
      return "Сессия входа устарела. Попробуйте ещё раз.";
    case "provider":
    case "provider_off":
      return "Провайдер входа сейчас недоступен. Войдите по почте.";
    default:
      return "Что-то пошло не так. Попробуйте ещё раз.";
  }
}

/** Обложка/заголовок прочитанного — по машинному id книги. */
function bookMeta(work: string): { title: string; cover: string | null } {
  const b = BOOKS[work];
  if (b) return { title: bookFullTitle(b), cover: b.covers?.[0] ?? null };
  return { title: work.toUpperCase(), cover: null };
}

/* ─────────────────────────── общие подкомпоненты ─────────────────────────── */

function CoverBox({ src, w, h, radius = 10, label }: { src: string | null; w: number; h: number; radius?: number; label?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        style={{ width: w, height: h, objectFit: "cover", borderRadius: radius, flexShrink: 0, background: "var(--color-bg-3)", boxShadow: "0 1px 3px rgba(0,0,0,0.10)" }}
      />
    );
  }
  return (
    <div style={{ width: w, height: h, borderRadius: radius, flexShrink: 0, background: "var(--color-bg-3)", color: INK3, display: "grid", placeItems: "center", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: 0.4, textAlign: "center", padding: 4 }}>
      {label ?? ""}
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 4px", marginBottom: 10 }}>
      <h3 style={{ margin: 0, fontSize: "var(--text-title3)", fontWeight: 700, letterSpacing: -0.3, color: INK, fontFamily: FONT }}>{title}</h3>
      {action && (
        <button onClick={action.onClick} style={{ background: "none", border: "none", padding: 0, color: GOLD, fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── заметки садху ─────────────────────────── */


function NotesSection({ onOpenPath }: { onOpenPath: (p: string) => void }) {
  const notes = useNotes();
  const recent = [...notes]
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt)
    .slice(0, 6);
  const cardStyle: CSSProperties = { background: SURFACE, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden" };
  // На витрине ⋯ держит быстрые действия (закрепить/поделиться), остальное —
  // в подробной карточке: открываем её.
  const railMenu = (n: Note) => (mid: string) => {
    if (mid === "pin") togglePin(n.id);
    else if (mid === "share") shareNote(n);
    else requestOpenNote(n.id);
  };
  return (
    <section>
      <SectionTitle title="Заметки садху" action={notes.length ? { label: notes.length > recent.length ? `Все · ${notes.length}` : "Все", onClick: () => onOpenPath("/notes") } : undefined} />
      {recent.length > 0 ? (
        <HScroll>
          {recent.map((n) => (
            <div key={n.id} style={{ flex: "0 0 76%", maxWidth: 320, scrollSnapAlign: "start" }}>
              <NoteHeroCard note={n} onOpen={() => requestOpenNote(n.id)} onMenuSelect={railMenu(n)} />
            </div>
          ))}
          <div style={{ flex: "0 0 60%", maxWidth: 240, scrollSnapAlign: "start" }}>
            <button type="button" onClick={() => requestNote()}
              style={{ width: "100%", aspectRatio: "4 / 5", borderRadius: 20, border: `1.5px dashed ${GOLD}88`, background: "linear-gradient(135deg, rgba(251,244,216,0.5) 0%, rgba(241,225,164,0.4) 100%)", color: GOLDT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
              <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}><PlusIco size={24} /></span>
              <span style={{ fontSize: "var(--text-subhead)", fontWeight: 600 }}>Новая заметка</span>
            </button>
          </div>
        </HScroll>
      ) : (
        <div style={{ ...cardStyle, padding: "20px 18px", textAlign: "center" }}>
          <div style={{ width: 46, height: 46, margin: "0 auto 12px", borderRadius: 12, background: "linear-gradient(135deg, #fbf4d8 0%, #f1e1a4 100%)", color: GOLDT, display: "grid", placeItems: "center", border: `0.5px solid ${GOLD}55` }}><NoteIco size={24} /></div>
          <div style={{ fontSize: "var(--text-callout)", fontWeight: 700, color: INK, fontFamily: FONT, letterSpacing: -0.1 }}>Записывайте ценное</div>
          <p style={{ margin: "6px auto 16px", fontSize: "var(--text-footnote)", lineHeight: 1.5, color: INK2, fontFamily: FONT, maxWidth: 264 }}>Услышали стих или мысль, которую хочется сохранить, — добавьте её из меню «…» в любом разделе или начните прямо сейчас.</p>
          <button onClick={() => requestNote()} style={{ height: 44, padding: "0 20px", borderRadius: 13, border: "none", background: INK, color: "var(--color-bg-2)", fontFamily: FONT, fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Новая заметка</button>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── панель входа (гость) ─────────────────────────── */

/* ─────────────────────────── вход (гость) ───────────────────────────
 * Вход — это МОМЕНТ, а не форма под вкладками. Экран строится по-эпплски:
 * один знак, одно обещание, способы войти, ничего конкурирующего. Поля —
 * сгруппированная карточка с плавающими подписями (подпись не исчезает при
 * вводе, как это делает placeholder, — человек всегда видит, что заполняет).
 * Сегмент «Вход/Регистрация» убран: спрашивать это ДО ввода — лишний выбор,
 * режим переключается тихой строкой внизу.
 */

const AUTH_CSS = `
.iol-auth *{box-sizing:border-box}
.iol-f{position:relative;display:block}
.iol-f input{width:100%;height:58px;padding:23px 16px 7px;border:none;outline:none;background:transparent;
  font-family:var(--font-text);font-size:var(--text-body);color:var(--color-label);border-radius:0}
.iol-f input::placeholder{color:transparent}
.iol-f span.lbl{position:absolute;left:16px;top:19px;pointer-events:none;transform-origin:left top;
  font-family:var(--font-text);font-size:var(--text-body);color:var(--color-label-3);
  transition:transform .2s cubic-bezier(.2,.8,.2,1),color .2s}
.iol-f input:focus ~ span.lbl,.iol-f input:not(:placeholder-shown) ~ span.lbl{transform:translateY(-12px) scale(.76)}
.iol-f input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px var(--color-bg) inset;-webkit-text-fill-color:var(--color-label);caret-color:var(--color-label)}
.iol-group{transition:border-color .2s,box-shadow .2s}
.iol-group:focus-within{border-color:rgba(210,170,27,.5);box-shadow:0 0 0 3px rgba(210,170,27,.10)}
.iol-press{transition:transform .16s cubic-bezier(.2,.8,.2,1),opacity .16s}
.iol-press:active{transform:scale(.978)}
.iol-rise{animation:iolRise .5s cubic-bezier(.16,1,.3,1) both}
@keyframes iolRise{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.iol-rise{animation:none}}
`;

function Field({ label, value, onChange, type = "text", ...rest }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  autoComplete?: string; inputMode?: "email" | "numeric" | "text"; maxLength?: number;
  disabled?: boolean; onEnter?: () => void; trail?: ReactNode; mono?: boolean;
}) {
  const { autoComplete, inputMode, maxLength, disabled, onEnter, trail, mono } = rest;
  return (
    <div className="iol-f" style={{ display: "flex", alignItems: "center" }}>
      <label style={{ flex: 1, minWidth: 0, display: "block", position: "relative" }}>
      <input
        type={type}
        value={value}
        placeholder=" "
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        disabled={disabled}
        autoCapitalize="none"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
        style={mono ? { letterSpacing: 7, fontVariantNumeric: "tabular-nums" } : undefined}
      />
      <span className="lbl">{label}</span>
      </label>
      {trail && <span style={{ position: "absolute", right: 12, display: "grid", placeItems: "center" }}>{trail}</span>}
    </div>
  );
}

function AuthPanel() {
  const { login, register, refresh } = useAuth();
  const up = useAuthProviders();
  const [view, setView] = useState<"auth" | "reset">("auth");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ошибку OAuth-колбэка (?authError=…) показываем тем же инлайном и чистим адрес.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ae = q.get("authError");
    if (ae) {
      setError(errorText(ae));
      replaceUrl(window.location.pathname + window.location.hash);
    }
  }, []);

  const isReg = mode === "register";
  const emailOk = (em: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em);
  const hasProviders = !!up && PROVIDER_META.some((m) => up[m.id]);

  async function submitAuth() {
    if (busy) return;
    setError(null);
    const em = email.trim().toLowerCase();
    if (!emailOk(em)) { setError("Проверьте адрес e-mail."); return; }
    if (password.length < 8) { setError("Пароль должен быть не короче 8 символов."); return; }
    setBusy(true);
    try {
      if (isReg) await register(em, password, name.trim() || undefined);
      else await login(em, password);
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : ""));
    } finally { setBusy(false); }
  }

  async function submitResetEmail() {
    if (busy) return;
    setError(null);
    const em = email.trim().toLowerCase();
    if (!emailOk(em)) { setError("Проверьте адрес e-mail."); return; }
    setBusy(true);
    try { await accountClient.resetRequest(em); setPhase("code"); }
    catch { setError("Не получилось отправить код. Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }

  async function submitResetConfirm() {
    if (busy) return;
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) { setError("Введите 6 цифр из письма."); return; }
    if (password.length < 8) { setError("Пароль должен быть не короче 8 символов."); return; }
    setBusy(true);
    try {
      await accountClient.resetConfirm(email.trim().toLowerCase(), code.trim(), password);
      await refresh();
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : ""));
    } finally { setBusy(false); }
  }

  /* ── общие детали ── */
  const group: CSSProperties = { background: "var(--color-fill-1)", borderRadius: 16, border: "0.5px solid transparent", overflow: "hidden" };
  const hair = <div style={{ height: "0.5px", background: HAIR, marginLeft: 16 }} />;
  const title: CSSProperties = { margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.14, color: INK, textAlign: "center", whiteSpace: "pre-line" };
  const lead: CSSProperties = { margin: "10px 0 0", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: INK2, fontFamily: FONT, textAlign: "center", maxWidth: 312 };

  const Primary = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button className="iol-press" onClick={onClick} disabled={busy}
      style={{ width: "100%", height: 52, borderRadius: 14, border: "none", background: INK, color: "var(--color-bg-2)",
        fontFamily: FONT, fontSize: "var(--text-body)", fontWeight: 600, letterSpacing: -0.1,
        cursor: busy ? "default" : "pointer", opacity: busy ? 0.55 : 1, WebkitTapHighlightColor: "transparent" }}>
      {busy ? "Минуту…" : label}
    </button>
  );
  const Quiet = ({ label, onClick, tone = "gold" }: { label: string; onClick: () => void; tone?: "gold" | "ink" }) => (
    <button onClick={onClick} disabled={busy}
      style={{ background: "none", border: "none", padding: "10px 6px", color: tone === "gold" ? GOLDT : INK2,
        fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
      {label}
    </button>
  );
  const Err = () => error ? (
    <p style={{ margin: "12px 6px 0", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "var(--color-danger-text)", fontFamily: FONT, textAlign: "center" }}>{error}</p>
  ) : null;

  const Mark = () => (
    <img src="/iskcon-one-love-mark.svg" alt="" width={72} height={72}
      style={{ display: "block", margin: "0 auto 22px" }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
  );

  const shell = (children: ReactNode) => (
    <div className="iol-auth iol-rise" style={{ width: "100%", maxWidth: 366, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{AUTH_CSS}</style>
      {children}
    </div>
  );

  /* ── восстановление пароля ── */
  if (view === "reset") {
    return shell(
      <>
        <Mark />
        <h1 style={title}>{phase === "email" ? "Восстановление\nпароля" : "Проверьте почту"}</h1>
        <p style={lead}>
          {phase === "email"
            ? "Укажите адрес аккаунта — пришлём шестизначный код."
            : `Если аккаунт с адресом ${email.trim().toLowerCase()} существует, код уже в пути. Он действует 15 минут.`}
        </p>
        <div style={{ width: "100%", marginTop: 24 }}>
          <div className="iol-group" style={group}>
            <Field label="E-mail" type="email" inputMode="email" autoComplete="email" value={email}
              onChange={setEmail} disabled={phase === "code"} onEnter={() => phase === "email" && void submitResetEmail()} />
            {phase === "code" && (
              <>
                {hair}
                <Field label="Код из письма" inputMode="numeric" maxLength={6} autoComplete="one-time-code" mono
                  value={code} onChange={(v) => setCode(v.replace(/\D/g, ""))} />
                {hair}
                <Field label="Новый пароль" type={showPw ? "text" : "password"} autoComplete="new-password"
                  value={password} onChange={setPassword} onEnter={() => void submitResetConfirm()}
                  trail={<button type="button" aria-label={showPw ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowPw((s) => !s)}
                    style={{ background: "none", border: "none", padding: 6, color: INK3, cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" }}>
                    <EyeIco off={showPw} /></button>} />
              </>
            )}
          </div>
          <Err />
          <div style={{ marginTop: 18 }}>
            {phase === "email"
              ? <Primary label="Отправить код" onClick={() => void submitResetEmail()} />
              : <Primary label="Сохранить и войти" onClick={() => void submitResetConfirm()} />}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 6 }}>
            {phase === "code" && <Quiet label="Прислать ещё раз" onClick={() => { setPhase("email"); setCode(""); setError(null); }} />}
            <Quiet tone="ink" label="Назад ко входу" onClick={() => { setView("auth"); setPhase("email"); setCode(""); setPassword(""); setError(null); }} />
          </div>
        </div>
      </>,
    );
  }

  /* ── вход / регистрация ── */
  return shell(
    <>
      <Mark />
      <h1 style={title}>{isReg ? "Создать аккаунт" : "С возвращением"}</h1>
      <p style={lead}>
        {isReg
          ? "Садхана, закладки и прогресс чтения — на всех ваших устройствах."
          : "Войдите, и садхана продолжится там, где вы остановились."}
      </p>

      <div style={{ width: "100%", marginTop: 26 }}>
        {/* внешние аккаунты */}
        <ProviderButtons to={ROUTES.id()} />
        {hasProviders && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "18px 0" }}>
            <span style={{ flex: 1, height: "0.5px", background: HAIR }} />
            <span style={{ fontSize: "var(--text-footnote)", color: INK3, fontFamily: FONT }}>или по почте</span>
            <span style={{ flex: 1, height: "0.5px", background: HAIR }} />
          </div>
        )}

        <div className="iol-group" style={group}>
          {isReg && (<><Field label="Имя" autoComplete="name" value={name} onChange={setName} />{hair}</>)}
          <Field label="E-mail" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} />
          {hair}
          <Field label="Пароль" type={showPw ? "text" : "password"} value={password} onChange={setPassword}
            autoComplete={isReg ? "new-password" : "current-password"} onEnter={() => void submitAuth()}
            trail={<button type="button" aria-label={showPw ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowPw((s) => !s)}
              style={{ background: "none", border: "none", padding: 6, color: INK3, cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" }}>
              <EyeIco off={showPw} /></button>} />
        </div>

        <Err />

        <div style={{ marginTop: 18 }}>
          <Primary label={isReg ? "Создать аккаунт" : "Войти"} onClick={() => void submitAuth()} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 4 }}>
          {!isReg && <Quiet label="Забыли пароль?" onClick={() => { setView("reset"); setError(null); }} />}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: isReg ? 8 : 0 }}>
            <span style={{ fontSize: "var(--text-subhead)", color: INK3, fontFamily: FONT }}>
              {isReg ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}
            </span>
            <Quiet label={isReg ? "Войти" : "Создать"} onClick={() => { setMode(isReg ? "login" : "register"); setError(null); }} />
          </div>
        </div>

        <p style={{ margin: "18px 8px 0", fontSize: "var(--text-caption)", lineHeight: 1.5, color: INK3, fontFamily: FONT, textAlign: "center" }}>
          Вход хранит вашу практику в аккаунте и синхронизирует её между устройствами.
        </p>
      </div>
    </>,
  );
}

/* ─────────────────────────── дашборд (вошёл) ─────────────────────────── */

/**
 * Сводка накопленного. Показывается, ТОЛЬКО когда есть что показывать.
 *
 * Прежде четыре нуля стояли первым, что видел новый человек после своего имени:
 * экран отчитывался пустотой вместо приглашения. Пустое состояние ниже говорит
 * то же самое, но зовёт — двух сообщений об одной пустоте быть не должно.
 */
function StatStrip({ stats }: { stats: Overview["stats"] }) {
  if (!(stats.reading || stats.listening || stats.bookmarks || stats.books)) return null;
  const items = [
    { value: stats.reading, label: "Прочитано" },
    { value: stats.listening, label: "Прослушано" },
    { value: stats.bookmarks, label: "Сохранено" },
    { value: stats.books, label: "Книг" },
  ];
  return (
    <div style={{ display: "flex", background: SURFACE, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
      {items.map((it, i) => (
        <div key={it.label} style={{ flex: 1, minWidth: 0, padding: "16px 4px", textAlign: "center", borderLeft: i ? `0.5px solid ${HAIR}` : "none" }}>
          <div style={{ fontSize: "var(--text-title1)", fontWeight: 700, letterSpacing: -0.5, color: INK, fontFamily: FONT, lineHeight: 1.1 }}>{it.value}</div>
          <div style={{ marginTop: 3, fontSize: "var(--text-caption2)", fontWeight: 500, color: INK2, fontFamily: FONT }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

function HScroll({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 4px 4px", margin: "0 -4px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
      {children}
    </div>
  );
}

function ContinueCard({ item, onOpen }: { item: ReadingItem; onOpen: (p: string) => void }) {
  const meta = bookMeta(item.work);
  // ЗКН-Н060: путь книги — только через bookSlug. `/books/<шифр>` — это
    // эндпоинт сервера, а не маршрут человека.
    const href = item.href || `/${bookSlug(item.work)}`;
  return (
    <button
      onClick={() => onOpen(href)}
      style={{ flexShrink: 0, width: 116, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}
    >
      <CoverBox src={meta.cover} w={116} h={154} radius={12} label={meta.title} />
      <div style={{ marginTop: 8, fontSize: "var(--text-footnote)", fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{meta.title}</div>
      <div style={{ marginTop: 2, fontSize: "var(--text-caption)", color: INK2, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{item.label || "Продолжить"}</div>
    </button>
  );
}

function ListenCard({ item, onPlay }: { item: ListenItem; onPlay: (it: ListenItem) => void }) {
  return (
    <button
      onClick={() => onPlay(item)}
      style={{ flexShrink: 0, width: 132, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}
    >
      <div style={{ position: "relative" }}>
        <CoverBox src={item.cover} w={132} h={132} radius={12} label={item.title || ""} />
        <span style={{ position: "absolute", right: 8, bottom: 8, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center" }}>
          <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden><path fill="#fff" d="M8 5v14l11-7z" /></svg>
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: "var(--text-footnote)", fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{item.title || "Без названия"}</div>
      <div style={{ marginTop: 2, fontSize: "var(--text-caption)", color: INK2, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{item.subtitle || item.artist || ""}</div>
    </button>
  );
}

function BookmarkRow({ item, last, onOpen }: { item: BookmarkItem; last: boolean; onOpen: (p: string) => void }) {
  return (
    <>
      <button
        onClick={() => { if (item.href) onOpen(item.href); }}
        style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "10px 14px", background: "none", border: "none", cursor: item.href ? "pointer" : "default", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}
      >
        {item.cover ? (
          <CoverBox src={item.cover} w={44} h={44} radius={9} />
        ) : (
          <span style={{ width: 44, height: 44, borderRadius: 9, flexShrink: 0, background: "rgba(210,170,27,0.14)", color: GOLD, display: "grid", placeItems: "center" }}>
            <HeartIco size={18} />
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: "var(--text-subhead)", fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || "Закладка"}</span>
          {item.subtitle && <span style={{ display: "block", marginTop: 1, fontSize: "var(--text-footnote)", color: INK2, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subtitle}</span>}
        </span>
        {item.href && <span style={{ color: INK3, flexShrink: 0 }}><ChevR /></span>}
      </button>
      {!last && <div style={{ height: "0.5px", background: HAIR, marginLeft: 70 }} />}
    </>
  );
}

/**
 * Личность преданного. Здесь же — ступень практики и, пока профиль не заполнен,
 * тихое приглашение его заполнить.
 *
 * Раньше приглашение было ОТДЕЛЬНОЙ карточкой во всю ширину под шапкой и висело
 * там вечно, даже когда заполнять уже нечего. Напоминание, которое нельзя
 * закрыть выполнением, перестаёт быть напоминанием и становится мебелью.
 * Теперь оно живёт строкой внутри карточки личности и исчезает само, как только
 * есть имя и ступень.
 */
function ProfileHeader({ onEdit }: { onEdit: () => void }) {
  const { user } = useAuth();
  const display = (user?.name || "").trim() || "Преданный";
  const level = levelLabel(user);
  const incomplete = !level || !(user?.name || "").trim();
  return (
    <div style={{ background: SURFACE, borderRadius: 18, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#E8C84A,#C09400)", color: "#fff", fontSize: "var(--text-title2)", fontWeight: 700, fontFamily: FONT, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)" }}>
        {initials(user?.name ?? null, user?.email ?? null)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-title3)", fontWeight: 700, letterSpacing: -0.3, color: INK, fontFamily: FONT, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display}</div>
        {user?.spiritualName && <div style={{ marginTop: 1, fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD, fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.spiritualName}</div>}
        {level && <div style={{ marginTop: 3, fontSize: "var(--text-caption)", fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", color: GOLD, fontFamily: FONT }}>{level}</div>}
        {user?.email && <div style={{ marginTop: 2, fontSize: "var(--text-footnote)", color: INK2, fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>}
      </div>
      <button
        aria-label="Изменить профиль"
        onClick={onEdit}
        style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: `0.5px solid ${HAIR}`, background: GROUPED, color: INK2, display: "grid", placeItems: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      >
        <PencilIco />
      </button>
    </div>
      {incomplete && (
        <button
          onClick={() => window.dispatchEvent(new Event("iskcon:onboarding"))}
          style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "12px 16px", background: "none", border: "none", borderTop: `0.5px solid ${HAIR}`, cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-footnote)", color: INK2 }}>
            Укажите ступень практики — приложение подстроится под неё
          </span>
          <span style={{ color: GOLD, fontSize: "var(--text-footnote)", fontWeight: 600, flexShrink: 0 }}>Настроить</span>
        </button>
      )}
    </div>
  );
}

/** Ступени практики (самоопределение) — управляют адаптацией интерфейса. */
const LEVEL_OPTS: { id: DevoteeLevel; label: string; hint: string }[] = [
  { id: "guest", label: "Гость", hint: "Знакомлюсь с сознанием Кришны" },
  { id: "neophyte", label: "Неофит", hint: "Начинаю духовную практику" },
  { id: "practicing", label: "Практикующий", hint: "Ежедневная садхана" },
  { id: "initiated", label: "Инициированный", hint: "Принял(а) духовного учителя" },
  { id: "guru", label: "Наставник", hint: "Наставляю других преданных" },
];
const INIT_OPTS: { id: Initiation; label: string }[] = [
  { id: "none", label: "Пока нет" },
  { id: "harinama", label: "Харинама" },
  { id: "brahmin", label: "Брахманская" },
];

/** Сегментированный выбор (чипы с переносом). */
function SegPicker<T extends string>({ value, options, onChange }: { value: T | ""; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 14px" }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: FONT, fontSize: "var(--text-subhead)", fontWeight: on ? 600 : 500,
              border: `1px solid ${on ? GOLD : HAIR}`,
              background: on ? "color-mix(in srgb, #D2AA1B 15%, transparent)" : "transparent",
              color: on ? "color-mix(in srgb, #D2AA1B 82%, var(--color-label))" : INK,
              WebkitTapHighlightColor: "transparent", transition: "all .15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ProfileEditor({ onClose }: { onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [spiritual, setSpiritual] = useState(user?.spiritualName ?? "");
  const [level, setLevel] = useState<DevoteeLevel | "">(user?.level ?? "");
  const [initiation, setInitiation] = useState<Initiation | "">(user?.initiation ?? "");
  const [dikshaGuru, setDikshaGuru] = useState(user?.dikshaGuru ?? "");
  const [sikshaGuru, setSikshaGuru] = useState(user?.sikshaGuru ?? "");
  const [principlesSince, setPrinciplesSince] = useState(user?.principlesSince ?? "");
  const [chantNorm, setChantNorm] = useState("");
  const [busy, setBusy] = useState(false);

  // Текущую норму кругов берём из единого источника (sadhanaGoal), чтобы её не
  // затереть при сохранении профиля. Если запрос не удался — поле остаётся пустым
  // и норма не отправляется (цель садханы не меняется).
  useEffect(() => {
    let alive = true;
    accountClient.sadhana.get(ymdLocal(), 1).then((s) => { if (alive && s?.goal) setChantNorm(String(s.goal)); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const practicing = level !== "" && level !== "guest";
  const initiated = level === "initiated" || level === "guru";

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const patch: Parameters<typeof updateProfile>[0] = {
        name: name.trim(),
        spiritualName: spiritual.trim(),
        level: level,
        // Практика: норма кругов, принципы, наставляющий гуру — для практикующих+.
        sikshaGuru: practicing ? sikshaGuru.trim() : "",
        principlesSince: practicing ? principlesSince : "",
        // Инициация и дикша-гуру — только для инициированных.
        initiation: initiated ? initiation : "",
        dikshaGuru: initiated ? dikshaGuru.trim() : "",
      };
      const norm = parseInt(chantNorm, 10);
      if (practicing && Number.isFinite(norm) && norm >= 1 && norm <= 64) patch.chantNorm = norm;
      await updateProfile(patch);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  const rowStyle: CSSProperties = { display: "flex", alignItems: "center", minHeight: 52, padding: "0 16px" };
  const inputStyle: CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: "var(--text-body)", color: INK, fontFamily: FONT, padding: "14px 0" };
  const cardStyle: CSSProperties = { background: SURFACE, borderRadius: 14, border: `0.5px solid ${HAIR}`, overflow: "hidden" };
  const groupLabel: CSSProperties = { margin: "20px 6px 7px", fontSize: "var(--text-footnote)", fontWeight: 600, letterSpacing: 0.2, color: INK3, fontFamily: FONT, textTransform: "uppercase" };
  const hair = <div style={{ height: "0.5px", background: HAIR, marginLeft: 16 }} />;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: GROUPED, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "10px 16px calc(20px + env(safe-area-inset-bottom))", maxWidth: 480, width: "100%", margin: "0 auto", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: "rgba(0,0,0,0.18)", margin: "0 auto 14px", position: "sticky", top: 0 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: INK2, fontSize: "var(--text-callout)", fontFamily: FONT, cursor: "pointer", padding: 0 }}>Отмена</button>
          <span style={{ fontSize: "var(--text-callout)", fontWeight: 600, color: INK, fontFamily: FONT }}>Профиль преданного</span>
          <button onClick={() => void save()} disabled={busy} style={{ background: "none", border: "none", color: GOLD, fontSize: "var(--text-callout)", fontWeight: 600, fontFamily: FONT, cursor: "pointer", padding: 0, opacity: busy ? 0.5 : 1 }}>Готово</button>
        </div>

        <div style={groupLabel}>Кто вы</div>
        <div style={cardStyle}>
          <div style={rowStyle}><input style={inputStyle} placeholder="Имя" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          {hair}
          <div style={rowStyle}><input style={inputStyle} placeholder="Духовное имя (если есть)" value={spiritual} onChange={(e) => setSpiritual(e.target.value)} /></div>
        </div>

        <div style={groupLabel}>Ступень практики</div>
        <div style={cardStyle}>
          <SegPicker value={level} options={LEVEL_OPTS} onChange={setLevel} />
          {level && (
            <>
              {hair}
              <p style={{ margin: 0, padding: "10px 16px", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: INK2, fontFamily: FONT }}>
                {LEVEL_OPTS.find((o) => o.id === level)?.hint}
              </p>
            </>
          )}
        </div>

        {practicing && (
          <>
            <div style={groupLabel}>Практика</div>
            <div style={cardStyle}>
              <div style={rowStyle}>
                <span style={{ fontSize: "var(--text-body)", color: INK, fontFamily: FONT }}>Норма кругов в день</span>
                <input inputMode="numeric" style={{ ...inputStyle, textAlign: "right", flex: "0 0 auto", width: 64 }} placeholder="16" value={chantNorm} onChange={(e) => setChantNorm(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} />
              </div>
              {hair}
              <div style={rowStyle}>
                <span style={{ fontSize: "var(--text-body)", color: INK, fontFamily: FONT, flexShrink: 0, marginRight: 12 }}>Следую 4 принципам с</span>
                <input type="date" style={{ ...inputStyle, textAlign: "right", colorScheme: "light" }} value={principlesSince} onChange={(e) => setPrinciplesSince(e.target.value)} />
              </div>
              {hair}
              <div style={rowStyle}><input style={inputStyle} placeholder="Шикша-гуру — наставляющий (если есть)" value={sikshaGuru} onChange={(e) => setSikshaGuru(e.target.value)} /></div>
            </div>
          </>
        )}

        {initiated && (
          <>
            <div style={groupLabel}>Инициация</div>
            <div style={cardStyle}>
              <SegPicker value={initiation} options={INIT_OPTS} onChange={setInitiation} />
              {hair}
              <div style={rowStyle}><input style={inputStyle} placeholder="Дикша-гуру — духовный учитель" value={dikshaGuru} onChange={(e) => setDikshaGuru(e.target.value)} /></div>
            </div>
          </>
        )}

        <p style={{ margin: "18px 6px 0", fontSize: "var(--text-caption)", lineHeight: 1.5, color: INK3, fontFamily: FONT }}>
          Ступень настраивает приложение под вас — от первых шагов до зрелой садханы. Ничего из этого не публикуется; данные видны только вам.
        </p>
      </div>
    </div>
  );
}

function Switch({ on, busy, onToggle }: { on: boolean; busy?: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch" aria-checked={on} disabled={busy} onClick={onToggle}
      style={{
        flexShrink: 0, width: 51, height: 31, borderRadius: 31, border: "none", position: "relative", cursor: busy ? "default" : "pointer",
        background: on ? GOLD : "rgba(120,120,128,0.28)", transition: "background .2s", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .2s" }} />
    </button>
  );
}

const PUSH_CAT_LABELS: { id: keyof PushCats; label: string; sub: string }[] = [
  { id: "verse", label: "Стих дня", sub: "Священное слово каждое утро" },
  { id: "ekadashi", label: "Экадаши", sub: "Напоминание накануне поста" },
  { id: "festival", label: "Праздники", sub: "Дни вайшнавского календаря" },
  { id: "streak", label: "Серия под угрозой", sub: "Если норма кругов не закрыта" },
];

function NotificationsCard() {
  const [supported] = useState(() => pushSupported());
  const [perm, setPerm] = useState(() => pushPermission());
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cats, setCats] = useState<PushCats>(() => loadCats());

  useEffect(() => { void isSubscribed().then(setOn); }, []);

  async function toggleMaster() {
    if (busy) return;
    setBusy(true);
    try {
      if (on) { await disablePush(); setOn(false); }
      else { const r = await enablePush(cats); setOn(r.ok); }
      setPerm(pushPermission());
    } finally { setBusy(false); }
  }
  function toggleCat(k: keyof PushCats) {
    const next = { ...cats, [k]: !cats[k] };
    setCats(next);
    if (on) void updateCats(next);
  }

  return (
    <div>
      <SectionTitle title="Уведомления" />
      <div style={{ background: SURFACE, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px" }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(210,170,27,0.14)", color: GOLD }}><BellIco /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "var(--text-callout)", color: INK, fontWeight: 500, fontFamily: FONT }}>Push-уведомления</div>
            <div style={{ fontSize: "var(--text-footnote)", color: INK3, fontFamily: FONT, marginTop: 1 }}>
              {!supported ? "Недоступно в этом браузере" : perm === "denied" ? "Разрешение запрещено в браузере" : on ? "Включены на этом устройстве" : "Тихие напоминания о практике"}
            </div>
          </div>
          {supported && perm !== "denied" && <Switch on={on} busy={busy} onToggle={() => void toggleMaster()} />}
        </div>

        {on && PUSH_CAT_LABELS.map((c) => (
          <div key={c.id}>
            <div style={{ height: "0.5px", background: HAIR, marginLeft: 56 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px 11px 56px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-callout)", color: INK, fontFamily: FONT }}>{c.label}</div>
                <div style={{ fontSize: "var(--text-caption)", color: INK3, fontFamily: FONT, marginTop: 1 }}>{c.sub}</div>
              </div>
              <Switch on={!!cats[c.id]} onToggle={() => toggleCat(c.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── вход и безопасность (Ц-онбординг) ─────────────────────── */

function SecurityCard({ flash }: { flash: (m: string) => void }) {
  const { user, refresh } = useAuth();
  const up = useAuthProviders();
  const [ids, setIds] = useState<IdentityItem[] | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [verified, setVerified] = useState(true);
  const [open, setOpen] = useState<"" | "verify" | "password">("");
  const [code, setCode] = useState("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    accountClient.identities()
      .then((d) => { setIds(d.identities); setHasPassword(d.hasPassword); setVerified(d.emailVerified); })
      .catch(() => setIds([]));
  }, []);
  useEffect(load, [load]);

  const linked = new Set((ids ?? []).map((i) => i.provider));
  const methods = (ids?.length ?? 0) + (hasPassword ? 1 : 0);
  const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", fontFamily: FONT };
  const chip = (bg: string, color: string, node: ReactNode) => (
    <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: bg, color }}>{node}</span>
  );
  const act = (label: string, onClick: () => void, danger = false) => (
    <button onClick={onClick} disabled={busy}
      style={{ background: "none", border: "none", padding: "6px 0 6px 8px", color: danger ? "var(--color-danger-text)" : GOLDT, fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer", fontFamily: FONT, WebkitTapHighlightColor: "transparent", opacity: busy ? 0.5 : 1 }}>
      {label}
    </button>
  );
  const inlineInput: CSSProperties = { flex: 1, minWidth: 0, height: 40, border: `0.5px solid ${HAIR}`, borderRadius: 10, padding: "0 12px", fontSize: "var(--text-subhead)", color: INK, fontFamily: FONT, background: "var(--color-bg-3)", outline: "none" };
  const hair = <div style={{ height: "0.5px", background: HAIR, marginLeft: 56 }} />;

  async function startVerify() {
    setError(null); setBusy(true);
    try {
      await accountClient.verifyRequest();
      setOpen("verify");
    } catch (e) { setError(errorText(e instanceof ApiError ? e.code : "")); }
    finally { setBusy(false); }
  }
  async function confirmVerify() {
    if (!/^\d{6}$/.test(code.trim())) { setError("Введите 6 цифр из письма."); return; }
    setError(null); setBusy(true);
    try {
      await accountClient.verifyConfirm(code.trim());
      setOpen(""); setCode(""); setVerified(true);
      await refresh();
      flash("Почта подтверждена");
    } catch (e) { setError(errorText(e instanceof ApiError ? e.code : "")); }
    finally { setBusy(false); }
  }
  async function savePassword() {
    if (newPw.length < 8) { setError("Пароль должен быть не короче 8 символов."); return; }
    setError(null); setBusy(true);
    try {
      await accountClient.setPassword(newPw, hasPassword ? curPw : undefined);
      setOpen(""); setCurPw(""); setNewPw("");
      flash(hasPassword ? "Пароль обновлён" : "Пароль задан");
      load();
    } catch (e) { setError(errorText(e instanceof ApiError ? e.code : "")); }
    finally { setBusy(false); }
  }
  async function unlink(prov: string) {
    setError(null); setBusy(true);
    try {
      await accountClient.unlinkIdentity(prov);
      flash("Аккаунт отключён");
      load();
    } catch (e) { setError(errorText(e instanceof ApiError ? e.code : "")); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <SectionTitle title="Вход и безопасность" />
      <div style={{ background: SURFACE, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
        {/* почта */}
        <div style={row}>
          {chip("rgba(120,120,128,0.12)", INK2, <MailIco size={17} />)}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: "var(--text-callout)", color: INK, fontWeight: 500 }}>Почта</span>
            <span style={{ display: "block", fontSize: "var(--text-footnote)", color: INK3, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email ?? "не указана"}</span>
          </span>
          {user?.email && (verified
            ? <span style={{ fontSize: "var(--text-footnote)", color: INK3, fontWeight: 500 }}>Подтверждена</span>
            : act("Подтвердить", () => void startVerify()))}
        </div>
        {open === "verify" && (
          <div style={{ display: "flex", gap: 8, padding: "0 14px 13px 56px" }}>
            <input style={{ ...inlineInput, letterSpacing: 5, fontVariantNumeric: "tabular-nums" }} inputMode="numeric" pattern="[0-9]*" maxLength={6}
              placeholder="Код из письма" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            {act("Готово", () => void confirmVerify())}
          </div>
        )}
        {hair}

        {/* пароль */}
        <div style={row}>
          {chip("rgba(120,120,128,0.12)", INK2, <KeyIco size={17} />)}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: "var(--text-callout)", color: INK, fontWeight: 500 }}>Пароль</span>
            <span style={{ display: "block", fontSize: "var(--text-footnote)", color: INK3, marginTop: 1 }}>{hasPassword ? "Для входа по почте" : "Не задан"}</span>
          </span>
          {act(open === "password" ? "Скрыть" : hasPassword ? "Изменить" : "Задать", () => { setOpen(open === "password" ? "" : "password"); setError(null); })}
        </div>
        {open === "password" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 14px 13px 56px" }}>
            {hasPassword && (
              <input style={inlineInput} type="password" placeholder="Текущий пароль" autoComplete="current-password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <input style={inlineInput} type="password" placeholder="Новый пароль" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              {act("Сохранить", () => void savePassword())}
            </div>
          </div>
        )}

        {/* внешние аккаунты */}
        {PROVIDER_META.map((m) => {
          const isLinked = linked.has(m.id);
          const canConnect = !!up?.[m.id];
          if (!isLinked && !canConnect) return null; // мёртвых кнопок не показываем
          return (
            <div key={m.id}>
              {hair}
              <div style={row}>
                {chip(m.id === "apple" ? "#000" : "var(--color-bg-3)", m.id === "apple" ? "#fff" : INK, providerGlyph(m.id, 17))}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "var(--text-callout)", color: INK, fontWeight: 500 }}>{PROVIDER_NAME[m.id]}</span>
                  <span style={{ display: "block", fontSize: "var(--text-footnote)", color: INK3, marginTop: 1 }}>{isLinked ? "Подключено" : "Быстрый вход"}</span>
                </span>
                {isLinked
                  ? (methods > 1 ? act("Отключить", () => void unlink(m.id), true) : <span style={{ fontSize: "var(--text-footnote)", color: INK3 }}>Единственный вход</span>)
                  : act("Подключить", () => window.location.assign(oauthStartUrl(m.id as ProviderId, "/account")))}
              </div>
            </div>
          );
        })}
      </div>
      {error && <p style={{ margin: "10px 6px 0", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "var(--color-danger-text)", fontFamily: FONT }}>{error}</p>}
    </div>
  );
}

const MailIco = ({ size = 20 }: IcoProps) => (
  <svg {...ico(size)}><rect {...STR} x="3" y="5.4" width="18" height="13.2" rx="2.2" /><path {...STR} d="m4 7 8 5.6L20 7" /></svg>
);
const KeyIco = ({ size = 20 }: IcoProps) => (
  <svg {...ico(size)}><circle {...STR} cx="8.2" cy="12" r="3.6" /><path {...STR} d="M11.8 12h8.4M17 12v3M20.2 12v2.2" /></svg>
);

function SettingsCard({ onEdit, onDonate, onLogout }: { onEdit: () => void; onDonate: () => void; onLogout: () => void }) {
  const rows: { icon: ReactNode; label: string; tint?: string; onClick: () => void }[] = [
    { icon: <PencilIco size={18} />, label: "Изменить профиль", onClick: onEdit },
    { icon: <HeartGift />, label: "Поддержать проект", tint: GOLD, onClick: onDonate },
  ];
  return (
    <div>
      <SectionTitle title="Настройки" />
      <div style={{ background: SURFACE, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
        {rows.map((r, i) => (
          <div key={r.label}>
            <button onClick={r.onClick} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "13px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: r.tint ? "rgba(210,170,27,0.14)" : "rgba(120,120,128,0.12)", color: r.tint || INK2 }}>{r.icon}</span>
              <span style={{ flex: 1, fontSize: "var(--text-callout)", color: INK, fontWeight: 500 }}>{r.label}</span>
              <span style={{ color: INK3 }}><ChevR /></span>
            </button>
            {i < rows.length - 1 && <div style={{ height: "0.5px", background: HAIR, marginLeft: 56 }} />}
          </div>
        ))}
        <div style={{ height: "0.5px", background: HAIR, marginLeft: 56 }} />
        <button onClick={onLogout} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "13px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(255,59,48,0.12)", color: "var(--color-danger-text)" }}><SignOutIco size={18} /></span>
          <span style={{ flex: 1, fontSize: "var(--text-callout)", color: "var(--color-danger-text)", fontWeight: 500 }}>Выйти</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Настройки листом. Уведомления, вход и безопасность, прочие настройки жили
 * тремя карточками в конце ленты кабинета — человек прокручивал тумблеры,
 * чтобы добраться до своей библиотеки, а экран заканчивался конфигурацией
 * вместо него самого. Содержимое карточек не тронуто, изменилось только место:
 * один вход в ленте, за ним лист — как на системных экранах.
 */
function SettingsSheet({ flash, onClose, onEdit, onDonate, onLogout }: {
  flash: (m: string) => void; onClose: () => void; onEdit: () => void; onDonate: () => void; onLogout: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: GROUPED, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "10px 16px calc(20px + env(safe-area-inset-bottom))", maxWidth: 480, width: "100%", margin: "0 auto", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: "rgba(0,0,0,0.18)", margin: "0 auto 14px", position: "sticky", top: 0 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ width: 60 }} />
          <span style={{ fontSize: "var(--text-callout)", fontWeight: 600, color: INK, fontFamily: FONT }}>Настройки</span>
          <button onClick={onClose} style={{ width: 60, textAlign: "right", background: "none", border: "none", color: GOLD, fontSize: "var(--text-callout)", fontWeight: 600, fontFamily: FONT, cursor: "pointer", padding: 0 }}>Готово</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingBottom: 8 }}>
          <NotificationsCard />
          <SecurityCard flash={flash} />
          <SettingsCard onEdit={onEdit} onDonate={onDonate} onLogout={onLogout} />
        </div>
      </div>
    </div>
  );
}

function ymdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtMinShort(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60); const r = m % 60;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
}

/** Карточка «Садхана сегодня» в кабинете: кольцо кругов, серия, чтение → дневник. */
function SadhanaCard({ state, onOpen }: { state: SadhanaState; onOpen: () => void }) {
  const r = state.stats.todayRounds, g = state.goal;
  const done = r >= g;
  const tone = done ? "#34C759" : GOLD;
  const RAD = 58, CIRC = 2 * Math.PI * RAD;
  const frac = Math.min(1, r / Math.max(1, g));
  const read = state.todayRow.reading_min;
  const bits: string[] = [`серия ${state.stats.currentStreak} ${plural(state.stats.currentStreak, "день", "дня", "дней")}`];
  if (read > 0) bits.push(`чтение ${fmtMinShort(read)}`);
  return (
    <button onClick={onOpen} aria-label="Открыть дневник садханы"
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: 16, borderRadius: 18, background: SURFACE, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent", fontFamily: FONT }}>
      <div style={{ position: "relative", flexShrink: 0, width: 76, height: 76 }}>
        <svg viewBox="0 0 140 140" width="76" height="76" style={{ transform: "rotate(-90deg)" }} aria-hidden>
          <circle cx="70" cy="70" r={RAD} fill="none" stroke="color-mix(in srgb, var(--color-label) 9%, transparent)" strokeWidth="10" />
          <circle cx="70" cy="70" r={RAD} fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)} style={{ transition: "stroke-dashoffset .35s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: INK }}>{r}</span>
          <span style={{ fontFamily: FONT, fontSize: "var(--text-caption2)", color: INK2, marginTop: 1 }}>из {g}</span>
        </div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-callout)", fontWeight: 800, letterSpacing: "-0.02em", color: done ? "#34C759" : INK }}>
          {done ? "Норма выполнена" : "Круги сегодня"}
        </div>
        <div style={{ marginTop: 3, fontFamily: FONT, fontSize: 12.5, color: INK2, textTransform: "lowercase" }}>{bits.join(" · ")}</div>
      </div>
      <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden style={{ flexShrink: 0, color: INK3 }}><path d="M1.5 1.5 7 7.5l-5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

function Dashboard({ onOpenPath, onDonate, flash }: { onOpenPath: (p: string) => void; onDonate: () => void; flash: (m: string) => void }) {
  const { logout, user } = useAuth();
  const player = usePlayer();
  const [ov, setOv] = useState<Overview | null>(null);
  const [sad, setSad] = useState<SadhanaState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(() => {
    accountClient
      .overview()
      .then((d) => setOv(d))
      .catch(() => setOv(null))
      .finally(() => setLoaded(true));
    // Садхана — параллельно; своя сводка кругов/серии для карточки кабинета.
    accountClient.sadhana.get(ymdLocal()).then((d) => setSad(d)).catch(() => setSad(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  const resumeListen = useCallback(
    (it: ListenItem) => {
      try {
        if (it.source === "kirtan" && it.album && albumById(it.album)) {
          player.playKirtan(it.album);
          return;
        }
        if (it.source !== "kirtan" && it.album && BOOKS[it.album]) {
          player.playBook({ book: it.album });
          return;
        }
        if (it.href) onOpenPath(it.href);
        else flash("Не удалось возобновить воспроизведение");
      } catch {
        flash("Не удалось возобновить воспроизведение");
      }
    },
    [player, onOpenPath, flash],
  );

  async function doLogout() {
    await logout();
    flash("Вы вышли из аккаунта");
  }

  const hasAny =
    !!ov && (ov.continueReading.length > 0 || ov.recentListening.length > 0 || ov.bookmarks.length > 0 || ov.library.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <ProfileHeader onEdit={() => setEditing(true)} />

      {/* ── СЕГОДНЯ — живая часть кабинета ──────────────────────────────────
          Круги и обет — одно и то же действие человека в этот день, поэтому
          они стоят рядом и первыми. Раньше садхана была ТРЕТЬИМ блоком (после
          напоминания о профиле и стены нулей), а обет жил отдельным разделом
          «Практика» с единственной строкой внутри: заголовок над одним пунктом
          не структурирует, а шумит. */}
      <section>
        <SectionTitle title="Сегодня" action={{ label: "Дневник", onClick: () => onOpenPath("/story") }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sad && <SadhanaCard state={sad} onOpen={() => onOpenPath("/story")} />}
          <div style={{ background: SURFACE, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
            <button onClick={() => onOpenPath("/promise")} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "13px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(221,122,30,0.14)", color: "#DD7A1E" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5L12 21l-5 2.1 1-5.5-4-3.9 5.5-.8z" /></svg>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "var(--text-callout)", color: INK, fontWeight: 500 }}>Мой обет</span>
                <span style={{ display: "block", fontSize: "var(--text-footnote)", color: INK3, marginTop: 1, lineHeight: 1.35 }}>Санкальпа на срок: служения, ежедневный контроль и отчёт</span>
              </span>
              <span style={{ color: INK3, flexShrink: 0 }}><ChevR /></span>
            </button>
          </div>
        </div>
      </section>

      {ov && <StatStrip stats={ov.stats} />}

      {!loaded && (
        <div style={{ display: "flex", justifyContent: "center", padding: "30px 0", color: INK3, fontSize: "var(--text-subhead)", fontFamily: FONT }}>Загружаю…</div>
      )}

      {loaded && !hasAny && (
        <div style={{ background: SURFACE, borderRadius: 18, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", padding: "26px 22px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, margin: "0 auto 14px", borderRadius: "50%", background: "rgba(210,170,27,0.14)", color: GOLD, display: "grid", placeItems: "center" }}><BookIco size={26} /></div>
          <div style={{ fontSize: "var(--text-body)", fontWeight: 700, color: INK, fontFamily: FONT, letterSpacing: -0.2 }}>Здесь будет ваша садхана</div>
          <p style={{ margin: "8px auto 18px", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: INK2, fontFamily: FONT, maxWidth: 280 }}>
            Закладки, прогресс чтения и прослушанные киртаны появятся, как только вы начнёте.
          </p>
          <button onClick={() => onOpenPath("/books")} style={{ height: 46, padding: "0 22px", borderRadius: 14, border: "none", background: INK, color: "var(--color-bg-2)", fontFamily: FONT, fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            Открыть библиотеку
          </button>
        </div>
      )}

      {ov && ov.continueReading.length > 0 && (
        <section>
          <SectionTitle title="Продолжить чтение" />
          <HScroll>
            {ov.continueReading.map((it) => (
              <ContinueCard key={`${it.work}:${it.ref}`} item={it} onOpen={onOpenPath} />
            ))}
          </HScroll>
        </section>
      )}

      {ov && ov.recentListening.length > 0 && (
        <section>
          <SectionTitle title="Вы слушали" />
          <HScroll>
            {ov.recentListening.map((it) => (
              <ListenCard key={`${it.source}:${it.ref}`} item={it} onPlay={resumeListen} />
            ))}
          </HScroll>
        </section>
      )}

      {ov && ov.bookmarks.length > 0 && (
        <section>
          <SectionTitle title="Закладки" />
          <div style={{ background: SURFACE, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
            {ov.bookmarks.map((it, i) => (
              <BookmarkRow key={`${it.kind}:${it.ref}`} item={it} last={i === ov.bookmarks.length - 1} onOpen={onOpenPath} />
            ))}
          </div>
        </section>
      )}

      {ov && ov.library.length > 0 && (
        <section>
          <SectionTitle title="Моя библиотека" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 14 }}>
            {ov.library.map((it) => {
              const meta = bookMeta(it.work);
              return (
                <button key={it.work} onClick={() => onOpenPath(`/${bookSlug(it.work)}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
                  <CoverBox src={meta.cover} w={96} h={128} radius={10} label={meta.title} />
                  <div style={{ marginTop: 6, fontSize: "var(--text-caption)", fontWeight: 500, color: INK, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{meta.title}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <NotesSection onOpenPath={onOpenPath} />

      {/* ── СЛУЖЕНИЕ ────────────────────────────────────────────────────────
          Стоит после «моего»: сначала человек видит свою практику, потом — куда
          её приложить. «Мои центры» — управление страницей храма или нама-хатты;
          гостю и неофиту управлять нечем, поэтому строка появляется со ступени
          практикующего (ЗКН-Ц1: интерфейс читает ступень, а не показывает всё
          всем). */}
      <section>
        <SectionTitle title="Служение" />
        <div style={{ background: SURFACE, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
          <button onClick={() => onOpenPath("/iskcon/centers")} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "13px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(76,110,245,0.14)", color: "#4C6EF5" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" /><circle cx="12" cy="11" r="2.2" /></g></svg>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "var(--text-callout)", color: INK, fontWeight: 500 }}>Каталог Ятры</span>
              <span style={{ display: "block", fontSize: "var(--text-footnote)", color: INK3, marginTop: 1, lineHeight: 1.35 }}>Храмы, нама-хатты, рестораны и фермы ИСККОН рядом</span>
            </span>
            <span style={{ color: INK3, flexShrink: 0 }}><ChevR /></span>
          </button>
          {atLeastLevel(user, "practicing") && (
            <button onClick={() => onOpenPath("/my/centers")} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "13px 14px", background: "none", border: "none", borderTop: `0.5px solid ${HAIR}`, cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(210,170,27,0.14)", color: GOLD }}><TempleIco size={18} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "var(--text-callout)", color: INK, fontWeight: 500 }}>Мои центры</span>
                <span style={{ display: "block", fontSize: "var(--text-footnote)", color: INK3, marginTop: 1, lineHeight: 1.35 }}>Храм, нама-хатта, ферма — ваша страница на {SITE_HOST}</span>
              </span>
              <span style={{ color: INK3, flexShrink: 0 }}><ChevR /></span>
            </button>
          )}
        </div>
      </section>

      {/* ── НАСТРОЙКИ УХОДЯТ ИЗ ПОТОКА ──────────────────────────────────────
          Уведомления, вход и безопасность, настройки были тремя карточками в
          конце ленты: кабинет заканчивался не человеком, а конфигурацией, и
          прокрутка до своей библиотеки шла сквозь тумблеры. Теперь один вход,
          за ним лист — как на всех системных экранах. */}
      <button
        onClick={() => setSettingsOpen(true)}
        style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "14px", background: SURFACE, border: `0.5px solid ${HAIR}`, borderRadius: 16, boxShadow: "var(--shadow-card)", cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}
      >
        <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(120,120,128,0.12)", color: INK2 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" /></g></svg>
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-callout)", color: INK, fontWeight: 500 }}>Настройки</span>
        <span style={{ color: INK3, flexShrink: 0 }}><ChevR /></span>
      </button>

      <p style={{ textAlign: "center", fontSize: "var(--text-caption)", color: INK3, fontFamily: FONT, margin: 0 }}>{SITE_HOST} · ИСККОН</p>

      {editing && <ProfileEditor onClose={() => setEditing(false)} />}
      {settingsOpen && (
        <SettingsSheet
          flash={flash}
          onClose={() => setSettingsOpen(false)}
          onEdit={() => { setSettingsOpen(false); setEditing(true); }}
          onDonate={onDonate}
          onLogout={() => void doLogout()}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── корень экрана ─────────────────────────── */

export default function AccountScreen({ onOpenPath, onDonate, flash }: { onOpenPath: (path: string) => void; onDonate: () => void; flash: (m: string) => void }) {
  const { status } = useAuth();

  // Возврат из OAuth-колбэка: ?welcome=1 — тихое приветствие; ?authError=… у
  // вошедшего (неудачная привязка провайдера) — той же плашкой. Гостю ошибку
  // показывает AuthPanel инлайн, здесь её не трогаем.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    let dirty = false;
    if (q.get("welcome")) { flash("Вы вошли. Харе Кришна!"); dirty = true; }
    const ae = q.get("authError");
    if (ae && status === "authed") { flash(errorText(ae)); dirty = true; }
    if (dirty) replaceUrl(window.location.pathname + window.location.hash);
  }, [status, flash]);

  return (
    // фон-вынос на всю ширину: сгруппированный серый iOS под белыми карточками
    <div style={{
      margin: "-16px -16px -116px",
      padding: "16px 16px calc(120px + env(safe-area-inset-bottom))",
      minHeight: "calc(100dvh - 56px)",
      // Гостю — белый холст приложения и вертикальное центрирование: вход это
      // момент, а не список карточек. Вошедшему — сгруппированный серый под
      // белыми карточками дашборда.
      background: status === "authed" ? GROUPED : "var(--color-bg)",
      ...(status === "authed" ? null : { display: "flex", alignItems: "center", justifyContent: "center" }),
    }}>
      {status === "loading" ? (
        <div style={{ color: INK3, fontSize: "var(--text-subhead)", fontFamily: FONT }}>Загружаю…</div>
      ) : status === "guest" ? (
        <AuthPanel />
      ) : (
        <Dashboard onOpenPath={onOpenPath} onDonate={onDonate} flash={flash} />
      )}
    </div>
  );
}

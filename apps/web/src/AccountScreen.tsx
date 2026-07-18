/**
 * ЛИЧНЫЙ КАБИНЕТ — экран вкладки «Кабинет» (адрес `/id`).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ЗКН-Н088 — В КАБИНЕТЕ ЖИВЁТ ТОЛЬКО КАБИНЕТ.
 *
 * Кабинет был свалкой: круги джапы, обет, дневник, «продолжить чтение», «вы
 * слушали», четыре счётчика достижений, закладки, библиотека, заметки, каталог
 * Ятры — и где-то среди этого профиль. Экран отвечал сразу на пять вопросов и
 * ни на один — внятно.
 *
 * Кабинет отвечает на ОДИН вопрос: «кто я в этом приложении и как это
 * настроено». Личность · ступень · моё сохранённое · вход и безопасность ·
 * уведомления · служение · приложение · выход. ВСЁ.
 *
 * ПРАКТИКА, ПРОГРЕСС И ДОСТИЖЕНИЯ ЖИВУТ В ТАБЕ «ПРАКТИКА» (`PracticeHub`):
 * круги, обет, дневник, стих дня, статистика, продолжить чтение, вы слушали,
 * библиотека. Решение основателя 18.07.2026.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ЯЗЫК ИНТЕРФЕЙСА — ЗКН-Д018 (сгруппированный экран iOS 26.5). Ни одного
 * числа «на глаз»: холст, карточка, радиус 24, строка 48, разделитель 1px,
 * воздух 35 — всё из `ui/ios.tsx`, где значения сняты со скриншотов Apple.
 * Золото — только портрет и подтверждающее действие листа; строки тихие.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "./account/store";
import { replaceUrl } from "./nav";
import { ROUTES, SITE_HOST } from "./routes";
import { accountClient, ApiError, type DevoteeLevel, type Initiation, type IdentityItem } from "./account/api";
import { ProviderButtons, PROVIDER_META, PROVIDER_NAME, providerGlyph, oauthStartUrl, useAuthProviders, type ProviderId } from "./account/providers";
import { pushSupported, pushPermission, isSubscribed, enablePush, disablePush, updateCats, loadCats, type PushCats } from "./push";
import { levelLabel, atLeastLevel, LEVEL_META } from "./devotee";
import { BUILD_SHA } from "./buildStamp";
import {
  GroupedCanvas, Groups, Group, Row, IdentityRow, Separator, Sheet,
  Toggle, Checkmark,
} from "./ui/ios";

/* ─────────────────────────── палитра/токены ─────────────────────────── */

const GOLDT = "var(--color-gold-deep)";
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
const EyeIco = ({ size = 20, off }: IcoProps & { off?: boolean }) =>
  off ? (
    <svg {...ico(size)}><path {...STR} d="M3 3l18 18" /><path {...STR} d="M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 9 5 9 7a12 12 0 0 1-2.2 2.7M6.3 6.3C3.7 7.9 2 10.7 2 12c0 2 4 7 9 7a9.7 9.7 0 0 0 3.6-.7" /><path {...STR} d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
  ) : (
    <svg {...ico(size)}><path {...STR} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle {...STR} cx="12" cy="12" r="3" /></svg>
  );
const MailIco = ({ size = 20 }: IcoProps) => (
  <svg {...ico(size)}><rect {...STR} x="3" y="5.4" width="18" height="13.2" rx="2.2" /><path {...STR} d="m4 7 8 5.6L20 7" /></svg>
);
const KeyIco = ({ size = 20 }: IcoProps) => (
  <svg {...ico(size)}><circle {...STR} cx="8.2" cy="12" r="3.6" /><path {...STR} d="M11.8 12h8.4M17 12v3M20.2 12v2.2" /></svg>
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

/** Локальная дата YYYY-MM-DD — норма кругов тянется из того же источника, что и садхана. */
function ymdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─────────────────────────── панель входа (гость) ─────────────────────────── */

/* ─────────────────────────── вход (гость) ───────────────────────────
 * Вход — это МОМЕНТ, а не форма под вкладками. Экран строится по-эпплски:
 * один знак, одно обещание, способы войти, ничего конкурирующего. Поля —
 * сгруппированная карточка с плавающими подписями (подпись не исчезает при
 * вводе, как это делает placeholder, — человек всегда видит, что заполняет).
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

/* ═══════════════════════════════════════════════════════════════════════════
 * ЛИСТЫ КАБИНЕТА. Каждый — экран одной темы, а не «ещё одна карточка в ленте».
 * Геометрия и материал — ЗКН-Д018 (`ui/ios.tsx`).
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Строка-поле ввода в сгруппированной карточке: 48px, поле 16, тот же ритм. */
function FieldRow({ label, value, onChange, placeholder, type = "text", inputMode, right, maxLength, last }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; inputMode?: "text" | "numeric" | "email"; right?: boolean; maxLength?: number; last?: boolean;
}) {
  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, minHeight: "var(--row-h)",
        padding: "0 var(--inset-row)",
      }}>
        {label && (
          <span style={{ flexShrink: 0, fontFamily: FONT, fontSize: "var(--text-body)", color: INK, letterSpacing: "-0.01em" }}>
            {label}
          </span>
        )}
        <input
          type={type} inputMode={inputMode} value={value} maxLength={maxLength}
          placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent",
            fontFamily: FONT, fontSize: "var(--text-body)", letterSpacing: "-0.01em",
            color: right ? INK2 : INK, textAlign: right ? "right" : "left", padding: "12px 0",
            width: right ? 90 : undefined, flexGrow: right ? 0 : 1,
          }} />
      </div>
      {!last && <Separator inset={16} />}
    </>
  );
}

const INIT_OPTS: { id: Initiation; label: string }[] = [
  { id: "none", label: "Пока нет" },
  { id: "harinama", label: "Харинама" },
  { id: "brahmin", label: "Брахманская" },
];

/**
 * СТУПЕНЬ ПРАКТИКИ — отдельный лист выбора (iOS: список с галочкой), а не
 * ряд чипов внутри формы. Ступень настраивает всё приложение, поэтому у неё
 * свой экран и своё объяснение, а не строка в углу.
 */
function LevelSheet({ onClose }: { onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const [level, setLevel] = useState<DevoteeLevel | "">(user?.level ?? "");
  const [busy, setBusy] = useState(false);
  async function pick(id: DevoteeLevel) {
    if (busy) return;
    setLevel(id);
    setBusy(true);
    try { await updateProfile({ level: id }); onClose(); }
    catch { setBusy(false); }
  }
  return (
    <Sheet title="Ступень практики" onClose={onClose}>
      <Groups>
        <Group footer="Ступень настраивает приложение под вас — от первых шагов до зрелой садханы. Ничего из этого не публикуется: данные видны только вам.">
          {LEVEL_META.map((o, i) => (
            <Row
              key={o.id}
              title={o.label}
              subtitle={o.hint}
              onClick={() => void pick(o.id)}
              chevron={false}
              accessory={level === o.id ? <Checkmark /> : undefined}
              last={i === LEVEL_META.length - 1}
            />
          ))}
        </Group>
      </Groups>
    </Sheet>
  );
}

/** Профиль преданного: имя, духовное имя, практика, инициация. */
function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [spiritual, setSpiritual] = useState(user?.spiritualName ?? "");
  const [dikshaGuru, setDikshaGuru] = useState(user?.dikshaGuru ?? "");
  const [sikshaGuru, setSikshaGuru] = useState(user?.sikshaGuru ?? "");
  const [initiation, setInitiation] = useState<Initiation | "">(user?.initiation ?? "");
  const [principlesSince, setPrinciplesSince] = useState(user?.principlesSince ?? "");
  const [chantNorm, setChantNorm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    accountClient.sadhana.get(ymdLocal(), 1).then((s) => { if (alive && s?.goal) setChantNorm(String(s.goal)); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const level = user?.level ?? "";
  const practicing = level !== "" && level !== "guest";
  const initiated = level === "initiated" || level === "guru";

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const patch: Parameters<typeof updateProfile>[0] = {
        name: name.trim(),
        spiritualName: spiritual.trim(),
        sikshaGuru: practicing ? sikshaGuru.trim() : "",
        principlesSince: practicing ? principlesSince : "",
        initiation: initiated ? initiation : "",
        dikshaGuru: initiated ? dikshaGuru.trim() : "",
      };
      const norm = parseInt(chantNorm, 10);
      if (practicing && Number.isFinite(norm) && norm >= 1 && norm <= 64) patch.chantNorm = norm;
      await updateProfile(patch);
      onClose();
    } catch { setBusy(false); }
  }

  return (
    <Sheet title="Профиль" onClose={onClose} action={{ label: "Готово", onClick: () => void save(), disabled: busy }}>
      <Groups>
        <Group header="Кто вы">
          <FieldRow value={name} onChange={setName} placeholder="Имя" />
          <FieldRow value={spiritual} onChange={setSpiritual} placeholder="Духовное имя (если есть)" last />
        </Group>

        {practicing && (
          <Group header="Практика">
            <FieldRow label="Норма кругов в день" value={chantNorm} right inputMode="numeric" maxLength={2}
              onChange={(v) => setChantNorm(v.replace(/[^\d]/g, "").slice(0, 2))} placeholder="16" />
            <FieldRow label="Принципы с" value={principlesSince} right type="date" onChange={setPrinciplesSince} />
            <FieldRow value={sikshaGuru} onChange={setSikshaGuru} placeholder="Шикша-гуру — наставляющий" last />
          </Group>
        )}

        {initiated && (
          <Group header="Инициация">
            {INIT_OPTS.map((o) => (
              <Row key={o.id} title={o.label} chevron={false}
                accessory={initiation === o.id ? <Checkmark /> : undefined}
                onClick={() => setInitiation(o.id)} />
            ))}
            <FieldRow value={dikshaGuru} onChange={setDikshaGuru} placeholder="Дикша-гуру — духовный учитель" last />
          </Group>
        )}
      </Groups>
    </Sheet>
  );
}

/* ─────────────────────────── уведомления ─────────────────────────── */

const PUSH_CAT_LABELS: { id: keyof PushCats; label: string; sub: string }[] = [
  { id: "verse", label: "Стих дня", sub: "Священное слово каждое утро" },
  { id: "ekadashi", label: "Экадаши", sub: "Напоминание накануне поста" },
  { id: "festival", label: "Праздники", sub: "Дни вайшнавского календаря" },
  { id: "streak", label: "Серия под угрозой", sub: "Если норма кругов не закрыта" },
];

function NotificationsSheet({ onClose }: { onClose: () => void }) {
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

  const state = !supported ? "Недоступно в этом браузере"
    : perm === "denied" ? "Запрещено в настройках браузера"
    : on ? "Включены на этом устройстве" : "Выключены";

  return (
    <Sheet title="Уведомления" onClose={onClose}>
      <Groups>
        <Group footer="Приложение присылает только то, что вы выбрали. Ни рекламы, ни чужих сообщений.">
          <Row
            title="Push-уведомления" subtitle={state} chevron={false} last
            accessory={supported && perm !== "denied"
              ? <Toggle on={on} busy={busy} onToggle={() => void toggleMaster()} />
              : undefined} />
        </Group>
        {on && (
          <Group header="Что присылать">
            {PUSH_CAT_LABELS.map((c, i) => (
              <Row key={c.id} title={c.label} subtitle={c.sub} chevron={false}
                accessory={<Toggle on={!!cats[c.id]} onToggle={() => toggleCat(c.id)} />}
                last={i === PUSH_CAT_LABELS.length - 1} />
            ))}
          </Group>
        )}
      </Groups>
    </Sheet>
  );
}

/* ─────────────────────── вход и безопасность ─────────────────────── */

function SecuritySheet({ onClose, flash }: { onClose: () => void; flash: (m: string) => void }) {
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

  const act = (label: string, onClick: () => void, danger = false) => (
    <button type="button" onClick={onClick} disabled={busy}
      style={{ background: "none", border: "none", padding: "6px 0", cursor: "pointer", fontFamily: FONT,
        fontSize: "var(--text-body)", fontWeight: 600, opacity: busy ? 0.5 : 1,
        color: danger ? "var(--color-danger-text)" : GOLDT, WebkitTapHighlightColor: "transparent" }}>
      {label}
    </button>
  );

  async function startVerify() {
    setError(null); setBusy(true);
    try { await accountClient.verifyRequest(); setOpen("verify"); }
    catch (e) { setError(errorText(e instanceof ApiError ? e.code : "")); }
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
    try { await accountClient.unlinkIdentity(prov); flash("Аккаунт отключён"); load(); }
    catch (e) { setError(errorText(e instanceof ApiError ? e.code : "")); }
    finally { setBusy(false); }
  }

  const providers = PROVIDER_META.filter((m) => linked.has(m.id) || !!up?.[m.id]);

  return (
    <Sheet title="Вход и безопасность" onClose={onClose}>
      <Groups>
        <Group header="Почта и пароль" footer={error ?? undefined}>
          <Row
            icon={<MailIco size={20} />} title="Почта" subtitle={user?.email ?? "не указана"} chevron={false}
            accessory={user?.email
              ? (verified
                ? <span style={{ fontFamily: FONT, fontSize: "var(--text-subhead)", color: INK2 }}>Подтверждена</span>
                : act("Подтвердить", () => void startVerify()))
              : undefined} />
          {open === "verify" && (
            <>
              <FieldRow value={code} onChange={(v) => setCode(v.replace(/\D/g, ""))} inputMode="numeric"
                maxLength={6} placeholder="Код из письма" />
              <Row title="Готово" centered chevron={false} onClick={() => void confirmVerify()} />
            </>
          )}
          <Row
            icon={<KeyIco size={20} />} title="Пароль" subtitle={hasPassword ? "Задан" : "Не задан"} chevron={false}
            last={open !== "password"}
            accessory={act(open === "password" ? "Скрыть" : hasPassword ? "Изменить" : "Задать",
              () => { setOpen(open === "password" ? "" : "password"); setError(null); })} />
          {open === "password" && (
            <>
              {hasPassword && (
                <FieldRow value={curPw} onChange={setCurPw} type="password" placeholder="Текущий пароль" />
              )}
              <FieldRow value={newPw} onChange={setNewPw} type="password" placeholder="Новый пароль" />
              <Row title="Сохранить пароль" centered chevron={false} last onClick={() => void savePassword()} />
            </>
          )}
        </Group>

        {providers.length > 0 && (
          <Group header="Быстрый вход">
            {providers.map((m, i) => {
              const isLinked = linked.has(m.id);
              return (
                <Row
                  key={m.id}
                  icon={<span style={{ display: "grid", placeItems: "center", width: 20, height: 20, color: INK }}>{providerGlyph(m.id, 18)}</span>}
                  title={PROVIDER_NAME[m.id]}
                  subtitle={isLinked ? "Подключено" : "Не подключено"}
                  chevron={false}
                  last={i === providers.length - 1}
                  accessory={isLinked
                    ? (methods > 1
                      ? act("Отключить", () => void unlink(m.id), true)
                      : <span style={{ fontFamily: FONT, fontSize: "var(--text-subhead)", color: INK2 }}>Единственный вход</span>)
                    : act("Подключить", () => window.location.assign(oauthStartUrl(m.id as ProviderId, ROUTES.id())))} />
              );
            })}
          </Group>
        )}
      </Groups>
    </Sheet>
  );
}

/* ─────────────────────────── о приложении ─────────────────────────── */

function AboutSheet({ onClose }: { onClose: () => void }) {
  const sha: string = BUILD_SHA;
  const version = sha === "dev" ? "dev" : sha.slice(0, 7);
  return (
    <Sheet title="О приложении" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "8px 0 26px" }}>
        <img src="/iskcon-one-love-mark.svg" alt="" width={72} height={72}
          style={{ display: "block", margin: "0 auto 14px" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>
          ISKCON ONE LOVE
        </div>
        <p style={{ margin: "6px auto 0", maxWidth: 280, fontFamily: FONT, fontSize: "var(--text-subhead)", lineHeight: 1.45, color: INK2 }}>
          Цифровая сокровищница Гауранга Лилы: писания, личности, бхаджаны, дхама и практика.
        </p>
      </div>
      <Groups>
        <Group footer="Приложение не показывает рекламу и не продаёт данные. Всё, что вы отмечаете, остаётся вашим.">
          <Row title="Версия" value={version} chevron={false} />
          <Row title="Сайт" value={SITE_HOST} chevron={false} last />
        </Group>
      </Groups>
    </Sheet>
  );
}

/* ─────────────────────────── кабинет (вошёл) ─────────────────────────── */

function Dashboard({ onOpenPath, onDonate, flash }: {
  onOpenPath: (p: string) => void; onDonate: () => void; flash: (m: string) => void;
}) {
  const { user, logout } = useAuth();
  const [sheet, setSheet] = useState<"" | "profile" | "level" | "push" | "security" | "about">("");
  const [pushOn, setPushOn] = useState<boolean | null>(null);

  useEffect(() => { void isSubscribed().then(setPushOn).catch(() => setPushOn(false)); }, [sheet]);

  const level = levelLabel(user);
  const display = (user?.name || "").trim() || "Преданный";

  async function doLogout() {
    await logout();
    flash("Вы вышли из аккаунта");
  }

  function share() {
    const link = `https://${SITE_HOST}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: "ISKCON ONE LOVE", url: link }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => flash("Ссылка скопирована")).catch(() => {});
    }
  }

  return (
    <>
      <Groups>
        {/* ЛИЧНОСТЬ — первое и главное: кто я. Ступень стоит рядом, потому что
            именно она настраивает приложение под человека. */}
        <Group>
          <IdentityRow
            avatar={initials(user?.name ?? null, user?.email ?? null)}
            title={display}
            subtitle={user?.email ?? undefined}
            note={user?.spiritualName
              ? <span style={{ display: "block", marginTop: 1, fontFamily: FONT, fontSize: "var(--text-subhead)", fontWeight: 600, color: GOLDT }}>{user.spiritualName}</span>
              : undefined}
            onClick={() => setSheet("profile")} />
          <Row title="Ступень практики" value={level ?? "Не выбрана"} last onClick={() => setSheet("level")} />
        </Group>

        {/* «МОЁ» ЗДЕСЬ НЕ ЖИВЁТ (ЗКН-Н088). Избранное открывается сердцем в шапке
            с ЛЮБОГО экрана, заметки и прочитанное — в Практике. Дублировать вход
            в кабинете значит снова превращать его в свалку ссылок. */}
        <Group header="Аккаунт">
          <Row title="Вход и безопасность" onClick={() => setSheet("security")} />
          <Row title="Уведомления" value={pushOn == null ? undefined : pushOn ? "Включены" : "Выключены"} last onClick={() => setSheet("push")} />
        </Group>

        <Group header="Служение">
          {atLeastLevel(user, "practicing") && (
            <Row title="Мои центры" subtitle={`Ваша страница на ${SITE_HOST}`} onClick={() => onOpenPath("/my/centers")} />
          )}
          <Row title="Поддержать проект" last onClick={onDonate} />
        </Group>

        <Group header="Приложение">
          <Row title="О приложении" onClick={() => setSheet("about")} />
          <Row title="Поделиться приложением" last onClick={share} />
        </Group>

        <Group>
          <Row title="Выйти" centered destructive chevron={false} last onClick={() => void doLogout()} />
        </Group>
      </Groups>

      <p style={{
        margin: "28px 0 0", textAlign: "center", fontFamily: FONT,
        fontSize: "var(--text-footnote)", color: INK3,
      }}>
        {SITE_HOST} · ИСККОН
      </p>

      {sheet === "profile" && <ProfileSheet onClose={() => setSheet("")} />}
      {sheet === "level" && <LevelSheet onClose={() => setSheet("")} />}
      {sheet === "push" && <NotificationsSheet onClose={() => setSheet("")} />}
      {sheet === "security" && <SecuritySheet onClose={() => setSheet("")} flash={flash} />}
      {sheet === "about" && <AboutSheet onClose={() => setSheet("")} />}
    </>
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

  // Гостю — белый холст приложения и вертикальное центрирование: вход это
  // момент, а не список карточек. Вошедшему — сгруппированный холст iOS 26.5.
  if (status !== "authed") {
    return (
      <div style={{
        margin: "-16px -16px calc(-1 * (var(--content-bottom) + var(--player-extra)))",
        padding: "16px 16px calc(var(--content-bottom) + var(--player-extra) + env(safe-area-inset-bottom))",
        minHeight: "calc(100dvh - 56px)",
        background: "var(--color-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {status === "loading"
          ? <div style={{ color: INK3, fontSize: "var(--text-subhead)", fontFamily: FONT }}>Загружаю…</div>
          : <AuthPanel />}
      </div>
    );
  }

  return (
    <GroupedCanvas>
      <Dashboard onOpenPath={onOpenPath} onDonate={onDonate} flash={flash} />
    </GroupedCanvas>
  );
}

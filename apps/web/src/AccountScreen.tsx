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
import { accountClient, ApiError, type Overview, type ReadingItem, type ListenItem, type BookmarkItem, type SadhanaState } from "./account/api";
import { usePlayer } from "./player/store";
import { BOOKS, bookFullTitle } from "./books";
import { albumById } from "./kirtans";
import { useNotes, requestNote, requestOpenNote, shareNote, togglePin, type Note } from "./notes";
import { NoteHeroCard } from "./NoteHeroCard";

/* ─────────────────────────── палитра/токены ─────────────────────────── */

const GOLD = "#D2AA1B";
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
    <div style={{ width: w, height: h, borderRadius: radius, flexShrink: 0, background: "var(--color-bg-3)", color: INK3, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textAlign: "center", padding: 4 }}>
      {label ?? ""}
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 4px", marginBottom: 10 }}>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.3, color: INK, fontFamily: FONT }}>{title}</h3>
      {action && (
        <button onClick={action.onClick} style={{ background: "none", border: "none", padding: 0, color: GOLD, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
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
              <span style={{ fontSize: 15, fontWeight: 600 }}>Новая заметка</span>
            </button>
          </div>
        </HScroll>
      ) : (
        <div style={{ ...cardStyle, padding: "20px 18px", textAlign: "center" }}>
          <div style={{ width: 46, height: 46, margin: "0 auto 12px", borderRadius: 12, background: "linear-gradient(135deg, #fbf4d8 0%, #f1e1a4 100%)", color: GOLDT, display: "grid", placeItems: "center", border: `0.5px solid ${GOLD}55` }}><NoteIco size={24} /></div>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: INK, fontFamily: FONT, letterSpacing: -0.1 }}>Записывайте ценное</div>
          <p style={{ margin: "6px auto 16px", fontSize: 13.5, lineHeight: 1.5, color: INK2, fontFamily: FONT, maxWidth: 264 }}>Услышали стих или мысль, которую хочется сохранить, — добавьте её из меню «…» в любом разделе или начните прямо сейчас.</p>
          <button onClick={() => requestNote()} style={{ height: 44, padding: "0 20px", borderRadius: 13, border: "none", background: INK, color: "var(--color-bg-2)", fontFamily: FONT, fontSize: 14.5, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Новая заметка</button>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── панель входа (гость) ─────────────────────────── */

function AuthPanel() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReg = mode === "register";

  async function submit() {
    if (busy) return;
    setError(null);
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) {
      setError("Проверьте адрес e-mail.");
      return;
    }
    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов.");
      return;
    }
    setBusy(true);
    try {
      if (isReg) await register(em, password, name.trim() || undefined);
      else await login(em, password);
      // успех → AuthProvider переключит дерево на дашборд
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : ""));
    } finally {
      setBusy(false);
    }
  }

  const fieldWrap: CSSProperties = { background: SURFACE, borderRadius: 14, border: `0.5px solid ${HAIR}`, overflow: "hidden", boxShadow: "var(--shadow-card)" };
  const rowStyle: CSSProperties = { display: "flex", alignItems: "center", height: 52, padding: "0 16px", gap: 10 };
  const inputStyle: CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 17, color: INK, fontFamily: FONT, padding: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16 }}>
      {/* эмблема */}
      <div style={{ width: 76, height: 76, borderRadius: "50%", display: "grid", placeItems: "center", background: SURFACE, border: `1px solid ${HAIR}`, boxShadow: "var(--shadow-card)", marginBottom: 16 }}>
        <img src="/iskcon-sign.svg" alt="" style={{ width: 40, height: 40, opacity: 0.92 }} />
      </div>
      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: -0.4, color: INK, fontFamily: FONT, textAlign: "center" }}>Личный кабинет</h2>
      <p style={{ margin: "8px 0 22px", fontSize: 14, lineHeight: 1.5, color: INK2, fontFamily: FONT, textAlign: "center", maxWidth: 300 }}>
        Закладки, прогресс чтения и история прослушивания — на всех ваших устройствах.
      </p>

      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* сегмент-контрол */}
        <div style={{ display: "flex", background: "rgba(118,118,128,0.12)", borderRadius: 10, padding: 2, marginBottom: 18 }}>
          {(["login", "register"] as const).map((m) => {
            const on = mode === m;
            return (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                style={{
                  flex: 1, height: 34, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: FONT, fontSize: 14,
                  fontWeight: on ? 600 : 500, color: on ? INK : INK2,
                  background: on ? SURFACE : "transparent",
                  boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  transition: "all 0.18s ease", WebkitTapHighlightColor: "transparent",
                }}
              >
                {m === "login" ? "Вход" : "Регистрация"}
              </button>
            );
          })}
        </div>

        {/* поля */}
        <div style={fieldWrap}>
          {isReg && (
            <>
              <div style={rowStyle}>
                <input
                  style={inputStyle}
                  placeholder="Имя"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div style={{ height: "0.5px", background: HAIR, marginLeft: 16 }} />
            </>
          )}
          <div style={rowStyle}>
            <input
              style={inputStyle}
              type="email"
              inputMode="email"
              placeholder="E-mail"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div style={{ height: "0.5px", background: HAIR, marginLeft: 16 }} />
          <div style={rowStyle}>
            <input
              style={inputStyle}
              type={showPw ? "text" : "password"}
              placeholder="Пароль"
              autoComplete={isReg ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            />
            <button
              type="button"
              aria-label={showPw ? "Скрыть пароль" : "Показать пароль"}
              onClick={() => setShowPw((s) => !s)}
              style={{ background: "none", border: "none", padding: 4, color: INK3, cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" }}
            >
              <EyeIco off={showPw} />
            </button>
          </div>
        </div>

        {error && (
          <p style={{ margin: "12px 4px 0", fontSize: 13, lineHeight: 1.45, color: "var(--color-danger-text)", fontFamily: FONT }}>{error}</p>
        )}

        {/* основная кнопка */}
        <button
          onClick={() => void submit()}
          disabled={busy}
          style={{
            marginTop: 18, width: "100%", height: 52, borderRadius: 14, border: "none",
            background: INK, color: "var(--color-bg-2)", fontFamily: FONT, fontSize: 17, fontWeight: 600,
            cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, transition: "opacity 0.18s ease",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {busy ? "Минуту…" : isReg ? "Создать аккаунт" : "Войти"}
        </button>

        <p style={{ margin: "16px 4px 0", fontSize: 12, lineHeight: 1.5, color: INK3, fontFamily: FONT, textAlign: "center" }}>
          {isReg
            ? "Регистрируясь, вы соглашаетесь хранить отметки чтения и прослушивания в своём аккаунте."
            : "Войдите, чтобы синхронизировать закладки и прогресс."}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── дашборд (вошёл) ─────────────────────────── */

function StatStrip({ stats }: { stats: Overview["stats"] }) {
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
          <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: -0.5, color: INK, fontFamily: FONT, lineHeight: 1.1 }}>{it.value}</div>
          <div style={{ marginTop: 3, fontSize: 11, fontWeight: 500, color: INK2, fontFamily: FONT }}>{it.label}</div>
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
  const href = item.href || `/book/${item.work}`;
  return (
    <button
      onClick={() => onOpen(href)}
      style={{ flexShrink: 0, width: 116, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}
    >
      <CoverBox src={meta.cover} w={116} h={154} radius={12} label={meta.title} />
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{meta.title}</div>
      <div style={{ marginTop: 2, fontSize: 12, color: INK2, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{item.label || "Продолжить"}</div>
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
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{item.title || "Без названия"}</div>
      <div style={{ marginTop: 2, fontSize: 12, color: INK2, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{item.subtitle || item.artist || ""}</div>
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
          <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || "Закладка"}</span>
          {item.subtitle && <span style={{ display: "block", marginTop: 1, fontSize: 13, color: INK2, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subtitle}</span>}
        </span>
        {item.href && <span style={{ color: INK3, flexShrink: 0 }}><ChevR /></span>}
      </button>
      {!last && <div style={{ height: "0.5px", background: HAIR, marginLeft: 70 }} />}
    </>
  );
}

function ProfileHeader({ onEdit }: { onEdit: () => void }) {
  const { user } = useAuth();
  const display = (user?.name || "").trim() || "Преданный";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: SURFACE, borderRadius: 18, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", padding: 16 }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#E8C84A,#C09400)", color: "#fff", fontSize: 23, fontWeight: 700, fontFamily: FONT, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)" }}>
        {initials(user?.name ?? null, user?.email ?? null)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3, color: INK, fontFamily: FONT, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display}</div>
        {user?.spiritualName && <div style={{ marginTop: 1, fontSize: 13, fontWeight: 600, color: GOLD, fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.spiritualName}</div>}
        {user?.email && <div style={{ marginTop: 2, fontSize: 13, color: INK2, fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>}
      </div>
      <button
        aria-label="Изменить профиль"
        onClick={onEdit}
        style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: `0.5px solid ${HAIR}`, background: GROUPED, color: INK2, display: "grid", placeItems: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      >
        <PencilIco />
      </button>
    </div>
  );
}

function ProfileEditor({ onClose }: { onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [spiritual, setSpiritual] = useState(user?.spiritualName ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await updateProfile({ name: name.trim(), spiritualName: spiritual.trim() });
      onClose();
    } catch {
      setBusy(false);
    }
  }

  const rowStyle: CSSProperties = { display: "flex", alignItems: "center", height: 52, padding: "0 16px" };
  const inputStyle: CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 17, color: INK, fontFamily: FONT, padding: 0 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: GROUPED, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "10px 16px calc(20px + env(safe-area-inset-bottom))", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: "rgba(0,0,0,0.18)", margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: INK2, fontSize: 16, fontFamily: FONT, cursor: "pointer", padding: 0 }}>Отмена</button>
          <span style={{ fontSize: 16, fontWeight: 600, color: INK, fontFamily: FONT }}>Профиль</span>
          <button onClick={() => void save()} disabled={busy} style={{ background: "none", border: "none", color: GOLD, fontSize: 16, fontWeight: 600, fontFamily: FONT, cursor: "pointer", padding: 0, opacity: busy ? 0.5 : 1 }}>Готово</button>
        </div>
        <div style={{ background: SURFACE, borderRadius: 14, border: `0.5px solid ${HAIR}`, overflow: "hidden" }}>
          <div style={rowStyle}>
            <input style={inputStyle} placeholder="Имя" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div style={{ height: "0.5px", background: HAIR, marginLeft: 16 }} />
          <div style={rowStyle}>
            <input style={inputStyle} placeholder="Духовное имя (если есть)" value={spiritual} onChange={(e) => setSpiritual(e.target.value)} />
          </div>
        </div>
        <p style={{ margin: "10px 4px 0", fontSize: 12, lineHeight: 1.5, color: INK3, fontFamily: FONT }}>Имя отображается в кабинете. Духовное имя — по желанию.</p>
      </div>
    </div>
  );
}

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
              <span style={{ flex: 1, fontSize: 16, color: INK, fontWeight: 500 }}>{r.label}</span>
              <span style={{ color: INK3 }}><ChevR /></span>
            </button>
            {i < rows.length - 1 && <div style={{ height: "0.5px", background: HAIR, marginLeft: 56 }} />}
          </div>
        ))}
        <div style={{ height: "0.5px", background: HAIR, marginLeft: 56 }} />
        <button onClick={onLogout} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "13px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(255,59,48,0.12)", color: "var(--color-danger-text)" }}><SignOutIco size={18} /></span>
          <span style={{ flex: 1, fontSize: 16, color: "var(--color-danger-text)", fontWeight: 500 }}>Выйти</span>
        </button>
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
function pluralDays(n: number): string {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return "дней";
  if (b > 1 && b < 5) return "дня";
  if (b === 1) return "день";
  return "дней";
}

/** Карточка «Садхана сегодня» в кабинете: кольцо кругов, серия, чтение → дневник. */
function SadhanaCard({ state, onOpen }: { state: SadhanaState; onOpen: () => void }) {
  const r = state.stats.todayRounds, g = state.goal;
  const done = r >= g;
  const tone = done ? "#34C759" : GOLD;
  const RAD = 58, CIRC = 2 * Math.PI * RAD;
  const frac = Math.min(1, r / Math.max(1, g));
  const read = state.todayRow.reading_min;
  const bits: string[] = [`серия ${state.stats.currentStreak} ${pluralDays(state.stats.currentStreak)}`];
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
          <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: INK }}>{r}</span>
          <span style={{ fontFamily: FONT, fontSize: 10, color: INK2, marginTop: 1 }}>из {g}</span>
        </div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", color: done ? "#34C759" : INK }}>
          {done ? "Норма выполнена" : "Круги сегодня"}
        </div>
        <div style={{ marginTop: 3, fontFamily: FONT, fontSize: 12.5, color: INK2, textTransform: "lowercase" }}>{bits.join(" · ")}</div>
      </div>
      <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden style={{ flexShrink: 0, color: INK3 }}><path d="M1.5 1.5 7 7.5l-5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

function Dashboard({ onOpenPath, onDonate, flash }: { onOpenPath: (p: string) => void; onDonate: () => void; flash: (m: string) => void }) {
  const { logout } = useAuth();
  const player = usePlayer();
  const [ov, setOv] = useState<Overview | null>(null);
  const [sad, setSad] = useState<SadhanaState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

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

      {ov && <StatStrip stats={ov.stats} />}

      {sad && (
        <section>
          <SectionTitle title="Садхана сегодня" action={{ label: "Дневник", onClick: () => onOpenPath("/practice/diary") }} />
          <SadhanaCard state={sad} onOpen={() => onOpenPath("/practice/diary")} />
        </section>
      )}

      <section>
        <SectionTitle title="Служение" />
        <div style={{ background: SURFACE, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
          <button onClick={() => onOpenPath("/my/centers")} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "13px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(210,170,27,0.14)", color: GOLD }}><TempleIco size={18} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 16, color: INK, fontWeight: 500 }}>Мои центры</span>
              <span style={{ display: "block", fontSize: 12.5, color: INK3, marginTop: 1, lineHeight: 1.35 }}>Храм, нама-хатта, ферма — ваша страница на gaurangers.com</span>
            </span>
            <span style={{ color: INK3, flexShrink: 0 }}><ChevR /></span>
          </button>
        </div>
      </section>

      <NotesSection onOpenPath={onOpenPath} />

      {!loaded && (
        <div style={{ display: "flex", justifyContent: "center", padding: "30px 0", color: INK3, fontSize: 14, fontFamily: FONT }}>Загружаю…</div>
      )}

      {loaded && !hasAny && (
        <div style={{ background: SURFACE, borderRadius: 18, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", padding: "26px 22px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, margin: "0 auto 14px", borderRadius: "50%", background: "rgba(210,170,27,0.14)", color: GOLD, display: "grid", placeItems: "center" }}><BookIco size={26} /></div>
          <div style={{ fontSize: 17, fontWeight: 700, color: INK, fontFamily: FONT, letterSpacing: -0.2 }}>Здесь будет ваша садхана</div>
          <p style={{ margin: "8px auto 18px", fontSize: 14, lineHeight: 1.5, color: INK2, fontFamily: FONT, maxWidth: 280 }}>
            Закладки, прогресс чтения и прослушанные киртаны появятся, как только вы начнёте.
          </p>
          <button onClick={() => onOpenPath("/books")} style={{ height: 46, padding: "0 22px", borderRadius: 14, border: "none", background: INK, color: "var(--color-bg-2)", fontFamily: FONT, fontSize: 15, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
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
                <button key={it.work} onClick={() => onOpenPath(`/book/${it.work}`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
                  <CoverBox src={meta.cover} w={96} h={128} radius={10} label={meta.title} />
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: INK, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{meta.title}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <SettingsCard onEdit={() => setEditing(true)} onDonate={onDonate} onLogout={() => void doLogout()} />

      <p style={{ textAlign: "center", fontSize: 12, color: INK3, fontFamily: FONT, margin: 0 }}>gaurangers.com · ИСККОН</p>

      {editing && <ProfileEditor onClose={() => setEditing(false)} />}
    </div>
  );
}

/* ─────────────────────────── корень экрана ─────────────────────────── */

export default function AccountScreen({ onOpenPath, onDonate, flash }: { onOpenPath: (path: string) => void; onDonate: () => void; flash: (m: string) => void }) {
  const { status } = useAuth();

  return (
    // фон-вынос на всю ширину: сгруппированный серый iOS под белыми карточками
    <div style={{ margin: "-16px -16px -116px", padding: "16px 16px calc(120px + env(safe-area-inset-bottom))", minHeight: "calc(100dvh - 56px)", background: GROUPED }}>
      {status === "loading" ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80, color: INK3, fontSize: 14, fontFamily: FONT }}>Загружаю…</div>
      ) : status === "guest" ? (
        <AuthPanel />
      ) : (
        <Dashboard onOpenPath={onOpenPath} onDonate={onDonate} flash={flash} />
      )}
    </div>
  );
}

/**
 * Заметки садху — слой данных. По образцу «Избранного» (cardActions.ts):
 * local-first (localStorage `note:<id>`), реактивно через useSyncExternalStore,
 * с тонкой синхронизацией в личный кабинет (D1) когда преданный вошёл.
 *
 * Зачем local-first: садху может записать мысль мгновенно и офлайн (как Apple
 * Notes), даже не входя. Войдя — заметки бесшумно зеркалятся в D1 (бэкап +
 * перенос между устройствами). Конфликт решается по updatedAt (последняя
 * правка побеждает) — id-ключ, без тумблеров.
 *
 * Тело заметки — санитизированный HTML (contentEditable из NoteEditor), плюс
 * plain (для превью и поиска). Привязка (kind+ref+src*) связывает заметку с
 * объектом приложения: стихом, киртаном, личностью, карточкой — так «Избранное»
 * и «Заметки» становятся одним: на стихе, что в избранном, видно и заметку.
 */
import { useCallback, useSyncExternalStore } from "react";
import { api } from "./api";
import { isAuthed } from "./account/track";

/* ─────────────────────────── модель ─────────────────────────── */

/** Привязка заметки к объекту приложения (необязательна — свободная заметка). */
export interface NoteAttach {
  /** verse|chapter|book|kirtan|kirtan-track|bhajan|entity|place|doc|… */
  kind: string;
  /** стабильный ключ объекта (как в избранном: `<work>/<ref>`, slug, путь…) */
  ref: string;
  /** снимок для шапки заметки и для перехода к источнику */
  title?: string;
  subtitle?: string;
  href?: string;
}

export interface Note {
  id: string;
  title: string;
  /** санитизированный HTML тела */
  body: string;
  /** plain-text проекция (превью/поиск) */
  plain: string;
  pinned: boolean;
  /** цвет ярлычка (Apple-палитра); пусто — по умолчанию */
  color?: string;
  /** привязка к объекту (kind/ref + снимок) */
  kind?: string;
  ref?: string;
  srcTitle?: string;
  srcSubtitle?: string;
  srcHref?: string;
  createdAt: number;
  updatedAt: number;
}

/* ─────────────────────────── localStorage ─────────────────────────── */

const PREFIX = "note:";
const listeners = new Set<() => void>();
let cache: Note[] | null = null;
const EMPTY: Note[] = [];

function invalidate() {
  cache = null;
  listeners.forEach((l) => l());
}

function readAll(): Note[] {
  if (cache) return cache;
  const out: Note[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try {
        const rec = JSON.parse(localStorage.getItem(k) || "");
        if (rec && typeof rec === "object" && rec.id) out.push(normalize(rec));
      } catch {
        /* битая запись — пропускаем */
      }
    }
  } catch {
    /* приватный режим */
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  cache = out;
  return out;
}

function normalize(r: Partial<Note> & { id: string }): Note {
  return {
    id: r.id,
    title: typeof r.title === "string" ? r.title : "",
    body: typeof r.body === "string" ? r.body : "",
    plain: typeof r.plain === "string" ? r.plain : "",
    pinned: !!r.pinned,
    color: r.color || undefined,
    kind: r.kind || undefined,
    ref: r.ref || undefined,
    srcTitle: r.srcTitle || undefined,
    srcSubtitle: r.srcSubtitle || undefined,
    srcHref: r.srcHref || undefined,
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
  };
}

function writeLocal(n: Note): void {
  try {
    localStorage.setItem(PREFIX + n.id, JSON.stringify(n));
  } catch {
    /* приватный режим */
  }
}

/* ── tombstones удалений: помним, что заметка удалена, чтобы синхронизация её
   не воскрешала (например, если серверный DELETE не дошёл из-за оффлайна). ── */
const TOMB_KEY = "notes:tombstones";
function readTombs(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(TOMB_KEY) || "{}");
    return v && typeof v === "object" ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}
function writeTombs(t: Record<string, number>): void {
  try {
    if (Object.keys(t).length === 0) localStorage.removeItem(TOMB_KEY);
    else localStorage.setItem(TOMB_KEY, JSON.stringify(t));
  } catch {
    /* приватный режим */
  }
}
function addTomb(id: string): void {
  const t = readTombs();
  t[id] = Date.now();
  writeTombs(t);
}
function dropTomb(id: string): void {
  const t = readTombs();
  if (id in t) {
    delete t[id];
    writeTombs(t);
  }
}
function deleteOnServer(id: string): void {
  if (!isAuthed()) return;
  try {
    void fetch(api(`/me/notes?id=${encodeURIComponent(id)}`), { method: "DELETE", credentials: "same-origin", keepalive: true }).catch(() => undefined);
  } catch {
    /* noop */
  }
}

/* ─────────────────────────── id / plain / sanitize ─────────────────────────── */

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return "n" + crypto.randomUUID().replace(/-/g, "");
  } catch {
    /* noop */
  }
  return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Грубая, но надёжная проекция HTML → текст (для превью и поиска). */
export function htmlToPlain(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<(div|p|br|li|h1|h2|h3)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const d = document.createElement("div");
  d.innerHTML = html;
  // переводы строк по блокам, чтобы превью читалось
  d.querySelectorAll("div,p,li,h1,h2,h3,br").forEach((el) => el.insertAdjacentText("afterend", "\n"));
  return (d.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Минимальный санитайзер: убираем script/style/iframe/object, любые on*-атрибуты
 * и javascript:-ссылки. Заметки — собственный контент пользователя (рендерятся
 * только ему), но HTML из contentEditable чистим из принципа.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "");
  const tpl = document.createElement("div");
  tpl.innerHTML = html;
  tpl.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((el) => el.remove());
  tpl.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value;
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if ((name === "href" || name === "src" || name === "xlink:href") && /^\s*javascript:/i.test(val)) el.removeAttribute(attr.name);
      else if (name === "style" && /expression|url\s*\(\s*['"]?\s*javascript:/i.test(val)) el.removeAttribute(attr.name);
    }
  });
  return tpl.innerHTML;
}

/** Заголовок строки списка: title → первая строка plain → «Новая заметка». */
export function noteTitle(n: Note): string {
  if (n.title.trim()) return n.title.trim();
  const first = n.plain.split("\n").map((s) => s.trim()).find(Boolean);
  return first || "Новая заметка";
}

/** Подзаголовок-превью для строки (вторая+ строки, схлопнутые). */
export function notePreview(n: Note): string {
  const lines = n.plain.split("\n").map((s) => s.trim()).filter(Boolean);
  const titleUsed = n.title.trim() ? 0 : 1; // если заголовок взят из первой строки — пропускаем её
  return lines.slice(titleUsed).join("  ").trim();
}

/* ─────────────────────────── CRUD ─────────────────────────── */

export function getNote(id: string): Note | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    return rec && rec.id ? normalize(rec) : null;
  } catch {
    return null;
  }
}

/** Создаёт пустую заметку (опц. с привязкой) и возвращает её. */
export function createNote(attach?: NoteAttach): Note {
  const now = Date.now();
  const n: Note = {
    id: newId(),
    title: "",
    body: "",
    plain: "",
    pinned: false,
    kind: attach?.kind,
    ref: attach?.ref,
    srcTitle: attach?.title,
    srcSubtitle: attach?.subtitle,
    srcHref: attach?.href,
    createdAt: now,
    updatedAt: now,
  };
  writeLocal(n);
  invalidate();
  pushToServer(n);
  return n;
}

/** Применяет правку к заметке (по id), сохраняет и зеркалит на сервер. */
export function updateNote(id: string, patch: Partial<Omit<Note, "id" | "createdAt">>): Note | null {
  const cur = getNote(id);
  if (!cur) return null;
  const next: Note = normalize({ ...cur, ...patch, id, updatedAt: Date.now() });
  writeLocal(next);
  invalidate();
  pushToServer(next);
  return next;
}

export function togglePin(id: string): void {
  const cur = getNote(id);
  if (cur) updateNote(id, { pinned: !cur.pinned });
}

export function deleteNote(id: string): void {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    /* noop */
  }
  addTomb(id);
  invalidate();
  deleteOnServer(id);
}

/* ─────────────────────────── хуки ─────────────────────────── */

export function useNotes(): Note[] {
  return useSyncExternalStore(
    useCallback((cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    }, []),
    readAll,
    () => EMPTY,
  );
}

/** Заметки, привязанные к конкретному объекту (для «Избранного» и ридеров). */
export function notesForRef(kind: string, ref: string): Note[] {
  if (!kind || !ref) return [];
  return readAll().filter((n) => n.kind === kind && n.ref === ref);
}
export function useNotesForRef(kind: string | undefined, ref: string | undefined): Note[] {
  const all = useNotes();
  if (!kind || !ref) return EMPTY;
  return all.filter((n) => n.kind === kind && n.ref === ref);
}

/* ─────────────────────────── серверная синхронизация ─────────────────────────── */

interface ServerNote {
  id: string;
  title: string | null;
  body: string | null;
  plain: string | null;
  pinned: number;
  color: string | null;
  kind: string | null;
  ref: string | null;
  src_title: string | null;
  src_subtitle: string | null;
  src_href: string | null;
  created_at: number;
  updated_at: number;
}

function fromServer(s: ServerNote): Note {
  return normalize({
    id: s.id,
    title: s.title ?? "",
    body: s.body ?? "",
    plain: s.plain ?? "",
    pinned: !!s.pinned,
    color: s.color ?? undefined,
    kind: s.kind ?? undefined,
    ref: s.ref ?? undefined,
    srcTitle: s.src_title ?? undefined,
    srcSubtitle: s.src_subtitle ?? undefined,
    srcHref: s.src_href ?? undefined,
    createdAt: Number(s.created_at) || Date.now(),
    updatedAt: Number(s.updated_at) || Date.now(),
  });
}

function pushToServer(n: Note): void {
  if (!isAuthed()) return;
  try {
    void fetch(api("/me/notes"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        id: n.id,
        title: n.title,
        body: n.body,
        plain: n.plain,
        pinned: n.pinned ? 1 : 0,
        color: n.color ?? null,
        kind: n.kind ?? null,
        ref: n.ref ?? null,
        srcTitle: n.srcTitle ?? null,
        srcSubtitle: n.srcSubtitle ?? null,
        srcHref: n.srcHref ?? null,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      }),
    }).catch(() => undefined);
  } catch {
    /* noop */
  }
}

let synced = false;
/**
 * Разовая двусторонняя синхронизация при входе: тянем серверные заметки, мёржим
 * по updatedAt (новее побеждает), затем дозаливаем локальные. Зовётся из App при
 * статусе authed. No-op для гостя.
 */
export async function syncNotesWithServer(): Promise<void> {
  if (!isAuthed() || synced) return;
  synced = true;
  let server: Note[] = [];
  try {
    const r = await fetch(api("/me/notes"), { credentials: "same-origin" });
    if (r.ok) {
      const d = (await r.json()) as { items?: ServerNote[] };
      server = (d.items ?? []).map(fromServer);
    }
  } catch {
    synced = false; // повторим при следующем триггере
    return;
  }
  const local = readAll();
  const byId = new Map<string, { local?: Note; server?: Note }>();
  for (const n of local) byId.set(n.id, { ...(byId.get(n.id) || {}), local: n });
  for (const n of server) byId.set(n.id, { ...(byId.get(n.id) || {}), server: n });

  // Реконсиляция удалений: если заметка ещё на сервере — повторяем DELETE; если
  // сервер её больше не отдаёт — удаление подтверждено, снимаем tombstone.
  const tombs = readTombs();
  const serverIds = new Set(server.map((n) => n.id));
  for (const id of Object.keys(tombs)) {
    if (serverIds.has(id)) deleteOnServer(id);
    else dropTomb(id);
  }

  let changedLocal = false;
  for (const [id, { local: l, server: s }] of byId.entries()) {
    if (tombs[id]) continue; // удалено локально — не воскрешаем и не выгружаем заново
    if (l && s) {
      if (s.updatedAt > l.updatedAt) {
        writeLocal(s);
        changedLocal = true;
      } else if (l.updatedAt > s.updatedAt) {
        pushToServer(l);
      }
    } else if (s && !l) {
      writeLocal(s);
      changedLocal = true;
    } else if (l && !s) {
      pushToServer(l);
    }
  }
  if (changedLocal) invalidate();
}

/** Сброс флага синка при выходе (чтобы повторно слить при следующем входе). */
export function resetNotesSync(): void {
  synced = false;
}

/* ─────────────────────────── мост быстрой записи ─────────────────────────── */

export const OPEN_NOTES_EVENT = "iol:open-notes";
type PendingNotes = { attach?: NoteAttach; openId?: string; create?: boolean; nonce: number };
let pending: PendingNotes | null = null;
let nonceSeq = 0;

/**
 * Глобальный вызов «записать в заметки» из любого ⋯-меню (карточка, стих,
 * плеер). App слушает OPEN_NOTES_EVENT: создаёт заметку с привязкой к источнику
 * и открывает её подробную карточку (ПКП), которая сразу раскрывает редактор.
 */
export function requestNote(attach?: NoteAttach): void {
  pending = { create: true, attach, nonce: ++nonceSeq };
  emitOpen();
}
/** Открыть подробную карточку конкретной заметки (deep-link/из «Избранного»). */
export function requestOpenNote(id: string): void {
  pending = { openId: id, nonce: ++nonceSeq };
  emitOpen();
}
/** Просто открыть хаб «Заметки». */
export function requestNotesHub(): void {
  pending = { nonce: ++nonceSeq };
  emitOpen();
}
function emitOpen(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(OPEN_NOTES_EVENT));
  } catch {
    /* noop */
  }
}
/** App забирает отложенное намерение при открытии экрана (одноразово). */
export function takePendingNotes(): PendingNotes | null {
  const p = pending;
  pending = null;
  return p;
}

/** Поделиться заметкой (системный лист): плоский текст + подпись источника. */
export function shareNote(n: Note): void {
  if (typeof navigator === "undefined") return;
  const title = noteTitle(n);
  const sign = n.srcTitle ? `\n\n— из «${n.srcTitle}» · ISKCON ONE LOVE` : "\n\n— ISKCON ONE LOVE";
  const text = `${title}${n.plain && n.plain !== title ? "\n\n" + n.plain : ""}${sign}`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else { try { void navigator.clipboard?.writeText(text); } catch { /* noop */ } }
}

/* синхронизация между вкладками */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key.startsWith(PREFIX)) invalidate();
  });
}

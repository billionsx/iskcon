/**
 * BookLoaderPage — CRM-загрузчик книги.
 *
 * Оператор видит наполнение книги по главам (сверяется с D1 вживую), включает
 * нужные слои и грузит главу или всю книгу одной кнопкой. По умолчанию тянется
 * только общедоступная структура + санскрит («ссылка, а не копия»); перевод и
 * комментарий — слой издания, выключен и помечен статусом лицензии.
 *
 * Вызовы идут на same-origin /api/admin/* (web-воркер пишет в D1). Доступ — по
 * ключу ADMIN_TOKEN, который оператор вводит один раз (хранится локально).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { BackIcon } from "./ui/icons";
import { api } from "./api";

interface ChapterStatusRow {
  number: string;
  title_ru: string;
  verses: number;
  deva: number;
  translit: number;
  tokens: number;
  translation: number;
  purport: number;
}
interface EditionInfo {
  id: string;
  license: string | null;
  source: string | null;
}
interface StatusResp {
  work: string;
  edition: EditionInfo | null;
  chapters: ChapterStatusRow[];
}
interface LoadSummary {
  verses: number;
  deva: number;
  translit: number;
  tokens: number;
  translation: number;
  purport: number;
}
interface PreviewToken {
  term: string;
  gloss: string | null;
}
interface PreviewVerse {
  ref: string;
  devanagari: string | null;
  translit: string | null;
  uvaca: string | null;
  sourceUrl: string | null;
  translation: string | null;
  purport: string | null;
  tokens: PreviewToken[];
}

const TOKEN_KEY = "gx_admin_token";
const WORKS: { id: string; title: string; enabled: boolean }[] = [
  { id: "bg", title: "Бхагавад-гита", enabled: true },
  { id: "cc", title: "Чайтанья-чаритамрита", enabled: false },
  { id: "sb", title: "Шримад-Бхагаватам", enabled: false },
];

export default function BookLoaderPage({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState<string>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [keyInput, setKeyInput] = useState("");
  const [work] = useState("bg");
  const [layers, setLayers] = useState({ sanskrit: true, edition: false });
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadingCh, setLoadingCh] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonCh, setJsonCh] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [openCh, setOpenCh] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, PreviewVerse[]>>({});
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ "content-type": "application/json", "x-admin-token": token }),
    [token],
  );

  const openChRef = useRef<string | null>(null);

  const fetchPreview = useCallback(
    async (chapter: string) => {
      setPreviewLoading(chapter);
      try {
        const r = await fetch(api(`/admin/verses?work=${work}&chapter=${chapter}`), { headers: headers() });
        const d = (await r.json()) as { verses?: PreviewVerse[] };
        if (r.ok && Array.isArray(d.verses)) setPreview((p) => ({ ...p, [chapter]: d.verses ?? [] }));
      } catch {
        /* ignore */
      } finally {
        setPreviewLoading(null);
      }
    },
    [work, headers],
  );

  const togglePreview = useCallback(
    (chapter: string) => {
      const willOpen = openChRef.current !== chapter;
      openChRef.current = willOpen ? chapter : null;
      setOpenCh(willOpen ? chapter : null);
      if (willOpen && !preview[chapter]) void fetchPreview(chapter);
    },
    [preview, fetchPreview],
  );

  const pushLog = (line: string) => setLog((l) => [line, ...l].slice(0, 60));

  const fetchStatus = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(api(`/admin/status?work=${work}`), { headers: headers() });
      if (r.status === 401 || r.status === 503) {
        setToken("");
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch {
          /* ignore */
        }
        setErr(r.status === 503 ? "Загрузчик не настроен: задайте секрет ADMIN_TOKEN в воркере." : "Неверный ключ доступа.");
        return;
      }
      const d = (await r.json()) as StatusResp;
      setStatus(d);
    } catch {
      setErr("Не удалось получить статус. Загрузчик работает на боевом домене (через воркер).");
    }
  }, [headers, work]);

  useEffect(() => {
    if (token) void fetchStatus();
  }, [token, fetchStatus]);

  const mergeSummary = (chapter: string, s: LoadSummary) =>
    setStatus((prev) =>
      prev
        ? {
            ...prev,
            chapters: prev.chapters.map((c) =>
              c.number === chapter
                ? {
                    ...c,
                    verses: Math.max(c.verses, s.verses),
                    deva: Math.max(c.deva, s.deva),
                    translit: Math.max(c.translit, s.translit),
                    tokens: Math.max(c.tokens, s.tokens),
                    translation: Math.max(c.translation, s.translation),
                    purport: Math.max(c.purport, s.purport),
                  }
                : c,
            ),
          }
        : prev,
    );

  const loadChapter = useCallback(
    async (chapter: string): Promise<boolean> => {
      setLoadingCh(chapter);
      try {
        const r = await fetch(api(`/admin/load-chapter`), {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ work, chapter: Number(chapter), layers }),
        });
        const d = (await r.json()) as { summary?: LoadSummary; error?: string; message?: string };
        if (!r.ok || !d.summary) {
          pushLog(`Гл. ${chapter}: ошибка — ${d.message || d.error || r.status}`);
          return false;
        }
        const s = d.summary;
        pushLog(
          `Гл. ${chapter}: ${s.verses} стихов · санскрит ${s.deva}/${s.verses}` +
            (layers.edition ? ` · перевод ${s.translation} · комм. ${s.purport} · токены ${s.tokens}` : ``),
        );
        mergeSummary(chapter, s);
        setPreview((p) => {
          if (!(chapter in p)) return p;
          const n = { ...p };
          delete n[chapter];
          return n;
        });
        if (openChRef.current === chapter) void fetchPreview(chapter);
        return true;
      } catch {
        pushLog(`Гл. ${chapter}: сбой запроса`);
        return false;
      } finally {
        setLoadingCh(null);
      }
    },
    [headers, work, layers, fetchPreview],
  );

  const loadAll = useCallback(async () => {
    if (!status) return;
    const chs = status.chapters.map((c) => c.number);
    setBulk({ done: 0, total: chs.length });
    for (let i = 0; i < chs.length; i++) {
      await loadChapter(chs[i]);
      setBulk({ done: i + 1, total: chs.length });
    }
    setBulk(null);
    void fetchStatus();
  }, [status, loadChapter, fetchStatus]);

  const importJson = useCallback(async () => {
    const chapter = Number(jsonCh);
    if (!Number.isFinite(chapter) || chapter < 1) {
      pushLog("JSON: укажите номер главы.");
      return;
    }
    let verses: unknown;
    try {
      verses = JSON.parse(jsonText);
    } catch {
      pushLog("JSON: не разобрался (ожидается массив стихов).");
      return;
    }
    if (!Array.isArray(verses)) {
      pushLog("JSON: ожидается массив.");
      return;
    }
    setLoadingCh(String(chapter));
    try {
      const r = await fetch(api(`/admin/load-chapter`), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ work, chapter, layers, source: "json", verses }),
      });
      const d = (await r.json()) as { summary?: LoadSummary; error?: string; message?: string };
      if (!r.ok || !d.summary) pushLog(`JSON гл. ${chapter}: ошибка — ${d.message || d.error}`);
      else {
        pushLog(`JSON гл. ${chapter}: загружено ${d.summary.verses} стихов.`);
        mergeSummary(String(chapter), d.summary);
      }
    } catch {
      pushLog(`JSON гл. ${chapter}: сбой запроса`);
    } finally {
      setLoadingCh(null);
    }
  }, [jsonCh, jsonText, headers, work, layers]);

  const busy = !!loadingCh || !!bulk;

  /* ─────────── ворота доступа ─────────── */
  if (!token) {
    return (
      <div style={page}>
        <Header onBack={onBack} onLogout={null} />
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "60px 22px" }}>
          <div style={{ ...card, textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--color-label)" }}>Доступ к загрузчику</div>
            <p style={{ margin: "8px 0 18px", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
              Введите ключ оператора (секрет <code>ADMIN_TOKEN</code> воркера). Он сохранится только на этом устройстве.
            </p>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keyInput.trim()) {
                  const t = keyInput.trim();
                  try {
                    localStorage.setItem(TOKEN_KEY, t);
                  } catch {
                    /* ignore */
                  }
                  setToken(t);
                }
              }}
              placeholder="Ключ доступа"
              style={input}
            />
            <button
              onClick={() => {
                const t = keyInput.trim();
                if (!t) return;
                try {
                  localStorage.setItem(TOKEN_KEY, t);
                } catch {
                  /* ignore */
                }
                setToken(t);
              }}
              style={{ ...primaryBtn, width: "100%", marginTop: 12 }}
            >
              Войти
            </button>
            {err && <div style={{ marginTop: 12, fontSize: 13, color: "#c0392b" }}>{err}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <Header
        onBack={onBack}
        onLogout={() => {
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch {
            /* ignore */
          }
          setToken("");
          setStatus(null);
        }}
      />

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 18px 60px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>
            Библиотека · ингест
          </div>
          <h1 style={{ margin: "2px 0 6px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.3px", color: "var(--color-label)" }}>
            Загрузчик книги
          </h1>
          <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.5, color: "var(--color-label-2)" }}>
            Тянет тексты с vedabase.io и пишет их в базу gaurangers (D1). «Загрузить» на главе или «Загрузить всю книгу» — воркер по очереди открывает каждый стих, разбирает на слои и сохраняет.
          </p>

          {/* выбор книги */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {WORKS.map((w) => (
              <span
                key={w.id}
                title={w.enabled ? "" : "Структура есть, загрузка стихов — скоро"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "var(--font-text)",
                  background: w.id === work ? "var(--color-brand-blue)" : "var(--color-glass-regular)",
                  color: w.id === work ? "#fff" : w.enabled ? "var(--color-label)" : "var(--color-label-3, var(--color-label-2))",
                  opacity: w.enabled ? 1 : 0.55,
                }}
              >
                {w.title}
                {!w.enabled && <span style={{ fontSize: 10, fontWeight: 700 }}>скоро</span>}
              </span>
            ))}
          </div>

          {err && (
            <div style={{ ...card, marginBottom: 16, color: "#c0392b", fontSize: 14 }}>{err}</div>
          )}

          {/* слои */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={sectionLabel}>Что загружать</div>
            <Toggle
              label="Санскрит — деванагари + транслитерация"
              note="общественное достояние · структура"
              on={layers.sanskrit}
              onToggle={() => setLayers((s) => ({ ...s, sanskrit: !s.sanskrit }))}
            />
            <Toggle
              label="Издание — пословный, перевод, комментарий"
              note="из источника"
              on={layers.edition}
              onToggle={() => setLayers((s) => ({ ...s, edition: !s.edition }))}
            />
            {!layers.sanskrit && !layers.edition && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#c0392b" }}>Выберите хотя бы один слой.</div>
            )}
          </div>

          {/* массовая загрузка */}
          <button
            onClick={loadAll}
            disabled={busy || !status || (!layers.sanskrit && !layers.edition)}
            style={{
              ...primaryBtn,
              width: "100%",
              marginBottom: 18,
              opacity: busy || !status || (!layers.sanskrit && !layers.edition) ? 0.5 : 1,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {bulk ? `Загрузка… ${bulk.done}/${bulk.total} глав` : `Загрузить всю книгу${status ? ` (${status.chapters.length} глав)` : ""}`}
          </button>

          {/* таблица глав */}
          <div style={sectionLabel}>Главы</div>
          <div style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--color-label-2)" }}>
            «Смотреть» — увидеть загруженные стихи прямо здесь. «Загрузить» — залить главу из источника.
          </div>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)" }}>
            {!status && <div style={{ padding: "28px 0", textAlign: "center", color: "var(--color-label-2)", fontSize: 14 }}>Загрузка статуса…</div>}
            {status?.chapters.map((c, i) => {
              const sankDone = c.verses > 0 && c.deva >= c.verses;
              const open = openCh === c.number;
              const vs = preview[c.number];
              const last = i === status.chapters.length - 1;
              return (
                <div key={c.number} style={{ borderBottom: last && !open ? "none" : "0.5px solid var(--color-hairline)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.number}. {c.title_ru || "—"}
                      </div>
                      <div style={{ marginTop: 3, display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11.5, color: "var(--color-label-2)" }}>
                        <Chip label={`${c.verses} стихов`} />
                        <Chip label={`санскрит ${c.deva}/${c.verses}`} tone={sankDone ? "ok" : "muted"} />
                        {(layers.edition || c.translation > 0) && <Chip label={`перевод ${c.translation}`} tone={c.translation > 0 ? "ok" : "muted"} />}
                      </div>
                    </div>
                    <button onClick={() => togglePreview(c.number)} style={{ ...ghostBtn, background: open ? "var(--color-glass-regular)" : "var(--color-bg)" }}>
                      {open ? "Скрыть" : "Смотреть"}
                    </button>
                    <button
                      onClick={() => loadChapter(c.number)}
                      disabled={busy || (!layers.sanskrit && !layers.edition)}
                      style={{
                        ...ghostBtn,
                        background: loadingCh === c.number ? "var(--color-brand-blue)" : "var(--color-bg)",
                        color: loadingCh === c.number ? "#fff" : "var(--color-brand-blue)",
                        cursor: busy ? "default" : "pointer",
                        opacity: busy && loadingCh !== c.number ? 0.5 : 1,
                      }}
                    >
                      {loadingCh === c.number ? "…" : "Загрузить"}
                    </button>
                  </div>
                  {open && (
                    <div style={{ padding: "2px 14px 12px", borderTop: "0.5px solid var(--color-hairline)", background: "var(--color-bg)" }}>
                      {previewLoading === c.number && !vs ? (
                        <div style={{ padding: "14px 0", color: "var(--color-label-2)", fontSize: 13 }}>Загрузка стихов…</div>
                      ) : !vs || vs.length === 0 ? (
                        <div style={{ padding: "14px 0", color: "var(--color-label-2)", fontSize: 13 }}>Пока пусто — нажмите «Загрузить».</div>
                      ) : (
                        vs.map((v, idx) => <VersePreview key={idx} v={v} />)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* лог */}
          {log.length > 0 && (
            <>
              <div style={{ ...sectionLabel, marginTop: 22 }}>Журнал</div>
              <div style={{ ...card, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, lineHeight: 1.7, color: "var(--color-label-2)" }}>
                {log.map((l, i) => (
                  <div key={i} style={{ whiteSpace: "pre-wrap" }}>{l}</div>
                ))}
              </div>
            </>
          )}

          {/* импорт файла / JSON (резерв или ручная загрузка) */}
          <button
            onClick={() => setJsonOpen((v) => !v)}
            style={{ marginTop: 22, background: "none", border: "none", color: "var(--color-brand-blue)", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "4px 0", fontFamily: "var(--font-text)" }}
          >
            {jsonOpen ? "▾ " : "▸ "}Загрузить из файла с компьютера / JSON
          </button>
          {jsonOpen && (
            <div style={{ ...card, marginTop: 8 }}>
              <p style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.5, color: "var(--color-label-2)" }}>
                Если что-то не тянется с источника — загрузите главу из файла. Файл <code>.json</code> — массив стихов одной главы. Поля каждого стиха: <code>seg</code> («1» или «16-18»), <code>devanagari</code>, <code>translit</code>, <code>uvaca</code>, <code>tokens</code> (<code>[{`{term,gloss}`}]</code>), <code>translation</code>, <code>purport</code>. Запишется по включённым выше слоям.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <label style={{ ...primaryBtn, display: "inline-flex", alignItems: "center", height: 40, cursor: "pointer" }}>
                  Выбрать файл
                  <input
                    type="file"
                    accept=".json,.txt,application/json"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setFileName(f.name);
                      const reader = new FileReader();
                      reader.onload = () => setJsonText(String(reader.result ?? ""));
                      reader.readAsText(f);
                    }}
                  />
                </label>
                {fileName && <span style={{ fontSize: 13, color: "var(--color-label-2)" }}>{fileName}</span>}
              </div>
              <input value={jsonCh} onChange={(e) => setJsonCh(e.target.value)} placeholder="Номер главы (например, 2)" style={{ ...input, marginBottom: 8 }} />
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={'Содержимое файла появится здесь — или вставьте JSON вручную: [{"seg":"13","translit":"…","translation":"…"}]'}
                rows={6}
                style={{ ...input, height: "auto", padding: "10px 14px", resize: "vertical", fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}
              />
              <button onClick={importJson} disabled={busy} style={{ ...primaryBtn, marginTop: 10, opacity: busy ? 0.5 : 1 }}>
                Загрузить главу из файла
              </button>
            </div>
          )}

          <p style={{ marginTop: 26, fontSize: 12, lineHeight: 1.55, color: "var(--color-label-3, var(--color-label-2))" }}>
            Источник — vedabase.io (раздел /ru/library). Загрузка идёт по стихам: деванагари и транслитерация (санскрит), а при включённом «Издании» — ещё пословный, перевод и комментарий. Запись в базу идемпотентная (повтор не дублирует), у каждого стиха сохраняется ссылка на оригинал.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────── мелкие части ─────────── */
function Header({ onBack, onLogout }: { onBack: () => void; onLogout: (() => void) | null }) {
  return (
    <header style={{ flexShrink: 0, height: 56, display: "flex", alignItems: "center", gap: 4, padding: "0 8px", borderBottom: "0.5px solid var(--color-hairline)", background: "var(--color-bg)" }}>
      <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", border: "none", background: "none", cursor: "pointer", color: "var(--color-label)" }}>
        <BackIcon size={22} />
      </button>
      <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "var(--color-label)" }}>Загрузчик · CRM</div>
      {onLogout && (
        <button onClick={onLogout} style={{ height: 34, padding: "0 12px", background: "none", border: "none", color: "var(--color-label-2)", fontSize: 14, cursor: "pointer", fontFamily: "var(--font-text)" }}>
          Выйти
        </button>
      )}
    </header>
  );
}

function Toggle({ label, note, on, onToggle, warn }: { label: string; note?: string; on: boolean; onToggle: () => void; warn?: boolean }) {
  return (
    <button onClick={onToggle} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "10px 2px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-text)" }}>
      <span style={{ minWidth: 0, paddingRight: 12 }}>
        <span style={{ display: "block", fontSize: 15, color: "var(--color-label)" }}>{label}</span>
        {note && <span style={{ display: "block", marginTop: 2, fontSize: 12, color: warn ? "#a8700a" : "var(--color-label-2)" }}>{note}</span>}
      </span>
      <span aria-hidden style={{ position: "relative", width: 42, height: 26, borderRadius: 999, flexShrink: 0, background: on ? (warn ? "#d99100" : "var(--color-brand-blue)") : "var(--color-glass-regular)", transition: "background .2s" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
      </span>
    </button>
  );
}

function Chip({ label, tone = "muted" }: { label: string; tone?: "ok" | "muted" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px", borderRadius: 999, background: tone === "ok" ? "rgba(0,122,255,.12)" : "var(--color-glass-regular)", color: tone === "ok" ? "var(--color-brand-blue)" : "var(--color-label-2)", fontSize: 11, fontWeight: 600 }}>
      {label}
    </span>
  );
}

function VersePreview({ v }: { v: PreviewVerse }) {
  const [more, setMore] = useState(false);
  const empty = !v.devanagari && !v.translit && !v.translation && !v.purport && v.tokens.length === 0;
  const purp = v.purport ?? "";
  const long = purp.length > 280;
  return (
    <div style={{ padding: "12px 0", borderTop: "0.5px dashed var(--color-hairline)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-brand-blue)" }}>{v.ref}</span>
        {v.sourceUrl && (
          <a href={v.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--color-label-3, var(--color-label-2))" }}>
            источник ↗
          </a>
        )}
      </div>
      {empty ? (
        <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--color-label-3, var(--color-label-2))" }}>пусто — не загружено</div>
      ) : (
        <>
          {v.devanagari && <div style={{ marginTop: 6, fontSize: 15, lineHeight: 1.6, color: "var(--color-label)", whiteSpace: "pre-line" }}>{v.devanagari}</div>}
          {v.translit && <div style={{ marginTop: 4, fontSize: 13, fontStyle: "italic", color: "var(--color-label-2)", whiteSpace: "pre-line" }}>{v.translit}</div>}
          {v.tokens.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: "var(--color-label-2)" }}>
              {v.tokens.map((t, i) => (
                <span key={i}>
                  <b style={{ fontWeight: 600, color: "var(--color-label)" }}>{t.term}</b>
                  {t.gloss ? ` — ${t.gloss}` : ""}
                  {i < v.tokens.length - 1 ? "; " : ""}
                </span>
              ))}
            </div>
          )}
          {v.translation && <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: "var(--color-label)" }}>{v.translation}</div>}
          {v.purport && (
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55, color: "var(--color-label-2)", whiteSpace: "pre-line" }}>
              {long && !more ? purp.slice(0, 280) + "…" : purp}
              {long && (
                <button onClick={() => setMore((m) => !m)} style={{ marginLeft: 6, background: "none", border: "none", color: "var(--color-brand-blue)", cursor: "pointer", fontSize: 12, padding: 0, fontFamily: "var(--font-text)" }}>
                  {more ? "свернуть" : "развернуть"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────── стили ─────────── */
const page: CSSProperties = { display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)" };
const card: CSSProperties = { borderRadius: 14, padding: "16px 18px", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" };
const input: CSSProperties = { width: "100%", boxSizing: "border-box", height: 44, padding: "0 14px", borderRadius: 12, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg)", color: "var(--color-label)", fontSize: 15, fontFamily: "var(--font-text)", outline: "none" };
const primaryBtn: CSSProperties = { height: 46, padding: "0 18px", borderRadius: 12, border: "none", background: "var(--color-brand-blue)", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "var(--font-text)", cursor: "pointer" };
const sectionLabel: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--color-label-2)", margin: "0 0 10px" };
const ghostBtn: CSSProperties = { flexShrink: 0, height: 34, padding: "0 12px", borderRadius: 10, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg)", color: "var(--color-brand-blue)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-text)", cursor: "pointer" };

/**
 * Сторис-инструмент — страница gaurangers.com/stories-tool.
 *
 * Оператор запускает забор Telegram Stories канала: страница дёргает бэкенд
 * (/api/stories-sync/*, который диспетчеризует GitHub Actions workflow tg-stories.yml),
 * показывает живой статус прогона и текущий манифест (что уже захвачено на archive.org).
 * Доступ — по ADMIN_TOKEN (тот же, что у загрузчика аудио).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

const TOKEN_KEY = "dl_admin_token"; // тот же оператор, что у загрузчика

const card: React.CSSProperties = {
  background: "var(--color-bg-2)",
  border: "1px solid var(--color-hairline)",
  borderRadius: "var(--radius-lg)",
  padding: 16,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--color-bg-3)",
  border: "1px solid var(--color-hairline)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-label)",
  fontSize: "var(--text-callout)",
  padding: "11px 12px",
  outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: "var(--text-footnote)", color: "var(--color-label-2)", margin: "0 0 6px", display: "block" };

type RunState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "running"; tag: string; status: string; htmlUrl?: string }
  | { phase: "done"; tag: string; htmlUrl?: string; conclusion: string | null }
  | { phase: "failed"; message: string };

interface Story { id: number; type: string; file: string; caption: string | null; date: string | null; expire: string | null; pinned: boolean }
interface Manifest { ok: boolean; channel?: string; generated_at?: string; count?: number; stories?: Story[]; status?: number }

const IA_BASE = "https://archive.org/download/iskcone-stories/";

function TokenGate({ onSet }: { onSet: (t: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ ...card, marginTop: 16 }}>
      <div style={{ fontSize: "var(--text-body)", fontWeight: 600, marginBottom: 4 }}>Доступ оператора</div>
      <div style={{ fontSize: "var(--text-footnote)", color: "var(--color-label-2)", marginBottom: 14 }}>
        Введи ADMIN_TOKEN — он хранится только в этой вкладке.
      </div>
      <input type="password" value={val} placeholder="ADMIN_TOKEN" onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) onSet(val.trim()); }} style={inputStyle} />
      <button onClick={() => val.trim() && onSet(val.trim())} disabled={!val.trim()}
        style={{ marginTop: 12, width: "100%", border: "none", borderRadius: "var(--radius-sm)", padding: 12, fontSize: "var(--text-callout)", fontWeight: 600, color: "#fff", background: val.trim() ? "var(--color-gold-deep)" : "var(--color-fill-2)", cursor: val.trim() ? "pointer" : "default" }}>
        Войти
      </button>
    </div>
  );
}

function fmtTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

export default function StoriesToolScreen({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState<string>(() => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } });
  const [channel, setChannel] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [mf, setMf] = useState<Manifest | null>(null);
  const [mfLoading, setMfLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const saveToken = (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* noop */ } setToken(t); };

  const loadManifest = useCallback(async () => {
    setMfLoading(true);
    try {
      const res = await fetch(api("/stories-sync/manifest"), { headers: { "x-admin-token": token } });
      setMf((await res.json()) as Manifest);
    } catch { setMf({ ok: false, stories: [] }); }
    finally { setMfLoading(false); }
  }, [token]);

  useEffect(() => { if (token) loadManifest(); }, [token, loadManifest]);

  function poll(tag: string) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    const tick = async () => {
      try {
        const res = await fetch(api(`/stories-sync/status?tag=${encodeURIComponent(tag)}`), { headers: { "x-admin-token": token } });
        const d = (await res.json()) as { found?: boolean; status?: string; conclusion?: string | null; htmlUrl?: string };
        if (d.found && d.status === "completed") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setRun({ phase: "done", tag, htmlUrl: d.htmlUrl, conclusion: d.conclusion ?? null });
          loadManifest();
        } else {
          setRun({ phase: "running", tag, status: d.status || "queued", htmlUrl: d.htmlUrl });
        }
      } catch { /* продолжаем опрашивать */ }
    };
    tick();
    pollRef.current = window.setInterval(tick, 4000);
  }

  async function start() {
    setRun({ phase: "starting" });
    try {
      const res = await fetch(api("/stories-sync/run"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ channel: channel.trim(), identifier: identifier.trim() }),
      });
      const d = (await res.json()) as { ok?: boolean; tag?: string; error?: string; detail?: string };
      if (!res.ok || !d.ok || !d.tag) {
        if (res.status === 401) { saveToken(""); setRun({ phase: "failed", message: "Неверный ADMIN_TOKEN" }); return; }
        setRun({ phase: "failed", message: d.error === "gh_token_missing" ? "На сервере не задан GH_TOKEN" : (d.detail || d.error || "Не удалось запустить") });
        return;
      }
      poll(d.tag);
    } catch (e) { setRun({ phase: "failed", message: (e as Error).message }); }
  }

  const busy = run.phase === "starting" || run.phase === "running";

  if (!token) {
    return (
      <Wrap onBack={onBack}>
        <TokenGate onSet={saveToken} />
      </Wrap>
    );
  }

  const stories = mf?.stories || [];

  return (
    <Wrap onBack={onBack}>
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: "var(--text-body)", fontWeight: 600, marginBottom: 4 }}>Забор сторис канала</div>
        <div style={{ fontSize: "var(--text-footnote)", color: "var(--color-label-2)", marginBottom: 14, lineHeight: 1.5 }}>
          Заберёт активные и закреплённые Stories канала через Telegram-сессию и опубликует на archive.org.
          Круг сторис в приложении обновится автоматически. Также идёт по расписанию каждые 3 ч.
        </div>

        <label style={labelStyle}>Канал (пусто = @iskcone)</label>
        <input value={channel} placeholder="@iskcone" onChange={(e) => setChannel(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
        <label style={labelStyle}>archive.org id (пусто = iskcone-stories)</label>
        <input value={identifier} placeholder="iskcone-stories" onChange={(e) => setIdentifier(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

        <button onClick={start} disabled={busy}
          style={{ width: "100%", border: "none", borderRadius: "var(--radius-sm)", padding: 13, fontSize: "var(--text-callout)", fontWeight: 700, color: "#fff", background: busy ? "var(--color-fill-2)" : "var(--color-gold-deep)", cursor: busy ? "default" : "pointer" }}>
          {run.phase === "starting" ? "Запуск…" : run.phase === "running" ? `Идёт забор · ${run.status}` : "Забрать сторис сейчас"}
        </button>

        {run.phase === "done" && (
          <div style={{ marginTop: 12, fontSize: "var(--text-subhead)", color: run.conclusion === "success" ? "var(--color-green, #2e7d32)" : "var(--color-label)" }}>
            {run.conclusion === "success" ? "✓ Готово — манифест обновлён ниже." : `Завершено: ${run.conclusion}`}
            {run.htmlUrl && <> · <a href={run.htmlUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-gold-deep)" }}>лог</a></>}
          </div>
        )}
        {run.phase === "failed" && (
          <div style={{ marginTop: 12, fontSize: "var(--text-subhead)", color: "var(--color-red, #c62828)" }}>{run.message}</div>
        )}
      </div>

      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: "var(--text-subhead)", fontWeight: 600 }}>Сейчас в круге{typeof mf?.count === "number" ? ` · ${stories.length}` : ""}</div>
          <button onClick={loadManifest} disabled={mfLoading}
            style={{ border: "1px solid var(--color-hairline)", background: "var(--color-bg-3)", color: "var(--color-label-2)", borderRadius: 999, padding: "5px 12px", fontSize: "var(--text-footnote)", cursor: "pointer" }}>
            {mfLoading ? "…" : "Обновить"}
          </button>
        </div>
        {mf?.generated_at && <div style={{ fontSize: "var(--text-caption)", color: "var(--color-label-3)", marginBottom: 10 }}>Обновлено: {fmtTime(mf.generated_at)}</div>}
        {stories.length === 0 ? (
          <div style={{ fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>
            {mf && mf.ok === false ? "Манифест ещё не создан — запусти забор." : "Сторис не найдено. Если у канала сейчас нет активных Stories — это нормально."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
            {stories.map((s) => (
              <div key={s.id} style={{ position: "relative", aspectRatio: "9 / 16", borderRadius: 10, overflow: "hidden", background: "var(--color-bg-3)" }}>
                <img src={IA_BASE + s.file} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {s.pinned && <span style={{ position: "absolute", top: 4, left: 4, fontSize: "var(--text-caption2)", fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "1px 5px" }}>закреп.</span>}
                {s.type === "video" && <span style={{ position: "absolute", top: 4, right: 4, fontSize: "var(--text-caption2)", color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "1px 5px" }}>видео</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Wrap>
  );
}

function Wrap({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "max(12px, env(safe-area-inset-top)) 16px 40px" }}>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, border: "none", background: "none", color: "var(--color-label-2)", fontSize: "var(--text-subhead)", cursor: "pointer", padding: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Назад
        </button>
        <h1 style={{ margin: "12px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: "var(--weight-heavy)", letterSpacing: 'var(--ls-title1)' }}>Сторис</h1>
        {children}
      </div>
    </div>
  );
}

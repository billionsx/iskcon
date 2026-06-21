/**
 * Загрузчик аудио — страница gaurangers.com/downloader.
 *
 * Оператор задаёт Telegram-канал и режим; страница запускает выгрузку на бэкенде
 * (/api/downloader/*, который диспетчеризует GitHub Actions) и показывает живой
 * статус. По готовности отдаёт ссылку на .zip (путь Б) или ссылку на объект
 * archive.org (путь А). Доступ — по ADMIN_TOKEN (тот же, что у CRM-загрузчика).
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";

const TOKEN_KEY = "dl_admin_token";

type Mode = "package" | "upload";
type IaMode = "new_item" | "attach_to_book";

type RunState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "running"; tag: string; status: string; htmlUrl?: string }
  | { phase: "done"; tag: string; htmlUrl?: string; artifactId?: number; sizeBytes?: number; archiveUrl?: string }
  | { phase: "failed"; tag?: string; htmlUrl?: string; message: string };

const card: React.CSSProperties = {
  background: "var(--color-bg-2)",
  border: "1px solid var(--color-hairline)",
  borderRadius: "var(--radius-lg)",
  padding: 16,
};
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--color-label-2)",
  marginBottom: 6,
  display: "block",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--color-bg-3)",
  border: "1px solid var(--color-hairline)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-label)",
  fontSize: 16,
  padding: "11px 12px",
  outline: "none",
};

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        background: "var(--color-bg-3)",
        borderRadius: "var(--radius-sm)",
        padding: 4,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              border: "none",
              cursor: "pointer",
              borderRadius: "var(--radius-xs)",
              padding: "8px 10px",
              fontSize: 14,
              fontWeight: on ? 600 : 500,
              color: on ? "var(--color-label)" : "var(--color-label-2)",
              background: on ? "var(--color-bg)" : "transparent",
              boxShadow: on ? "0 1px 2px rgba(0,0,0,0.18)" : "none",
              transition: "background .15s",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function TokenGate({ onSet }: { onSet: (t: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ ...card, marginTop: 16 }}>
      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Доступ оператора</div>
      <div style={{ fontSize: 13, color: "var(--color-label-2)", marginBottom: 14 }}>
        Введи ADMIN_TOKEN. Он хранится только в этой вкладке и уходит по защищённому каналу
        на твой же домен.
      </div>
      <input
        type="password"
        value={val}
        placeholder="ADMIN_TOKEN"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim()) onSet(val.trim());
        }}
        style={inputStyle}
      />
      <button
        onClick={() => val.trim() && onSet(val.trim())}
        disabled={!val.trim()}
        style={{
          marginTop: 12,
          width: "100%",
          border: "none",
          borderRadius: "var(--radius-sm)",
          padding: "12px",
          fontSize: 16,
          fontWeight: 600,
          color: "#fff",
          background: val.trim() ? "var(--color-brand-blue)" : "var(--color-fill-2)",
          cursor: val.trim() ? "pointer" : "default",
        }}
      >
        Войти
      </button>
    </div>
  );
}

function human(n?: number): string {
  if (!n) return "";
  const u = ["Б", "КБ", "МБ", "ГБ"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

export default function DownloaderScreen({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  });

  const [channel, setChannel] = useState("");
  const [mode, setMode] = useState<Mode>("package");
  const [iaMode, setIaMode] = useState<IaMode>("new_item");
  const [identifier, setIdentifier] = useState("");
  const [relatedBookUrl, setRelatedBookUrl] = useState("");
  const [bookIdentifier, setBookIdentifier] = useState("");
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const pollRef = useRef<number | null>(null);

  function setTokenPersist(t: string) {
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* noop */
    }
    setToken(t);
  }
  function logout() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* noop */
    }
    setToken("");
    setRun({ phase: "idle" });
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  async function start() {
    if (!channel.trim()) return;
    setRun({ phase: "starting" });
    try {
      const res = await fetch(api("/downloader/run"), {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({
          channel: channel.trim(),
          mode,
          iaMode,
          identifier: identifier.trim(),
          relatedBookUrl: relatedBookUrl.trim(),
          bookIdentifier: bookIdentifier.trim(),
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok || !data.ok) {
        setRun({ phase: "failed", message: ruError(String(data.error || res.status)) });
        return;
      }
      const tag = String(data.tag);
      setRun({ phase: "running", tag, status: "queued" });
      poll(tag);
    } catch (e) {
      setRun({ phase: "failed", message: (e as Error).message });
    }
  }

  function poll(tag: string) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    const tick = async () => {
      try {
        const res = await fetch(api(`/downloader/status?tag=${encodeURIComponent(tag)}`), {
          headers: { "x-admin-token": token },
        });
        const d = (await res.json()) as Record<string, unknown>;
        const status = String(d.status || "queued");
        const htmlUrl = d.htmlUrl ? String(d.htmlUrl) : undefined;
        if (status === "completed") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          if (d.conclusion === "success") {
            setRun({
              phase: "done",
              tag,
              htmlUrl,
              artifactId: d.artifactId ? Number(d.artifactId) : undefined,
              sizeBytes: d.sizeBytes ? Number(d.sizeBytes) : undefined,
              archiveUrl:
                mode === "upload" && iaMode === "new_item" && identifier.trim()
                  ? `https://archive.org/details/${identifier.trim()}`
                  : undefined,
            });
          } else {
            setRun({ phase: "failed", tag, htmlUrl, message: "Прогон завершился с ошибкой." });
          }
        } else {
          setRun({ phase: "running", tag, status, htmlUrl });
        }
      } catch {
        /* сетевой сбой — попробуем на следующем тике */
      }
    };
    void tick();
    pollRef.current = window.setInterval(tick, 4000);
  }

  async function downloadZip(artifactId: number) {
    try {
      const res = await fetch(api(`/downloader/artifact?id=${artifactId}`), {
        headers: { "x-admin-token": token },
      });
      const d = (await res.json()) as { url?: string };
      if (d.url) window.location.href = d.url;
    } catch {
      /* noop */
    }
  }

  const running = run.phase === "starting" || run.phase === "running";
  const canStart =
    channel.trim() &&
    (mode === "package" ||
      (iaMode === "new_item" ? identifier.trim() : bookIdentifier.trim()));

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      {/* sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          background: "color-mix(in srgb, var(--color-bg) 86%, transparent)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderBottom: "1px solid var(--color-hairline)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--color-brand-blue)",
            fontSize: 16,
            cursor: "pointer",
            padding: "4px 4px 4px 0",
          }}
        >
          ‹ Назад
        </button>
        <div style={{ fontSize: 17, fontWeight: 600 }}>Загрузчик аудио</div>
        {token && (
          <button
            onClick={logout}
            style={{
              marginLeft: "auto",
              border: "none",
              background: "transparent",
              color: "var(--color-label-2)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Выйти
          </button>
        )}
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 560, width: "100%", margin: "0 auto" }}>
        {!token ? (
          <TokenGate onSet={setTokenPersist} />
        ) : (
          <>
            <p style={{ fontSize: 14, color: "var(--color-label-2)", margin: "0 0 16px" }}>
              Выгружает все аудио из Telegram-канала. <b style={{ color: "var(--color-label)" }}>Архив .zip</b> —
              соберёт файлы и даст ссылку на скачивание. <b style={{ color: "var(--color-label)" }}>На archive.org</b> —
              зальёт напрямую и свяжет с книгой.
            </p>

            <div style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Telegram-канал</label>
                <input
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="@kirtan_channel или t.me/…"
                  style={inputStyle}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              <div>
                <label style={labelStyle}>Что сделать</label>
                <Segmented
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "package", label: "Архив .zip" },
                    { value: "upload", label: "На archive.org" },
                  ]}
                />
              </div>

              {mode === "upload" && (
                <>
                  <div>
                    <label style={labelStyle}>Связь с книгой</label>
                    <Segmented
                      value={iaMode}
                      onChange={setIaMode}
                      options={[
                        { value: "new_item", label: "Новый объект" },
                        { value: "attach_to_book", label: "В объект книги" },
                      ]}
                    />
                  </div>

                  {iaMode === "new_item" ? (
                    <>
                      <div>
                        <label style={labelStyle}>Идентификатор объекта (латиница/цифры/-/_/.)</label>
                        <input
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder="iskcon-kirtans-vol1"
                          style={inputStyle}
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>URL книги для кросс-связи (необязательно)</label>
                        <input
                          value={relatedBookUrl}
                          onChange={(e) => setRelatedBookUrl(e.target.value)}
                          placeholder="https://archive.org/details/…"
                          style={inputStyle}
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label style={labelStyle}>Идентификатор существующего объекта книги</label>
                      <input
                        value={bookIdentifier}
                        onChange={(e) => setBookIdentifier(e.target.value)}
                        placeholder="bhagavad-gita-ru"
                        style={inputStyle}
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                  )}
                </>
              )}

              <button
                onClick={start}
                disabled={!canStart || running}
                style={{
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  padding: "13px",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#fff",
                  background: !canStart || running ? "var(--color-fill-2)" : "var(--color-brand-blue)",
                  cursor: !canStart || running ? "default" : "pointer",
                }}
              >
                {running ? "Запущено…" : mode === "package" ? "Собрать архив" : "Залить на archive.org"}
              </button>
            </div>

            {run.phase !== "idle" && (
              <div style={{ ...card, marginTop: 16 }}>
                <StatusBlock run={run} mode={mode} onDownload={downloadZip} />
              </div>
            )}

            <p style={{ fontSize: 12, color: "var(--color-label-3)", marginTop: 18, lineHeight: 1.5 }}>
              Тяжёлую работу делает раннер GitHub Actions (Python/Telethon) — браузер и Worker
              MTProto и большие файлы не тянут. Ключи Telegram/archive.org заданы в секретах
              репозитория; здесь они не вводятся.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBlock({
  run,
  mode,
  onDownload,
}: {
  run: RunState;
  mode: Mode;
  onDownload: (id: number) => void;
}) {
  if (run.phase === "starting")
    return <Row dot="#ffb020" text="Запускаю прогон…" />;

  if (run.phase === "running") {
    const map: Record<string, string> = {
      queued: "В очереди раннера…",
      in_progress: mode === "package" ? "Качаю аудио и пакую…" : "Качаю аудио и заливаю…",
      completed: "Завершение…",
    };
    return (
      <>
        <Row dot="#ffb020" text={map[run.status] || run.status} pulse />
        {run.htmlUrl && <LogLink url={run.htmlUrl} />}
      </>
    );
  }

  if (run.phase === "done") {
    return (
      <>
        <Row dot="#30d158" text="Готово." />
        {run.archiveUrl && (
          <a
            href={run.archiveUrl}
            target="_blank"
            rel="noreferrer"
            style={resultBtn("var(--color-brand-blue)")}
          >
            Открыть на archive.org
          </a>
        )}
        {run.artifactId && (
          <button onClick={() => onDownload(run.artifactId!)} style={resultBtn("var(--color-brand-blue)")}>
            Скачать .zip{run.sizeBytes ? ` · ${human(run.sizeBytes)}` : ""}
          </button>
        )}
        {!run.archiveUrl && !run.artifactId && mode === "upload" && (
          <div style={{ fontSize: 13, color: "var(--color-label-2)", marginTop: 8 }}>
            Файлы добавлены в объект книги на archive.org.
          </div>
        )}
        {run.htmlUrl && <LogLink url={run.htmlUrl} />}
      </>
    );
  }

  // failed
  return (
    <>
      <Row dot="#ff453a" text={run.message} />
      {run.htmlUrl && <LogLink url={run.htmlUrl} />}
    </>
  );
}

function Row({ dot, text, pulse }: { dot: string; text: string; pulse?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: dot,
          flexShrink: 0,
          animation: pulse ? "dlpulse 1.4s ease-in-out infinite" : undefined,
        }}
      />
      <span style={{ fontSize: 15, color: "var(--color-label)" }}>{text}</span>
      <style>{"@keyframes dlpulse{0%,100%{opacity:1}50%{opacity:.35}}"}</style>
    </div>
  );
}

function LogLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-block",
        marginTop: 10,
        fontSize: 13,
        color: "var(--color-label-2)",
        textDecoration: "none",
      }}
    >
      Лог прогона ↗
    </a>
  );
}

function resultBtn(bg: string): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "center",
    marginTop: 12,
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "12px",
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    background: bg,
    cursor: "pointer",
    textDecoration: "none",
  };
}

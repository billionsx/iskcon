/**
 * MediaCard — видео/аудио с archive.org как элемент ленты (feed_media). Ролики
 * @bhakti.school, скачанные и перезалитые на наш archive.org, играют ЗДЕСЬ бесшовно
 * (<video> из stream_url) — как рилс, без ухода на YouTube. По эталону поста ленты:
 * превью с кнопкой play, действия оверлеем (♥ · ⋯), заголовок РУ и источник — ниже.
 *
 * ⋯ → Поделиться (оригинал) · QR-код · Сообщить об ошибке. ♥ — ключ media:<guid>.
 */
import { useState } from "react";
import { CardActionBtns } from "../cardActions";
import { AudioShowcaseCard } from "../AudioShowcaseCard";
import { BookMenuSheet } from "../BookMenuSheet";
import { QrSheet } from "../QrSheet";
import { ReportSheet } from "../ReportSheet";
import { COVER_FALLBACK } from "../ui/CoverFallback";
import type { MediaItem } from "./types";

function fmtDate(iso: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }).replace(/\s*г\.$/, ""); }
  catch { return ""; }
}

export function MediaCard({ m, flash }: { m: MediaItem; flash: (m: string) => void }) {
  const [playing, setPlaying] = useState(false);
  const [menu, setMenu] = useState(false);
  const [qr, setQr] = useState(false);
  const [report, setReport] = useState(false);
  const isAudio = m.kind === "audio";

  const favKey = `media:${m.guid}`;
  const favMeta = { t: m.title.slice(0, 140), s: m.sourceLabel };
  const shareUrl = m.url;

  const onPick = (id: string) => {
    if (id === "share") {
      if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title: m.title, url: shareUrl }).catch(() => {});
      else { navigator.clipboard?.writeText(shareUrl).catch(() => {}); flash("Ссылка скопирована"); }
    } else if (id === "qr") { setQr(true); }
    else if (id === "report") { setReport(true); }
  };

  // ЗКН-Д015: звук рисует ОДИН компонент — ВКЗ (AudioShowcaseCard), а не свой плеер.
  if (isAudio) {
    return (
      <article style={{ overflow: "hidden", background: "var(--color-bg-2)", borderRadius: 20 }}>
        <AudioShowcaseCard src={m.streamUrl} title={m.title}
          presenter={m.author || m.sourceLabel} kindLabel={m.sourceLabel}
          cover={m.thumb || undefined} durationHint={m.duration || undefined}
          favKey={favKey} favMeta={favMeta} onMore={() => setMenu(true)} flash={flash} />
        {m.summary && <p style={{ margin: "10px 15px 14px", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.5, color: "var(--color-label-2)" }}>{m.summary}</p>}
        <BookMenuSheet open={menu} onClose={() => setMenu(false)} onSelect={onPick} variant="post" noTelegram noPdf />
        {qr && <QrSheet url={shareUrl} data={{ kind: "card", title: m.title, subtitle: m.sourceLabel }} onClose={() => setQr(false)} />}
        <ReportSheet open={report} onClose={() => setReport(false)} context={`Медиа · ${m.sourceLabel} · ${shareUrl}`} />
      </article>
    );
  }

  return (
    <article style={{ overflow: "hidden", background: "var(--color-bg-2)", borderRadius: 20 }}>
      <div style={{ position: "relative" }}>
        {playing && m.streamUrl ? (
          <video src={m.streamUrl} poster={m.thumb || undefined} controls autoPlay playsInline preload="metadata"
            style={{ width: "100%", display: "block", maxHeight: "80vh", background: "#000" }} />
        ) : (
          <div role="button" tabIndex={0} aria-label="Смотреть видео" onClick={() => m.streamUrl && setPlaying(true)}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && m.streamUrl) { e.preventDefault(); setPlaying(true); } }}
            style={{ position: "relative", cursor: "pointer", background: "#000", WebkitTapHighlightColor: "transparent" }}>
            <img src={m.thumb || COVER_FALLBACK} alt="" loading="lazy"
              style={{ width: "100%", display: "block", aspectRatio: "16 / 9", objectFit: "cover" }} />
            <span aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <span style={{ width: 58, height: 58, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" style={{ marginLeft: 3 }}><path d="M8 5v14l11-7z" fill="#fff" /></svg>
              </span>
            </span>
            {m.duration && (
              <span style={{ position: "absolute", left: 10, bottom: 10, padding: "3px 8px", borderRadius: 999, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 700, color: "#fff", letterSpacing: "0.2px" }}>{m.duration}</span>
            )}
          </div>
        )}
        {!playing && (
          <>
            <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 96, background: "linear-gradient(rgba(0,0,0,0.5), transparent)", pointerEvents: "none", zIndex: 2 }} />
            <div style={{ position: "absolute", top: 16, right: 16, zIndex: 4 }}>
              <CardActionBtns favKey={favKey} meta={favMeta} flash={flash} dark onMore={() => setMenu(true)} />
            </div>
          </>
        )}
      </div>

      <div style={{ padding: "12px 15px 15px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ padding: "2px 8px", borderRadius: 999, background: "color-mix(in srgb, var(--color-gold) 16%, transparent)", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-gold-deep)" }}>{m.sourceLabel}</span>
          {m.author && <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>{m.author}</span>}
        </div>
        <h3 style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.32, color: "var(--color-label)" }}>{m.title}</h3>
        {m.summary && (
          <p style={{ margin: "6px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.5, color: "var(--color-label-2)" }}>{m.summary}</p>
        )}
        {(m.publishedAt) && (
          <div style={{ marginTop: 8, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>{fmtDate(m.publishedAt)}</div>
        )}
      </div>

      <BookMenuSheet open={menu} onClose={() => setMenu(false)} onSelect={onPick} variant="post" noTelegram noPdf />
      {qr && <QrSheet url={shareUrl} data={{ kind: "card", title: m.title, subtitle: m.sourceLabel }} onClose={() => setQr(false)} />}
      <ReportSheet open={report} onClose={() => setReport(false)} context={`Медиа · ${m.sourceLabel} · ${shareUrl}`} />
    </article>
  );
}

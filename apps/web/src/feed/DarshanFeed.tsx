/**
 * DarshanFeed — раздел «Даршан» Садханы как единая лента с семью линзами (субтабы
 * iOS-26, стандарт Apple 2026): Лента · Новости · Фото · Видео · Аудио · Файлы ·
 * Ссылки. Один поток контента, много срезов (ЗКН-Пл018).
 *
 *   • Лента   — всё вперемешку по дате: посты Telegram-канала + новости агентств
 *               ИСККОН + видео/аудио с archive.org. Сверху — кольца даршана дня.
 *   • Новости — только статьи агентств (перевод RU), вглубь по всему архиву.
 *   • Фото/Видео/Аудио/Файлы/Ссылки — посты канала, отфильтрованные по типу медиа;
 *               Видео и Аудио дополнены автономными записями с archive.org.
 *
 * Активный субтаб — В АДРЕСЕ (ЗКН-Н073): /darshan · /darshan/news · /darshan/photo …
 * и /darshan/news/<slug> для фокуса новости. Субтаб читается из пути, а не помнится
 * (ЗКН-Н031): переключение идёт через nav.ts (pushUrl), возврат «назад» и обновление
 * страницы попадают ровно на тот же срез.
 */
import { useEffect, useRef, useState } from "react";
import { FilterChips } from "../ui/nav4";
import { pushUrl, subscribeNav } from "../nav";
import { HomeFeed, type FeedExtra, type FeedFilterKind } from "../HomeFeed";
import { DarshanRings } from "../DarshanStories";
import { NewsFeed, NewsFocus } from "./NewsFeed";
import { NewsCard } from "./NewsCard";
import { MediaCard } from "./MediaCard";
import { newsClient, mediaClient } from "./api";
import type { NewsItem, MediaItem } from "./types";

/* Субтабы Даршана: id ↔ адрес ↔ фильтр медиа поста ТГ. Один словарь — писатель и
   читатель адреса не разъедутся (ЗКН-Н041). */
type SubId = "lenta" | "news" | "photo" | "video" | "audio" | "files" | "links";
const SUBTABS: { id: SubId; label: string; seg: string; filter: FeedFilterKind | null }[] = [
  { id: "lenta", label: "Лента", seg: "", filter: null },
  { id: "news", label: "Новости", seg: "news", filter: null },
  { id: "photo", label: "Фото", seg: "photo", filter: "photo" },
  { id: "video", label: "Видео", seg: "video", filter: "video" },
  { id: "audio", label: "Аудио", seg: "audio", filter: "audio" },
  { id: "files", label: "Файлы", seg: "files", filter: "file" },
  { id: "links", label: "Ссылки", seg: "links", filter: "link" },
];
const SEG_TO_ID: Record<string, SubId> = { "": "lenta", news: "news", photo: "photo", video: "video", audio: "audio", files: "files", links: "links" };
const at = (iso: string): number => { const t = Date.parse(iso); return Number.isFinite(t) ? t : 0; };

/** Чтение среза (и слага фокуса) из адреса /darshan/<seg>[/<slug>]. */
function readNav(): { id: SubId; slug: string | null } {
  if (typeof window === "undefined") return { id: "lenta", slug: null };
  const seg = window.location.pathname.split("/").filter(Boolean);   // ["darshan", <seg>, <slug>?]
  const s1 = seg[0] === "darshan" ? (seg[1] || "") : "";
  const id = SEG_TO_ID[s1] ?? "lenta";
  const slug = id === "news" && seg[2] ? seg[2] : null;
  return { id, slug };
}

/** Новостная карточка со своим состоянием раскрытия — для вклейки в общий поток. */
function NewsCardSelf({ n, flash }: { n: NewsItem; flash: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  return <NewsCard n={n} open={open} onToggle={() => setOpen((v) => !v)} flash={flash} />;
}

export function DarshanFeed({ onDonate }: { onDonate?: () => void }) {
  const [{ id: sub, slug }, setNav] = useState(readNav);
  useEffect(() => subscribeNav(() => setNav(readNav())), []);

  // Внешние элементы ленты (новости + IA-медиа) грузим один раз — первую страницу.
  // «Лента» и «Видео/Аудио» вклеивают их в поток; «Новости» идёт вглубь отдельно.
  const [news, setNews] = useState<NewsItem[]>([]);
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [audios, setAudios] = useState<MediaItem[]>([]);
  useEffect(() => {
    let live = true;
    newsClient.list(null, 24).then((p) => { if (live) setNews(p.items); }).catch(() => {});
    mediaClient.list("video", null, 24).then((p) => { if (live) setVideos(p.items); }).catch(() => {});
    mediaClient.list("audio", null, 24).then((p) => { if (live) setAudios(p.items); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // Тост для карточек новостей/медиа, живущих внутри общей ленты.
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => { setToast(m); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2400); };

  const pick = (v: string) => {
    const t = SUBTABS.find((s) => s.id === v);
    if (!t) return;
    pushUrl(t.seg ? `/darshan/${t.seg}` : "/darshan");
  };

  const newsExtras = (): FeedExtra[] => news.map((n) => ({ id: "news-" + n.id, at: at(n.publishedAt), render: () => <NewsCardSelf n={n} flash={flash} /> }));
  const videoExtras = (): FeedExtra[] => videos.map((m) => ({ id: "vmedia-" + m.id, at: at(m.publishedAt), render: () => <MediaCard m={m} flash={flash} /> }));
  const audioExtras = (): FeedExtra[] => audios.map((m) => ({ id: "amedia-" + m.id, at: at(m.publishedAt), render: () => <MediaCard m={m} flash={flash} /> }));

  const active = SUBTABS.find((s) => s.id === sub) || SUBTABS[0];

  return (
    <div>
      <FilterChips items={SUBTABS} active={sub} onChange={pick} sticky
        stickyTop="var(--h-hall-tabs)" ariaLabel="Разделы Даршана" />

      {sub === "lenta" && (
        <>
          <DarshanRings />
          <HomeFeed onDonate={onDonate} extraItems={[...newsExtras(), ...videoExtras(), ...audioExtras()]} />
        </>
      )}

      {sub === "news" && (slug ? <NewsFocus slug={slug} onBack={() => pushUrl("/darshan/news")} /> : <NewsFeed />)}

      {sub === "video" && (
        <HomeFeed onDonate={onDonate} filterKind="video" extraItems={videoExtras()} intro={null} />
      )}
      {sub === "audio" && (
        <HomeFeed onDonate={onDonate} filterKind="audio" extraItems={audioExtras()} intro={null} />
      )}
      {(sub === "photo" || sub === "files" || sub === "links") && (
        <HomeFeed onDonate={onDonate} filterKind={active.filter} intro={null} />
      )}

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 2200, background: "rgba(28,28,30,0.96)", color: "#fff", padding: "13px 18px", borderRadius: 14, fontSize: "var(--text-footnote)", lineHeight: 1.5, fontFamily: "var(--font-text)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", width: "calc(100% - 40px)", maxWidth: 380, textAlign: "center" }}>{toast}</div>
      )}
    </div>
  );
}

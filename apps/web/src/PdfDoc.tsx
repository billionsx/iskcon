import { useEffect, useState } from "react";
import { BOOKS, bookFullTitle, type BookData } from "./books";
import { api } from "./api";
import { BookPrint, LilaPrint, ChapterPrint, ProsePrint, ProseChapterPrint, VerseBody, type ChapterRow, type ChapterVerse, type ProsePara } from "./BookDetailPage";
import { tattvaRu, categoriesRu } from "./entityLabels";
import { getDhama, getTirthaById, KIND_RU } from "./dhama/dhamas";
import { cleanCardText } from "./cardText";

const CC_LILA: Record<string, string> = { adi: "Ади-лила", madhya: "Мадхья-лила", antya: "Антья-лила" };

/** Структурированная секция печатной карточки: заголовок + подзаголовок + абзацы. */
type PrintSection = { h?: string; sub?: string; lines: string[] };

type Loaded =
  | { kind: "book"; chapters: ChapterRow[]; versesByCh: Record<string, ChapterVerse[]> }
  | { kind: "prosebook"; chapters: ChapterRow[]; parasByCh: Record<string, ProsePara[]> }
  | { kind: "lila"; lilaLabel: string; range?: string; chapters: ChapterRow[]; versesByCh: Record<string, ChapterVerse[]> }
  | { kind: "chapter"; chapter: ChapterRow | null; verses: ChapterVerse[]; lilaLabel?: string }
  | { kind: "prosechapter"; chapter: ChapterRow; paras: ProsePara[] }
  | { kind: "verse"; verse: ChapterVerse; chapterNo: string; chapterTitle: string; lila?: string }
  | { kind: "card"; header: string; title: string; subtitle?: string; rows: Array<[string, string]>; body?: string[]; footer?: string; sections?: PrintSection[]; images?: string[] };

/** Сообщаем headless-браузеру (page.waitForFunction), что контент готов к печати. */
function markReady() {
  const done = () => { (window as unknown as { __pdfReady?: boolean }).__pdfReady = true; };
  const fontsP: Promise<unknown> = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? Promise.resolve();
  const imgs = Array.from(document.images || []);
  const imgsP = Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise<void>((res) => { im.addEventListener("load", () => res(), { once: true }); im.addEventListener("error", () => res(), { once: true }); }))));
  // защитный таймаут: если картинка зависла — печатаем что есть (у page.pdf свой запас)
  const safety = new Promise<void>((res) => setTimeout(res, 14000));
  Promise.race([Promise.all([fontsP, imgsP]).then(() => undefined), safety]).then(() => requestAnimationFrame(() => requestAnimationFrame(done)));
}

/**
 * Печатный режим SPA: открывается по /?pdf=book | chapter&n=N | verse&ref=REF.
 * Рендерит чистый документ (без хрома приложения); поля и колонтитул задаёт
 * page.pdf на сервере (worker.ts → handlePdf).
 */
export function PdfDoc() {
  const params = new URLSearchParams(window.location.search);
  const kind = params.get("pdf");
  const work = params.get("work") || "bg";
  const lila = params.get("lila") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const div = params.get("div") || "";
  const n = params.get("n") || "";
  const ref = params.get("ref") || "";
  const bare = params.get("bare") === "1";
  const ctype = params.get("type") || "";
  const cid = params.get("id") || "";
  const album = params.get("album") || "";
  const track = params.get("track") || "";
  const ptab = params.get("tab") || "";
  const psub = params.get("sub") || "";
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (kind === "lila") {
          const toc = await (await fetch(api(`/books/${work}/toc`))).json();
          const divs = (toc.divisions ?? []) as Array<{ id: string; slug: string; title_ru: string; chapters: Array<{ id: string; number: string; title_ru: string; verses: number }> }>;
          const divObj = divs.find((d) => d.id.split(".")[1] === lila || d.slug === lila);
          const allCh = divObj?.chapters ?? [];
          const partial = !!(from && to);
          const picked = partial ? allCh.filter((c) => Number(c.number) >= Number(from) && Number(c.number) <= Number(to)) : allCh;
          const chapters: ChapterRow[] = picked.map((c) => ({ id: c.id, number: c.number, title_ru: c.title_ru, title_en: "", source_url: "", verses: c.verses }));
          const entries = await Promise.all(
            chapters.map(async (c) => {
              const d = await (await fetch(api(`/books/${work}/division/${encodeURIComponent(c.id)}/read`))).json();
              return [c.id, (d.verses ?? []) as ChapterVerse[]] as const;
            }),
          );
          const versesByCh: Record<string, ChapterVerse[]> = {};
          for (const [id, vs] of entries) versesByCh[id] = vs;
          const range = partial && chapters.length < allCh.length ? `главы ${from}-${to}` : undefined;
          if (live) setData({ kind: "lila", lilaLabel: divObj?.title_ru ?? (CC_LILA[lila] ?? ""), range, chapters, versesByCh });
        } else if (kind === "book") {
          const bk = (BOOKS as Record<string, BookData>)[work] ?? BOOKS.bg;
          const ch = await (await fetch(api(`/books/${bk.work}/chapters`))).json();
          const chapters: ChapterRow[] = ch.chapters ?? [];
          if (bk.prose) {
            const entries = await Promise.all(
              chapters.map(async (c) => {
                const d = await (await fetch(api(`/books/${bk.work}/chapters/${c.number}/read`))).json();
                return [c.number, ((d.verses ?? []) as Array<{ ref: string; translation: string | null }>).map((v) => ({ ref: v.ref, translation: v.translation }))] as const;
              }),
            );
            const parasByCh: Record<string, ProsePara[]> = {};
            for (const [num, ps] of entries) parasByCh[num] = ps;
            if (live) setData({ kind: "prosebook", chapters, parasByCh });
          } else {
            const entries = await Promise.all(
              chapters.map(async (c) => {
                const d = await (await fetch(api(`/books/${bk.work}/chapters/${c.number}/read`))).json();
                return [c.number, (d.verses ?? []) as ChapterVerse[]] as const;
              }),
            );
            const versesByCh: Record<string, ChapterVerse[]> = {};
            for (const [num, vs] of entries) versesByCh[num] = vs;
            if (live) setData({ kind: "book", chapters, versesByCh });
          }
        } else if (kind === "chapter") {
          if (div) {
            const lilaSlug = div.split(".")[1] ?? "";
            const num = div.split(".")[2] ?? "";
            const toc = await (await fetch(api(`/books/${work}/toc`))).json();
            let title = "";
            for (const d of (toc.divisions ?? []) as Array<{ chapters: Array<{ id: string; title_ru: string }> }>) {
              const c = (d.chapters ?? []).find((x) => x.id === div);
              if (c) { title = c.title_ru; break; }
            }
            const rd = await (await fetch(api(`/books/${work}/division/${encodeURIComponent(div)}/read`))).json();
            const verses = (rd.verses ?? []) as ChapterVerse[];
            const chapter: ChapterRow = { id: div, number: num, title_ru: title, title_en: "", source_url: "", verses: verses.length };
            if (live) setData({ kind: "chapter", chapter, verses, lilaLabel: CC_LILA[lilaSlug] ?? "" });
          } else {
            const bk2 = (BOOKS as Record<string, BookData>)[work] ?? BOOKS.bg;
            const ch = await (await fetch(api(`/books/${bk2.work}/chapters`))).json();
            const chapter = ((ch.chapters ?? []) as ChapterRow[]).find((c) => String(c.number) === String(n)) ?? null;
            const d = await (await fetch(api(`/books/${bk2.work}/chapters/${n}/read`))).json();
            if (bk2.prose) {
              const paras = ((d.verses ?? []) as Array<{ ref: string; translation: string | null }>).map((v) => ({ ref: v.ref, translation: v.translation }));
              if (live) setData({ kind: "prosechapter", chapter: chapter ?? { id: `${bk2.work}.${n}`, number: String(n), title_ru: "", title_en: "", source_url: "", verses: paras.length }, paras });
            } else if (live) setData({ kind: "chapter", chapter, verses: (d.verses ?? []) as ChapterVerse[] });
          }
        } else if (kind === "verse") {
          if (work !== "bg") {
            const vRes = await (await fetch(api(`/books/${work}/verses/${encodeURIComponent(ref)}`))).json();
            const divId = (vRes.division as string) || "";
            const lilaSlug = divId.split(".")[1] ?? "";
            const num = divId.split(".")[2] ?? (ref.replace(/^[^\d]*/, "").split(".")[0] ?? "");
            if (live) setData({ kind: "verse", verse: vRes as ChapterVerse, chapterNo: String(num), chapterTitle: "", lila: CC_LILA[lilaSlug] ?? "" });
          } else {
            const [chRes, vRes] = await Promise.all([
              fetch(api("/books/bg/chapters")).then((r) => r.json()),
              fetch(api(`/books/bg/verses/${encodeURIComponent(ref)}`)).then((r) => r.json()),
            ]);
            const m = ref.match(/(\d+)\s*\.\s*\d+/);
            const chapterNo = m ? m[1] : "";
            const chapterTitle = ((chRes.chapters ?? []) as ChapterRow[]).find((c) => String(c.number) === chapterNo)?.title_ru ?? "";
            if (live) setData({ kind: "verse", verse: vRes as ChapterVerse, chapterNo, chapterTitle });
          }
        } else if (kind === "card") {
          const card = await loadCard(ctype, cid, album, track, ptab, psub);
          if (live) { if (card) setData(card); else setErr(true); }
        } else if (live) {
          setErr(true);
        }
      } catch {
        if (live) setErr(true);
      }
    })();
    return () => { live = false; };
  }, [kind, n, ref, work, lila, from, to, div, ctype, cid, album, track]);

  useEffect(() => {
    if (data) {
      const title = bookFullTitle((BOOKS as Record<string, BookData>)[work] ?? BOOKS.bg);
      let h = title;
      if (data.kind === "lila") {
        h = data.lilaLabel ? `${title} · ${data.lilaLabel}` : title;
      } else if (data.kind === "chapter" && data.chapter) {
        const parts = [title];
        if (data.lilaLabel) parts.push(data.lilaLabel);
        parts.push(data.chapter.title_ru || `Глава ${data.chapter.number}`);
        h = parts.join(" · ");
      } else if (data.kind === "prosechapter") {
        h = `${title} · ${data.chapter.title_ru || `Глава ${data.chapter.number}`}`;
      } else if (data.kind === "verse") {
        const vnum = ref.match(/\.\s*(\d+)/)?.[1] ?? "";
        const parts = [title];
        if (data.lila) parts.push(data.lila);
        if (data.chapterTitle) parts.push(data.chapterTitle);
        else if (data.chapterNo) parts.push(`Глава ${data.chapterNo}`);
        if (vnum) parts.push(`Текст ${vnum}`);
        h = parts.join(" · ");
      }
      if (data.kind === "card") h = data.header;
      (window as unknown as { __pdfHeader?: string }).__pdfHeader = h;
    }
    if (data || err) markReady();
  }, [data, err, ref, work]);

  if (err) return <div style={{ padding: 24, fontFamily: "var(--font-text)" }}>Не удалось загрузить данные.</div>;
  if (!data) return <div style={{ padding: 24, fontFamily: "var(--font-text)", color: "#70727b" }}>Загрузка…</div>;

  return (
    <div className="pdf-doc-page" style={{ background: "#fff", color: "#1f2024", fontFamily: "var(--font-text)" }}>
      {data.kind === "book" && <BookPrint book={(BOOKS as Record<string, BookData>)[work] ?? BOOKS.bg} chapters={data.chapters} versesByCh={data.versesByCh} />}
      {data.kind === "prosebook" && <ProsePrint book={(BOOKS as Record<string, BookData>)[work] ?? BOOKS.brs} chapters={data.chapters} parasByCh={data.parasByCh} />}
      {data.kind === "lila" && <LilaPrint book={(BOOKS as Record<string, BookData>)[work] ?? BOOKS.cc} lilaLabel={data.lilaLabel} range={data.range} chapters={data.chapters} versesByCh={data.versesByCh} bare={bare} />}
      {data.kind === "chapter" && data.chapter && <ChapterPrint chapter={data.chapter} verses={data.verses} />}
      {data.kind === "prosechapter" && <ProseChapterPrint chapter={data.chapter} paras={data.paras} />}
      {data.kind === "chapter" && !data.chapter && <div style={{ padding: 24 }}>Глава не найдена.</div>}
      {data.kind === "card" && <CardPrint d={data} />}
      {data.kind === "verse" && (
        <>
          <div style={{ margin: "0 0 16px", paddingBottom: 10, borderBottom: "0.75pt solid rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 13, color: "#70727b" }}>{data.lila ? `${data.lila} · ` : ""}{data.chapterNo ? `Глава ${data.chapterNo} · ` : ""}{bookFullTitle((BOOKS as Record<string, BookData>)[work] ?? BOOKS.bg)}</div>
          </div>
          <VerseBody v={data.verse} />
        </>
      )}
    </div>
  );
}


/* ── Печатная карточка справочника (место/личность/документ/бхаджан/киртан) ── */
type CardLoaded = Extract<Loaded, { kind: "card" }>;

/* ── Досье ПКЛ: минимальные типы для печати одной темы (таб/подтаб) ── */
type PdfQuote = { t: string; by?: string; ref?: string };
type PdfSec = { h?: string; p?: string[]; quote?: PdfQuote; quotes?: PdfQuote[] };
type PdfDossier = { tabs?: Array<{ id: string; label?: string; title?: string; lead?: string; sections?: PdfSec[]; subtabs?: Array<{ id: string; label?: string; sections?: PdfSec[] }> }> };
function flattenDossierTopic(dos: PdfDossier | null, ptab: string, psub: string): { title: string; sub: string; rows: Array<[string, string]>; sections: PrintSection[] } | null {
  const tabObj = dos?.tabs?.find((t) => t.id === ptab);
  if (!tabObj) return null;
  const subObj = psub ? (tabObj.subtabs ?? []).find((st) => st.id === psub) : undefined;
  const secs = (subObj?.sections ?? tabObj.sections ?? []);
  const out: PrintSection[] = [];
  if (tabObj.lead) out.push({ h: tabObj.title || tabObj.label || "", sub: tabObj.lead, lines: [] });
  for (const sec of secs) {
    const lines: string[] = [];
    /* ЗКН-Т002 — ЛЮБОЙ ТЕКСТ ЛИЧНОСТИ ПРОХОДИТ ЧЕРЕЗ `cleanCardText`.
     *
     * PDF печатал абзацы НАПРЯМУЮ, минуя очистку. А очистка — это не косметика:
     * она правит канонические имена («Шри Чайтанья Махапрабху» → «Гауранга
     * Махапрабху») и разбивает нанизанные через точку с запятой предложения.
     *
     * Экран можно исправить и перевыкатить. **PDF — это БУМАГА.** Человек унесёт
     * её с собой, и ошибка переживёт все правки. Из всех поверхностей эта —
     * самая неисправимая, и именно её пропустили. */
    for (const para of (sec.p ?? [])) if (para && para.trim()) lines.push(cleanCardText(para.trim()));
    const qs = [...(sec.quote ? [sec.quote] : []), ...(sec.quotes ?? [])];
    for (const q of qs) {
      if (!q?.t) continue;
      const attr = [q.by, q.ref].filter(Boolean).join(", ");
      lines.push("\u00ab" + q.t + "\u00bb" + (attr ? "\n\u2014 " + attr : ""));
    }
    if (sec.h || lines.length) out.push({ h: sec.h || undefined, lines });
  }
  const tLabel = tabObj.title || tabObj.label || "";
  const sLabel = subObj?.label || "";
  const rows: Array<[string, string]> = [];
  if (tLabel || sLabel) rows.push(["Раздел", [tLabel, sLabel].filter(Boolean).join(" \u00b7 ")]);
  return { title: sLabel || tLabel, sub: "", rows, sections: out };
}

async function loadCard(ctype: string, cid: string, album: string, track: string, ptab = "", psub = ""): Promise<CardLoaded | null> {
  try {
    if (ctype === "post") {
      // Пост ленты: тянем конкретный кадр канала (t.me/s/iskcone?before=<id+1> отдаёт
      // страницу, включающую нужный id; иначе берём последнюю).
      const nid = Number(cid);
      const findP = (j: { posts?: Array<{ id: string; text?: string; date?: string; photos?: string[] }> }) => (j.posts || []).find((x) => String(x.id) === String(cid)) || null;
      let j = await (await fetch(api("/tg/iskcone") + (nid ? "?before=" + (nid + 1) : ""))).json();
      let post = findP(j);
      if (!post) { j = await (await fetch(api("/tg/iskcone"))).json(); post = findP(j); }
      if (!post) return null;
      const lines = (post.text || "").trim().split("\n").map((l) => l.trim()).filter(Boolean);
      const title = lines[0] || "ISKCON ONE LOVE";
      const body = lines.slice(1);
      let dateStr = "";
      if (post.date) { try { dateStr = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(post.date)); } catch { /* noop */ } }
      return { kind: "card", header: "Лента · ISKCON ONE LOVE", title, subtitle: dateStr || undefined, rows: [], body: body.length ? body : undefined, images: (post.photos || []).slice(0, 30) };
    }
    if (ctype === "dhama") {
      const d = getDhama(cid);
      if (!d) return null;
      const rows: Array<[string, string]> = [["Божество", d.deity], ["Расположение", d.region]];
      for (const f of d.facts) rows.push([f.k, f.v]);
      return { kind: "card", header: "Святые дхамы · ISKCON ONE LOVE", title: d.name, subtitle: d.tagline, rows, body: d.intro };
    }
    if (ctype === "tirtha") {
      const found = getTirthaById(cid);
      if (!found) return null;
      const { dhama: d, tirtha: t } = found;
      const clusterTitle = d.clusters.find((c) => c.id === t.cluster)?.title;
      const rows: Array<[string, string]> = [["Категория", KIND_RU[t.kind]], ["Дхама", d.name]];
      if (clusterTitle) rows.push(["Район", clusterTitle]);
      const body: string[] = [t.about];
      if (t.lila) body.push("Лила\n" + t.lila);
      if (t.persons && t.persons.length) body.push("Связанные личности: " + t.persons.map((p) => p.name).join(", "));
      return { kind: "card", header: `${d.name} · святое место`, title: t.name, subtitle: t.iast || undefined, rows, body,
        footer: "Источник: редакция gaurangers.com · координаты приблизительны" };
    }
    if (ctype === "place" || ctype === "restaurant") {
      const wrap = await (await fetch(`/api/places/${encodeURIComponent(cid)}`)).json() as { place?: Record<string, string | null> };
      const p = wrap?.place;
      if (!p || !p.nameRu) return null;
      const rows: Array<[string, string]> = [];
      if (p.category) rows.push(["Тип", String(p.category)]);
      if (p.addressRu || p.address) rows.push(["Адрес", String(p.addressRu || p.address)]);
      if (p.address && p.addressRu && p.address !== p.addressRu) rows.push(["Адрес (ориг.)", String(p.address)]);
      const geo = [p.cityRu || p.city, p.stateRu || p.state, p.countryRu || p.country].filter(Boolean).join(", ");
      if (geo) rows.push(["Расположение", geo]);
      if (p.phone) rows.push(["Телефон", String(p.phone)]);
      if (p.email) rows.push(["E-mail", String(p.email)]);
      if (p.website) rows.push(["Сайт", String(p.website)]);
      return { kind: "card", header: ctype === "restaurant" ? "Вегетарианские рестораны ИСККОН" : "Центры и храмы ИСККОН",
        title: String(p.nameRu), subtitle: p.name && p.name !== p.nameRu ? String(p.name) : undefined, rows,
        footer: p.source ? `Источник: ${p.source}` : undefined };
    }
    if (ctype === "entity") {
      const e = await (await fetch(`/api/entities/${encodeURIComponent(cid)}`)).json() as {
        name_ru?: string; name_en?: string; name_iast?: string; note?: string | null; tattva?: string | null;
        categories?: string[]; profile?: { summary?: string | null; biography?: string | null; contribution?: string | null; longform?: string | null } | null;
      };
      if (!e || !e.name_ru) return null;
      // Печать КОНКРЕТНОЙ темы ПКЛ (таб/подтаб), если переданы — иначе вся Личность.
      if (ptab) {
        let dos: PdfDossier | null = null;
        try { const raw = e.profile?.longform; const j = raw ? JSON.parse(raw) : null; if (j && Array.isArray(j.tabs)) dos = j; } catch { dos = null; }
        const topic = flattenDossierTopic(dos, ptab, psub);
        if (topic && topic.sections.length) {
          return { kind: "card", header: `${e.name_ru} · ПКЛ ISKCON ONE LOVE`, title: topic.title || e.name_ru, subtitle: e.name_ru, rows: topic.rows, sections: topic.sections };
        }
      }
      const rows: Array<[string, string]> = [];
      if (e.name_iast) rows.push(["IAST", e.name_iast]);
      if (e.name_en) rows.push(["EN", e.name_en]);
      if (e.tattva) rows.push(["Таттва", tattvaRu(e.tattva)]);
      const catsR = categoriesRu(e.categories);
      if (catsR.length) rows.push(["Классификация", catsR.join(", ")]);
      const body: string[] = [];
      const pr = e.profile;
      const clean = (t?: string | null) => (t && !/^_/.test(t.trim()) ? t.trim() : "");
      if (clean(pr?.summary)) body.push(clean(pr?.summary));
      if (clean(pr?.biography)) body.push("Биография\n" + clean(pr?.biography));
      if (clean(pr?.contribution)) body.push("Вклад и учение\n" + clean(pr?.contribution));
      return { kind: "card", header: "Герои · ISKCON ONE LOVE", title: e.name_ru, subtitle: e.note || undefined, rows, body };
    }
    if (ctype === "doc") {
      const j = await (await fetch("/api/documents")).json() as { documents?: Array<{ id: string; type: string; year: string; title: string; issuer: string; summary: string; body?: string[]; facts?: Array<{ k: string; v: string }>; url?: string }> };
      const d = (j.documents ?? []).find((x) => x.id === cid);
      if (!d) return null;
      const rows: Array<[string, string]> = [["Год", d.year], ["Орган", d.issuer]];
      for (const f of d.facts ?? []) rows.push([f.k, f.v]);
      if (d.url) rows.push(["Первоисточник", d.url]);
      return { kind: "card", header: "Официальные документы ИСККОН", title: d.title, subtitle: d.summary, rows, body: d.body ?? [] };
    }
    if (ctype === "bhajan") {
      const b = await (await fetch(api(`/bhajans/detail?slug=${encodeURIComponent(cid)}`))).json() as {
        name?: string; author?: string | null; meaning?: string | null; verses?: Array<{ lines?: string[]; translation?: string | null }>;
      };
      if (!b || !b.name) return null;
      const rows: Array<[string, string]> = [];
      if (b.author) rows.push(["Автор", b.author]);
      const body: string[] = [];
      for (const v of (b.verses ?? []).slice(0, 24)) {
        const t = (v.lines ?? []).join("\n");
        if (t) body.push(t + (v.translation ? `\n— ${v.translation}` : ""));
      }
      return { kind: "card", header: "Бхаджаны · ISKCON ONE LOVE", title: b.name, subtitle: b.meaning || undefined, rows, body };
    }
    if (ctype === "kirtan-album" || ctype === "kirtan-track") {
      const mod = await import("./kirtans");
      const artists = (mod as unknown as { KIRTAN_ARTISTS: Array<{ slug: string; name: string; albums: Array<{ id: string; title: string; year?: string; source?: string; tracks?: Array<{ title: string; duration?: string }> }> }> }).KIRTAN_ARTISTS;
      for (const a of artists) for (const al of a.albums) {
        if (al.id !== (album || cid)) continue;
        const rows: Array<[string, string]> = [["Исполнитель", a.name]];
        if (al.year) rows.push(["Год", al.year]);
        rows.push(["Источник", "Internet Archive"]);
        if (ctype === "kirtan-track") {
          const t = (al.tracks ?? []).find((x) => x.title === track) || null;
          return { kind: "card", header: "Киртаны · ISKCON ONE LOVE", title: track || cid,
            subtitle: `Альбом «${al.title}»`, rows: t?.duration ? [...rows, ["Длительность", t.duration]] : rows };
        }
        const body = (al.tracks ?? []).map((t, i) => `${i + 1}. ${t.title}${t.duration ? ` · ${t.duration}` : ""}`);
        return { kind: "card", header: "Киртаны · ISKCON ONE LOVE", title: al.title, subtitle: a.name, rows, body: [body.join("\n")] };
      }
      return null;
    }
    if (ctype === "recipe") {
      const mod = await import("./prasad/prasad");
      const r = mod.recipeBySlug(cid);
      if (!r) return null;
      const catLabel = mod.CATEGORIES.find((c) => c.id === r.category)?.label || "";
      const rows: Array<[string, string]> = [];
      if (catLabel) rows.push(["Категория", catLabel]);
      rows.push(["Время", `${r.minutes} мин`]);
      rows.push(["Сложность", mod.DIFFICULTY_LABEL[r.difficulty]]);
      rows.push(["Порций", r.servings]);
      if (r.region) rows.push(["Регион", r.region]);
      const ing = r.ingredients.map((i) => (i.amount ? `${i.item} — ${i.amount}` : i.item)).join("\n");
      const steps = r.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const body: string[] = ["Ингредиенты\n" + ing, "Приготовление\n" + steps];
      if (r.note) body.push(r.note);
      return { kind: "card", header: "Кухня прасада · Прасадам", title: r.title, subtitle: r.subtitle, rows, body };
    }
    if (ctype === "cookbook") {
      const cb = await import("./prasad/cookbook");
      const pr = await import("./prasad/prasad");
      const COOKBOOK = cb.COOKBOOK;
      const sections: PrintSection[] = [];
      let lastPart = "";
      for (const ch of COOKBOOK.chapters) {
        if (ch.part && ch.part !== lastPart) { sections.push({ h: ch.part.toUpperCase(), lines: [] }); lastPart = ch.part; }
        let cur: PrintSection = { h: (ch.number ? ch.number + ". " : "") + ch.title, sub: ch.subtitle, lines: [] };
        for (const b of ch.blocks || []) {
          if (b.type === "h") { sections.push(cur); cur = { h: b.text, lines: [] }; }
          else if (b.type === "p") cur.lines.push(b.text);
          else if (b.type === "ul") for (const it of b.items) cur.lines.push("•  " + it);
          else if (b.type === "dl") for (const it of b.items) cur.lines.push(it.t + " — " + it.d);
          else if (b.type === "note") cur.lines.push(b.text);
        }
        sections.push(cur);
        if (ch.recipesOf) {
          for (const r of cb.chapterRecipes(ch.recipesOf)) {
            const meta = `${r.minutes} мин · ${pr.DIFFICULTY_LABEL[r.difficulty]} · ${r.servings}${r.region ? " · " + r.region : ""}`;
            const ing = r.ingredients.map((i) => (i.amount ? `${i.item} — ${i.amount}` : i.item)).join("\n");
            const steps = r.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
            const lines = [meta, "Ингредиенты:\n" + ing, "Приготовление:\n" + steps];
            if (r.note) lines.push(r.note);
            sections.push({ h: r.title, sub: r.sanskrit || undefined, lines });
          }
        }
        if (ch.prayers) {
          for (const p of pr.OFFERING_PRAYERS) sections.push({ h: p.to, lines: [p.lines.join("\n"), p.meaning] });
        }
      }
      return {
        kind: "card",
        header: "ISKCON ONE LOVE · Прасадам",
        title: COOKBOOK.title, subtitle: COOKBOOK.subtitle,
        rows: [["Автор", COOKBOOK.author], ["Разделов", String(COOKBOOK.chapters.length)], ["Рецептов", String(pr.RECIPE_COUNT)]],
        body: [COOKBOOK.blurb],
        sections,
        footer: "Кухня прасада · gaurangers.com · оригинальное руководство в традиции ИСККОН",
      };
    }
  } catch { return null; }
  return null;
}

function CardPrint({ d }: { d: CardLoaded }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ fontSize: "10pt", letterSpacing: "2px", textTransform: "uppercase", color: "#9a7a14", fontFamily: "Georgia, serif" }}>{d.header}</div>
      <h1 style={{ margin: "10pt 0 0", fontSize: "22pt", lineHeight: 1.16, letterSpacing: "-0.01em", fontWeight: 800 }}>{d.title}</h1>
      {d.subtitle && <div style={{ marginTop: "5pt", fontSize: "12.5pt", color: "#55565c" }}>{d.subtitle}</div>}
      {d.rows.length > 0 && (
        <table style={{ marginTop: "14pt", borderCollapse: "collapse", width: "100%", fontSize: "11pt" }}>
          <tbody>
            {d.rows.map(([k, v]) => (
              <tr key={k + v} style={{ borderTop: "0.75pt solid rgba(0,0,0,0.14)" }}>
                <td style={{ padding: "6pt 14pt 6pt 0", color: "#70727b", whiteSpace: "nowrap", verticalAlign: "top", width: "1%" }}>{k}</td>
                <td style={{ padding: "6pt 0", wordBreak: "break-word" }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d.body && d.body.length > 0 && (
        <div style={{ marginTop: "16pt", fontSize: "11.5pt", lineHeight: 1.62 }}>
          {d.body.map((b, i) => <p key={i} style={{ margin: "0 0 10pt", whiteSpace: "pre-wrap" }}>{b}</p>)}
        </div>
      )}
      {d.sections && d.sections.length > 0 && (
        <div style={{ marginTop: "16pt" }}>
          {d.sections.map((s, i) => (
            <div key={i} style={{ marginTop: i ? "15pt" : 0, breakInside: "avoid" }}>
              {s.h && <div style={{ fontSize: "13.5pt", fontWeight: 800, letterSpacing: "-0.01em", color: "#1a1a1a", fontFamily: "Georgia, serif" }}>{s.h}</div>}
              {s.sub && <div style={{ marginTop: "2pt", fontSize: "10.5pt", fontStyle: "italic", color: "#70727b" }}>{s.sub}</div>}
              {s.lines.map((ln, j) => <p key={j} style={{ margin: "6pt 0 0", fontSize: "11pt", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{ln}</p>)}
            </div>
          ))}
        </div>
      )}
      {d.images && d.images.length > 0 && (
        <div style={{ marginTop: "16pt", display: "flex", flexDirection: "column", gap: "9mm" }}>
          {d.images.map((src, i) => (
            <img key={i} src={src} alt="" data-pdf-block="" style={{ display: "block", margin: "0 auto", maxWidth: "100%", maxHeight: "232mm", borderRadius: "10px", breakInside: "avoid" }} />
          ))}
        </div>
      )}
      {d.footer && <div style={{ marginTop: "16pt", fontSize: "9.5pt", color: "#8a8a8e" }}>{d.footer}</div>}
    </div>
  );
}

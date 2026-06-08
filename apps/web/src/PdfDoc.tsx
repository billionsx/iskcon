import { useEffect, useState } from "react";
import { BOOKS, type BookData } from "./books";
import { api } from "./api";
import { BookPrint, LilaPrint, ChapterPrint, VerseBody, type ChapterRow, type ChapterVerse } from "./BookDetailPage";

type Loaded =
  | { kind: "book"; chapters: ChapterRow[]; versesByCh: Record<string, ChapterVerse[]> }
  | { kind: "lila"; lilaLabel: string; chapters: ChapterRow[]; versesByCh: Record<string, ChapterVerse[]> }
  | { kind: "chapter"; chapter: ChapterRow | null; verses: ChapterVerse[] }
  | { kind: "verse"; verse: ChapterVerse; chapterNo: string; chapterTitle: string };

/** Сообщаем headless-браузеру (page.waitForFunction), что контент готов к печати. */
function markReady() {
  const done = () => { (window as unknown as { __pdfReady?: boolean }).__pdfReady = true; };
  const f = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
  if (f?.ready) f.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(done)));
  else requestAnimationFrame(() => requestAnimationFrame(done));
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
  const n = params.get("n") || "";
  const ref = params.get("ref") || "";
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (kind === "lila") {
          const toc = await (await fetch(api(`/books/${work}/toc`))).json();
          const divs = (toc.divisions ?? []) as Array<{ id: string; slug: string; title_ru: string; chapters: Array<{ id: string; number: string; title_ru: string; verses: number }> }>;
          const div = divs.find((d) => d.id.split(".")[1] === lila || d.slug === lila);
          const chapters: ChapterRow[] = (div?.chapters ?? []).map((c) => ({ id: c.id, number: c.number, title_ru: c.title_ru, title_en: "", source_url: "", verses: c.verses }));
          const entries = await Promise.all(
            chapters.map(async (c) => {
              const d = await (await fetch(api(`/books/${work}/division/${encodeURIComponent(c.id)}/read`))).json();
              return [c.id, (d.verses ?? []) as ChapterVerse[]] as const;
            }),
          );
          const versesByCh: Record<string, ChapterVerse[]> = {};
          for (const [id, vs] of entries) versesByCh[id] = vs;
          if (live) setData({ kind: "lila", lilaLabel: div?.title_ru ?? "", chapters, versesByCh });
        } else if (kind === "book") {
          const ch = await (await fetch(api("/books/bg/chapters"))).json();
          const chapters: ChapterRow[] = ch.chapters ?? [];
          const entries = await Promise.all(
            chapters.map(async (c) => {
              const d = await (await fetch(api(`/books/bg/chapters/${c.number}/read`))).json();
              return [c.number, (d.verses ?? []) as ChapterVerse[]] as const;
            }),
          );
          const versesByCh: Record<string, ChapterVerse[]> = {};
          for (const [num, vs] of entries) versesByCh[num] = vs;
          if (live) setData({ kind: "book", chapters, versesByCh });
        } else if (kind === "chapter") {
          const ch = await (await fetch(api("/books/bg/chapters"))).json();
          const chapter = ((ch.chapters ?? []) as ChapterRow[]).find((c) => String(c.number) === String(n)) ?? null;
          const d = await (await fetch(api(`/books/bg/chapters/${n}/read`))).json();
          if (live) setData({ kind: "chapter", chapter, verses: (d.verses ?? []) as ChapterVerse[] });
        } else if (kind === "verse") {
          const [chRes, vRes] = await Promise.all([
            fetch(api("/books/bg/chapters")).then((r) => r.json()),
            fetch(api(`/books/bg/verses/${encodeURIComponent(ref)}`)).then((r) => r.json()),
          ]);
          const m = ref.match(/(\d+)\s*\.\s*\d+/);
          const chapterNo = m ? m[1] : "";
          const chapterTitle = ((chRes.chapters ?? []) as ChapterRow[]).find((c) => String(c.number) === chapterNo)?.title_ru ?? "";
          if (live) setData({ kind: "verse", verse: vRes as ChapterVerse, chapterNo, chapterTitle });
        } else if (live) {
          setErr(true);
        }
      } catch {
        if (live) setErr(true);
      }
    })();
    return () => { live = false; };
  }, [kind, n, ref]);

  useEffect(() => {
    if (data) {
      const BOOK = "Бхагавад-гита как она есть";
      let h = BOOK;
      if (data.kind === "lila") {
        const bk = (BOOKS as Record<string, BookData>)[work] ?? BOOKS.cc;
        const bt = bk.titleLine2 ? `${bk.titleLine1}${bk.titleLine1.endsWith("-") ? "" : " "}${bk.titleLine2}` : bk.titleLine1;
        h = data.lilaLabel ? `${bt} · ${data.lilaLabel}` : bt;
      } else if (data.kind === "chapter" && data.chapter) h = `${BOOK} · ${data.chapter.title_ru}`;
      else if (data.kind === "verse") {
        const vnum = ref.match(/\.\s*(\d+)/)?.[1] ?? "";
        const parts = [BOOK];
        if (data.chapterTitle) parts.push(data.chapterTitle);
        else if (data.chapterNo) parts.push(`Глава ${data.chapterNo}`);
        if (vnum) parts.push(`Текст ${vnum}`);
        h = parts.join(" · ");
      }
      (window as unknown as { __pdfHeader?: string }).__pdfHeader = h;
    }
    if (data || err) markReady();
  }, [data, err, ref]);

  if (err) return <div style={{ padding: 24, fontFamily: "var(--font-text)" }}>Не удалось загрузить данные.</div>;
  if (!data) return <div style={{ padding: 24, fontFamily: "var(--font-text)", color: "#70727b" }}>Загрузка…</div>;

  return (
    <div className="pdf-doc-page" style={{ background: "#fff", color: "#1f2024", fontFamily: "var(--font-text)" }}>
      {data.kind === "book" && <BookPrint book={BOOKS.bg} chapters={data.chapters} versesByCh={data.versesByCh} />}
      {data.kind === "lila" && <LilaPrint book={(BOOKS as Record<string, BookData>)[work] ?? BOOKS.cc} lilaLabel={data.lilaLabel} chapters={data.chapters} versesByCh={data.versesByCh} />}
      {data.kind === "chapter" && data.chapter && <ChapterPrint chapter={data.chapter} verses={data.verses} />}
      {data.kind === "chapter" && !data.chapter && <div style={{ padding: 24 }}>Глава не найдена.</div>}
      {data.kind === "verse" && (
        <>
          <div style={{ margin: "0 0 16px", paddingBottom: 10, borderBottom: "0.75pt solid rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 13, color: "#70727b" }}>{data.chapterNo ? `Глава ${data.chapterNo} · ` : ""}Бхагавад-гита как она есть</div>
          </div>
          <VerseBody v={data.verse} />
        </>
      )}
    </div>
  );
}

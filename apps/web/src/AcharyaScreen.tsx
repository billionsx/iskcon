/**
 * AcharyaScreen — раздел «Ачарья» поверх канонического реестра. Два режима:
 *
 *  • Лендинг (collection не задан): 4 карточки одного стиля —
 *      1. Шрила Прабхупада (Ачарья-основатель ИСККОН) → страница героя
 *      2. Радха-Кришна лила  → экран лилы
 *      3. Гауранга лила       → экран лилы
 *      4. Шримад Бхагаватам   → экран лилы
 *    + живой поиск по всем героям.
 *
 *  • Экран лилы (collection = 'radha-krishna' | 'gauranga' | 'bhagavatam'):
 *    шапка + «назад» + тематические полки героев этой лилы.
 *
 * Каждая карточка героя открывает EntityPage; книги-читалки уходят в ридер.
 */
import { CardActionBtns, favMetaFromCtx, useCardActions } from "./cardActions";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BackIcon } from "./ui/icons";
import { cleanCardText } from "./cardText";
import { COVER_FALLBACK } from "./ui/CoverFallback";
import { ROUTES, url } from "./routes";

const GOLD = "var(--color-gold)";

interface Item {
  id: string;
  type: string | null;
  tattva: string | null;
  name_ru: string | null;
  name_en: string | null;
  name_iast: string | null;
  note: string | null;
  image?: string | null;
}

function Monogram({ size = 40 }: { ch?: string; size?: number }) {
  // ЗКН-Д007: буква-монограмма — суррогат. Нет портрета → фирменная заглушка.
  return (
    <img src={COVER_FALLBACK} alt="" loading="lazy"
      style={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", objectFit: "cover",
        background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }} />
  );
}

function MaskMark({ src, size = 56, pos = "center" }: { src: string; size?: number; pos?: string }) {  return (
    <span role="img" aria-hidden style={{ display: "block", width: size, height: size, backgroundColor: "var(--color-label)",
      WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
      WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: pos, maskPosition: pos }} />
  );
}

/** Первая графема IAST (с диакритикой) для буквицы. Intl.Segmenter не рвёт диакритику. */

function Avatar({ item, size }: { item: Item; size: number }) {
  if (item.image) {
    return (
      <div style={{ flexShrink: 0, width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "var(--color-fill-1)" }}>
        <img src={item.image} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  return <Monogram size={size} />;
}


function entityCtx(item: Item) {
  return {
    type: "entity" as const, id: item.id, title: item.name_ru || item.id, subtitle: item.name_iast || undefined,
    url: url(ROUTES.entity(item.id)),
    context: `Герой · ${item.name_ru || item.id} · /entity/${item.id}`,
  };
}

/* EntityRow — стандарт «герой/обитель в списке» по Apple-2026.
 * ────────────────────────────────────────────────────────────
 * Замещает прежний горизонтальный мини-скролл монограмм. Для перечня из 30
 * имён горизонтальный рейл — антипаттерн: большая часть имён за кадром,
 * сканировать невозможно. Вертикальный список (как Apple Music
 * «Похожие исполнители», Apple News «Похожие темы», Контакты) показывает
 * все имена сразу и оставляет действия (сердечко, меню, шеврон) на местах.
 * Граница строки — тонкий hairline, без «карточного» фона. */
function EntityRow({ item, onOpen }: { item: Item; onOpen: (id: string, type: string | null) => void }) {
  const { openCardMenu } = useCardActions();
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(item.id, item.type)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(item.id, item.type); } }}
      style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", boxSizing: "border-box",
        padding: "11px 4px", borderBottom: "0.5px solid var(--color-hairline)",
        cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent", transition: "opacity .15s ease" }}
      onPointerDown={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = "0.55")}
      onPointerUp={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = "1")}
      onPointerLeave={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = "1")}>
      <Avatar item={item} size={44} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)", lineHeight: 1.25, letterSpacing: "-0.01em",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name_ru || item.id}</span>
        {item.name_iast && (
          <span style={{ display: "block", marginTop: 1, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-footnote)", color: "var(--color-label-3)", lineHeight: 1.25,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name_iast}</span>
        )}
      </span>
      <CardActionBtns favKey={`entity:${item.id}`} meta={favMetaFromCtx(entityCtx(item))} size={26} onMore={() => openCardMenu(entityCtx(item))} />
      <span aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)", fontSize: "var(--text-body)", marginLeft: 2 }}>›</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 4px", borderBottom: "0.5px solid var(--color-hairline)" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--color-fill-1)", opacity: 0.6 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: "55%", height: 13, borderRadius: 4, background: "var(--color-fill-1)", opacity: 0.6 }} />
        <div style={{ marginTop: 6, width: "35%", height: 10, borderRadius: 4, background: "var(--color-fill-1)", opacity: 0.4 }} />
      </div>
    </div>
  );
}

export function Rail({ title, params, orderIds, onOpen }: { title: string; params: string; orderIds?: string[]; onOpen: (id: string, type: string | null) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(api(`/entities?${params}`))
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        let arr = (d.items as Item[]) ?? [];
        if (orderIds) arr = [...arr].sort((a, b) => orderIds.indexOf(a.id) - orderIds.indexOf(b.id));
        setItems(arr);
      })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [params]);

  if (items && items.length === 0) return null;

  // Длинные перечни (>8) сворачиваем за «Показать всё» — экран не задыхается,
  // но кнопка раскрывает полный список прямо здесь, без перехода.
  const INITIAL = 8;
  const visible = items && !expanded ? items.slice(0, INITIAL) : items;
  const hidden = items ? Math.max(0, items.length - INITIAL) : 0;

  return (
    <section style={{ marginTop: 26 }}>
      {/* Apple-стиль заголовка: имя + тонкий счётчик, без декоративных линий. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-body)", fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{title}</h3>
        {items && items.length > 1 && (
          <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 500, color: "var(--color-label-3)", fontVariantNumeric: "tabular-nums" }}>{items.length}</span>
        )}
      </div>
      <div>
        {visible ? visible.map((it) => <EntityRow key={it.id} item={it} onOpen={onOpen} />) : Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
      {items && !expanded && hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)}
          style={{ marginTop: 12, padding: "10px 16px", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)",
            borderRadius: 999, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          Показать всё <span style={{ color: "var(--color-label-3)", fontWeight: 500, marginLeft: 4 }}>{hidden}</span>
        </button>
      )}
    </section>
  );
}

/** Карточка раздела (в стиле карточки Прабхупады). */
function SectionCard({ title, subtitle, mark, accent, onClick }: { title: string; subtitle: string; mark: React.ReactNode; accent?: boolean; onClick: () => void }) {
  const ring: React.CSSProperties = accent
    ? { border: `1.5px solid color-mix(in srgb, ${GOLD} 55%, transparent)`, background: `color-mix(in srgb, ${GOLD} 10%, transparent)` }
    : { border: "none", background: "transparent" };
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 15, width: "100%", padding: "16px", borderRadius: 20,
        border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", textAlign: "left" }}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
      onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
      onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}>
      <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: "50%", display: "grid", placeItems: "center",
        color: "var(--color-label)", overflow: "hidden", ...ring }}>
        {mark}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{title}</span>
        <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)", lineHeight: 1.4 }}>{subtitle}</span>
      </span>
      <span style={{ flexShrink: 0, alignSelf: "flex-start", color: "var(--color-label-3)", fontSize: "var(--text-title2)", lineHeight: 1, marginTop: 2 }}>›</span>
    </button>
  );
}

function ResultRow({ item, onOpen }: { item: Item; onOpen: (id: string, type: string | null) => void }) {
  const { openCardMenu } = useCardActions();
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(item.id, item.type)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(item.id, item.type); } }}
      style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", boxSizing: "border-box", padding: "11px 4px",
        borderBottom: "0.5px solid var(--color-hairline)", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
      <Avatar item={item} size={40} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name_ru || item.id}</span>
        {item.name_iast && <span style={{ display: "block", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-footnote)", color: "var(--color-label-3)" }}>{item.name_iast}</span>}
      </span>
      <CardActionBtns favKey={`entity:${item.id}`} meta={favMetaFromCtx(entityCtx(item))} size={28} onMore={() => openCardMenu(entityCtx(item))} />
    </div>
  );
}

const GAURA_DS = encodeURIComponent("Гаура-ганоддеша-дипика · Гауранга Лила");

interface Collection { title: string; subtitle: string; rails: { title: string; params: string; orderIds?: string[] }[] }
const COLLECTIONS: Record<string, Collection> = {
  "radha-krishna": {
    title: "Радха-Кришна лила",
    subtitle: "Вечные игры Господа и Его спутников во Вриндаване",
    rails: [
      { title: "Божественная Чета", params: "ids=krishna,radharani", orderIds: ["krishna", "radharani"] },
      { title: "Гопи", params: "category=gopi&limit=40" },
      { title: "Манджари", params: "category=manjari&limit=30" },
      { title: "Пастушки Враджа", params: "category=gopa&limit=30" },
    ],
  },
  gauranga: {
    title: "Гауранга лила",
    subtitle: "Игры Гауранги Махапрабху и Его спутников",
    rails: [
      { title: "Панча-таттва", params: "ids=chaitanya,nityananda,advaita,gadadhara,srivasa", orderIds: ["chaitanya", "nityananda", "advaita", "gadadhara", "srivasa"] },
      { title: "Спутники Гауранги", params: `dataset=${GAURA_DS}&limit=60` },
    ],
  },
  bhagavatam: {
    title: "Шримад Бхагаватам",
    subtitle: "Воплощения и аватары Господа, Его великие преданные",
    rails: [
      { title: "Аватары Кришны", params: "rel=avatar-of&relTo=krishna&limit=20" },
      { title: "Экспансии Кришны", params: "rel=expansion-of&relTo=krishna&limit=10" },
      { title: "Личности «Бхагаватам»", params: "category=bhagavatam&limit=40" },
    ],
  },
  "iskcon-gurus": {
    title: "Гуру ИСККОН",
    subtitle: "Те, кто принял миссию Шрилы Прабхупады и продолжает цепь ученической преемственности",
    rails: [
      { title: "Дающие посвящение", params: "category=initiating-guru&limit=200" },
      { title: "Ученики-основатели", params: "category=founding-disciple&limit=20" },
      { title: "Зональные ачарьи (1977)", params: "category=zonal-acharya-1977&limit=20" },
      { title: "Духовные братья Прабхупады", params: "category=godbrother&limit=20" },
    ],
  },
};

/** Заголовок грани (нама·рупа·гуна·лила·дхама): санскритский кикер + русское имя. */
function FacetHead({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div style={{ marginTop: 30, marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
        <span aria-hidden style={{ width: 22, height: 3, borderRadius: 999, background: GOLD }} />
        <span style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-footnote)", letterSpacing: "0.3px", color: GOLD }}>{kicker}</span>
      </div>
      <h2 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 800, letterSpacing: "-0.4px", color: "var(--color-label)" }}>{title}</h2>
      {sub && <p style={{ margin: "3px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)", lineHeight: 1.45 }}>{cleanCardText(sub)}</p>}
    </div>
  );
}

/** Зал Кришны / Гауранги: единый движок графа, разложенный по пяти граням. */
function RealmHall({ realm, onOpen, onOpenCollection, onOpenPath }: {
  realm: "krishna" | "gauranga";
  onOpen: (id: string, type: string | null) => void;
  onOpenCollection?: (key: string) => void;
  onOpenPath?: (path: string) => void;
}) {
  const K = realm === "krishna";
  const hub = K ? "krishna" : "chaitanya";
  return (
    <div>
      {/* Порог пред Личностью */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-gold-deep)" }}>{K ? "Верховная Личность Бога" : "Беспрецедентная волна Гауранга Лилы"}</div>
        <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-label)" }}>{K ? "Шри Кришна" : "Шри Гауранга"}</h1>
        <p style={{ margin: "5px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)", lineHeight: 1.5 }}>
          {K ? "kṛṣṇas tu bhagavān svayam — Сам изначальный Господь, Его имена, формы, качества, игры и обители Враджа." : "Кришна в настроении и цвете Шримати Радхарани, низошедший раздать према-дхану Голоки в Гауранга Лиле."}
        </p>
      </div>

      {/* НАМА */}
      <FacetHead kicker="nāma" title="Имена" sub={K ? "Святые имена Господа неотличны от Него Самого." : "Имена Гауранги и Гаура-нама."} />
      <SectionCard title={K ? "Святые имена Кришны" : "Имена Шри Чайтаньи"} subtitle={K ? "Маха-мантра Харе Кришна и тысячи имён Господа" : "Гаурахари, Нимай, Вишвамбхара, Шачинандана"}
        mark={<MaskMark src={K ? "/vraj.svg" : "/gauranga.svg"} size={44} />} onClick={() => onOpen(hub, "personality")} />

      {/* РУПА */}
      <FacetHead kicker="rūpa" title="Формы" sub={K ? "Изначальная форма, аватары и экспансии Господа." : "Гауранга и Панча-таттва."} />
      {K ? (
        <>
          <Rail title="Божественная Чета" params="ids=krishna,radharani" orderIds={["krishna", "radharani"]} onOpen={onOpen} />
          <Rail title="Аватары" params="rel=avatar-of&relTo=krishna&limit=24" onOpen={onOpen} />
          <Rail title="Экспансии" params="rel=expansion-of&relTo=krishna&limit=16" onOpen={onOpen} />
          <Rail title="Шактьявеша-аватары" params="rel=shaktyavesha-of&relTo=krishna&limit=16" onOpen={onOpen} />
        </>
      ) : (
        <Rail title="Панча-таттва" params="ids=chaitanya,nityananda,advaita,gadadhara,srivasa" orderIds={["chaitanya", "nityananda", "advaita", "gadadhara", "srivasa"]} onOpen={onOpen} />
      )}

      {/* ГУНА */}
      <FacetHead kicker="guṇa" title="Качества" sub={K ? "Шестьдесят четыре трансцендентных качества Господа." : "Безграничная милость и сладость Махапрабху."} />
      <SectionCard title={K ? "Качества Шри Кришны" : "Качества Махапрабху"} subtitle={K ? "Всепривлекающий — описан в «Нектаре преданности»" : "Самый великодушный аватар, дарующий чистую любовь"}
        mark={<MaskMark src="/bbt.svg" size={44} />} onClick={() => onOpen(hub, "personality")} />

      {/* ЛИЛА */}
      <FacetHead kicker="līlā" title={K ? "Игры и спутники" : "Игры и спутники Гауранга Лилы"} sub={K ? "Вечные спутники Враджа по пяти расам." : "Волны Гауранга Лилы — от Панча-таттвы до ИСККОН."} />
      {K ? (
        <>
          <Rail title="Мадхурья · супружеская любовь" params="category=rasa%3Amadhurya&limit=60" onOpen={onOpen} />
          <Rail title="Ватсалья · родительская любовь" params="category=rasa%3Avatsalya&limit=20" onOpen={onOpen} />
          <Rail title="Сакхья · дружеская любовь" params="category=rasa%3Asakhya&limit=30" onOpen={onOpen} />
          <Rail title="Дасья · настроение служения" params="category=rasa%3Adasya&limit=20" onOpen={onOpen} />
          <Rail title="Шанта · обители и святыни Враджа" params="category=rasa%3Ashanta&limit=40" onOpen={onOpen} />
          <div style={{ marginTop: 16 }}>
            <SectionCard title="Радха-Кришна лила" subtitle="Войти в вечные игры Господа во Вриндаване" mark={<MaskMark src="/vraj.svg" size={44} />} onClick={() => onOpenCollection?.("radha-krishna")} />
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: 4 }}>
            <SectionCard title="Шрила Прабхупада" subtitle="Ачарья-основатель ИСККОН — последняя волна Гауранга Лилы" mark={<MaskMark src="/prabhupada.svg" size={56} pos="center bottom" />} accent onClick={() => onOpen("prabhupada", "personality")} />
          </div>
          <Rail title="Волна I · Панча-таттва" params="ids=chaitanya,nityananda,advaita,gadadhara,srivasa" orderIds={["chaitanya", "nityananda", "advaita", "gadadhara", "srivasa"]} onOpen={onOpen} />
          <Rail title="Спутники Махапрабху" params={`dataset=${GAURA_DS}&limit=60`} onOpen={onOpen} />
          <Rail title="Волна II · Шесть Госвами Вриндавана" params="category=six-goswamis&limit=10" onOpen={onOpen} />
          <Rail title="Волна III · Шринивас · Нароттама · Шьямананда" params="ids=srinivasa-acharya,narottama-dasa-thakura,shyamananda-pandita" orderIds={["srinivasa-acharya", "narottama-dasa-thakura", "shyamananda-pandita"]} onOpen={onOpen} />
          <Rail title="Волна IV · Гаудия-ачарьи" params="ids=vishvanatha-chakravarti,baladeva-vidyabhushana,jagannatha-dasa-babaji,bhaktivinoda-thakura,gaurakishora-dasa-babaji,bhaktisiddhanta-sarasvati" orderIds={["vishvanatha-chakravarti", "baladeva-vidyabhushana", "jagannatha-dasa-babaji", "bhaktivinoda-thakura", "gaurakishora-dasa-babaji", "bhaktisiddhanta-sarasvati"]} onOpen={onOpen} />
          <Rail title="Брахма-Мадхва-Гаудия-парампара" params="category=parampara&limit=40" onOpen={onOpen} />
          <div style={{ marginTop: 16 }}>
            <SectionCard title="Гауранга Лила" subtitle="Гауранга Махапрабху и Панча-таттва" mark={<MaskMark src="/gauranga.svg" size={44} />} onClick={() => onOpenCollection?.("gauranga")} />
          </div>
        </>
      )}

      {/* ДХАМА */}
      <FacetHead kicker="dhāma" title="Обители" sub={K ? "Святые места Враджа-мандалы, неотличные от Господа." : "Навадвипа-дхама и Нилачала (Джаганнатха Пури)."} />
      {K ? (
        <>
          <Rail title="Двенадцать лесов Враджа" params="category=vraja-vana&limit=12" onOpen={onOpen} />
          <Rail title="Святые места Враджа" params="category=vraja-tirtha&limit=40" onOpen={onOpen} />
        </>
      ) : (
        <>
          <Rail title="Девять островов Навадвипы" params="category=navadvipa&limit=12" onOpen={onOpen} />
          <Rail title="Нилачала · Джаганнатха Пури" params="category=nilachala&limit=12" onOpen={onOpen} />
        </>
      )}
      <div style={{ marginTop: 16 }}>
        <SectionCard title={K ? "Враджа-мандала на карте" : "Дхамы на карте"} subtitle={K ? "Двенадцать лесов Враджа, Говардхан, Радха-кунда" : "Навадвипа, Джаганнатха Пури и святые дхамы"}
          mark={<MaskMark src="/vraj.svg" size={44} />} onClick={() => onOpenPath?.("/dhama")} />
      </div>

      <div style={{ height: 12 }} />
    </div>
  );
}

export default function AcharyaScreen({ collection, realm, onBack, onOpen, onOpenCollection, onOpenPath }: {
  collection?: string | null;
  realm?: "krishna" | "gauranga" | null;
  onBack?: () => void;
  onOpen: (id: string, type: string | null) => void;
  onOpenCollection?: (key: string) => void;
  onOpenPath?: (path: string) => void;
}) {
  // ── Режим экрана лилы ──
  if (collection) {
    const col = COLLECTIONS[collection];
    return (
      <div style={{ minHeight: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", height: 52, padding: "0 8px",
          background: "color-mix(in srgb, var(--color-bg) 86%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderBottom: "0.5px solid var(--color-hairline)" }}>
          <button type="button" aria-label="Назад" onClick={onBack}
            style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
            <BackIcon size={22} />
          </button>
        </div>
        <div style={{ padding: "8px 16px calc(48px + env(safe-area-inset-bottom,0px))" }}>
          {col ? (
            <>
              <span aria-hidden style={{ display: "block", width: 30, height: 3, borderRadius: 999, background: GOLD, marginBottom: 12 }} />
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: 800, letterSpacing: "-0.4px", color: "var(--color-label)" }}>{col.title}</h1>
              <p style={{ margin: "5px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)", lineHeight: 1.45 }}>{col.subtitle}</p>
              {col.rails.map((r) => <Rail key={r.title} title={r.title} params={r.params} orderIds={r.orderIds} onOpen={onOpen} />)}
            </>
          ) : (
            <p style={{ marginTop: 40, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)" }}>Раздел не найден.</p>
          )}
        </div>
      </div>
    );
  }

  // ── Зал Кришны / Гауранги: пять граней (нама·рупа·гуна·лила·дхама) ──
  if (realm) return <RealmHall realm={realm} onOpen={onOpen} onOpenCollection={onOpenCollection} onOpenPath={onOpenPath} />;

  // ── Режим лендинга (карточки разделов + поиск) ──
  return <AcharyaLanding realm={realm} onOpen={onOpen} onOpenCollection={onOpenCollection} onOpenPath={onOpenPath} />;
}

function AcharyaLanding({ realm, onOpen, onOpenCollection, onOpenPath }: { realm?: "krishna" | "gauranga" | null; onOpen: (id: string, type: string | null) => void; onOpenCollection?: (key: string) => void; onOpenPath?: (path: string) => void;
}) {
  return (
    <div>
      {/* ЗКН-Н007 — ШАПКА ВИТРИНЫ, как у остальных Богатств.
       *
       * Надпись НЕ повторяет вкладку: вкладка называется «Личности», значит
       * надпись говорит ДРУГОЕ — чем эти личности являются в архитектуре
       * приложения (ЗКН-Сд005: персонализм, всё висит на графе Личностей). */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-gold-deep)" }}>Вечные спутники</div>
        <h1 style={{ margin: "2px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: 800, letterSpacing: "-0.4px", color: "var(--color-label)" }}>Герои</h1>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)", lineHeight: 1.4 }}>
          Абсолют — Личность, и путь к Нему идёт через личности. Три лилы, в каждой свой строй
        </p>
      </div>

      {/* ТРИ ВХОДА. Описание каждого — по тому, ЧТО за ним реально открывается:
       *   Гауранга Лила  → волны (I–V, беспрецедентная, ачарьи сампрадай)
       *   Кришна Лила    → расы (шанта · дасья · сакхья · ватсалья · мадхурья)
       *   Шримад Бхагаватам → чины (аватары · мудрецы · цари · полубоги · демоны · эпосы) */}
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionCard
          title="Гауранга Лила"
          subtitle="Кришна в облике преданного. Пять волн санкиртаны — от Панча-таттвы до ачарьев и ИСККОН"
          mark={<MaskMark src="/gauranga.svg" size={48} />}
          onClick={() => onOpenPath?.("/dhana/gauranga-lila")}
        />
        <SectionCard
          title="Кришна Лила"
          subtitle="Свайам Бхагаван во Врадже. Спутники по расам — от покоя шанты до мадхурьи манджари"
          mark={<MaskMark src="/vraj.svg" size={48} />}
          onClick={() => onOpenPath?.("/dhana/krishna-lila")}
        />
        <SectionCard
          title="Шримад Бхагаватам"
          subtitle="Зрелый плод Вед. Аватары и мудрецы, цари и преданные, полубоги и демоны"
          mark={<MaskMark src="/bbt.svg" size={48} />}
          onClick={() => onOpenPath?.("/dhana/shrimad-bhagavatam")}
        />
      </div>
    </div>
  );
}

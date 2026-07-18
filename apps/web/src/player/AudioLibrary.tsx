/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AudioLibrary — МЕДИАТЕКА (Apple Music iOS 26.5).
 *
 * ЗКН-Н090 · У АУДИОТЕКИ ТРИ УРОВНЯ: ГОЛОС → СОБРАНИЕ → ЗАПИСЬ.
 *
 * Было: один плоский список на 857 лекций, где четыре рассказчика лежали
 * вперемешку, потому что «показать всё» — не устройство, а его отсутствие.
 * Найти в нём Шрилу Прабхупаду можно было только прокруткой.
 *
 * Стало ровно то, что делает Apple: витрина не вываливает записи, а
 * СПРАШИВАЕТ, с какой стороны заходить —
 *
 *     Рассказчики → цикл → запись        (знаю голос)
 *     Циклы       → запись               (знаю книгу)
 *     Записи                             (знаю название)
 *     Отложенное                         (уже выбрал раньше)
 *
 * Уровень — это СЛАГ, а не отображаемое имя (имена совпадают и склоняются).
 * Оттого у каждого уровня своя очередь: `s:<голос>` · `a:<цикл>` · `all`.
 * Пока очереди голоса не было, «дальше» посреди цикла уводило к чужой лекции.
 *
 * ОДИН ЭКРАН НА ДВА РАЗДЕЛА. Катха и киртаны различаются НАЗВАНИЯМИ уровней
 * («Рассказчики/Циклы» против «Киртания/Записи»), а не устройством. Две копии
 * разошлись бы через месяц — и разошлись бы в мелочах, которые злят.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useMemo, useState, type ReactNode } from "react";
import { usePlayer, mediaTrackKey } from "./store";
import {
  ScreenHeader, SectionRow, MediaRow, ListCard, EmptyState, PlayShuffle, MenuButton,
  GroupTitle, RowLine, fmtDur, count, type MenuItem,
} from "./ui";
import {
  VoiceIcon, MicIcon, StackIcon, NoteIcon, StarIcon, FilterIcon, ClockIcon, ChevronRightIcon,
} from "./icons";
import { useFavorites } from "../cardActions";

const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";
const ACCENT = "var(--color-gold-deep)";

/* ─────────────────────────── общий вид данных ─────────────────────────── */

/** ГОЛОС — рассказчик катхи или киртания. Верхний уровень аудиотеки. */
export interface LibVoice {
  slug: string; name: string; role?: string; mono?: string; accent?: boolean;
  count: number; seconds: number;
}
/** СОБРАНИЕ — цикл лекций или альбом. Средний уровень. */
export interface LibCollection {
  id: string; voiceSlug: string; voiceName: string; title: string; note?: string;
  count: number; seconds: number;
}
/** ЗАПИСЬ — то, что звучит. Нижний уровень. */
export interface LibItem {
  key: string; title: string; voiceSlug: string; voiceName: string;
  collectionId?: string; collectionTitle?: string; seconds: number;
  /* МЕСТО В КАЖДОЙ ИЗ ОЧЕРЕДЕЙ, где эта запись состоит.
   *
   * Очередь — не свойство записи, а свойство ЭКРАНА: открыл цикл — «дальше»
   * идёт по циклу; открыл рассказчика — по рассказчику; открыл все записи — по
   * всему. Один индекс на все случаи и был причиной того, что после лекции
   * начиналась чужая: место считалось в одном списке, а играло в другом. */
  globalIndex: number;
  voiceIndex: number;
  collectionIndex: number;
}

export interface LibDomain {
  kind: "katha" | "kirtan";
  /** Как называется голос в этом разделе. */
  voicesTitle: string; voiceOne: string;
  /** Как называется корень раздела — им подписана кнопка «назад». */
  homeLabel: string;
  /** Как называется собрание; пусто — уровня нет (у киртанов альбом не связан с записями). */
  collectionsTitle?: string;
  itemsTitle: string;
  voices: LibVoice[];
  collections: LibCollection[];
  items: LibItem[];
  /** Ключи очередей плеера для каждого уровня (ЗКН-Н090). */
  allQueue: string;
  voiceQueue: (slug: string) => string;
  collectionQueue?: (id: string) => string;
  /** Куда ведёт «полная карточка голоса», если она есть в приложении. */
  voiceHref?: (slug: string) => string;
}

/** Уровень, с которого включили запись, — он же уровень очереди. */
type Scope = "all" | "voice" | "collection";

export type LibView =
  | { name: "home" }
  | { name: "voices" }
  | { name: "voice"; slug: string }
  | { name: "collections" }
  | { name: "collection"; id: string }
  | { name: "items" }
  | { name: "mine" };

type SortKey = "default" | "title" | "voice" | "longest" | "shortest";

/** До скольких голосов раздел показывает их ЦЕЛИКОМ, не пряча за переход. */
const VOICES_INLINE = 6;

const SORT_LABEL: Record<SortKey, string> = {
  default: "По умолчанию", title: "По названию", voice: "По имени",
  longest: "Сначала длинные", shortest: "Сначала короткие",
};

/* ─────────────────────────── экран ─────────────────────────── */

export function AudioLibrary({ domain, view, onView, onOpenPath, header }: {
  domain: LibDomain;
  view: LibView;
  onView: (v: LibView) => void;
  onOpenPath?: (path: string) => void;
  /** Шапка витрины (HubHeader + поиск) — рисуется только на корневом уровне. */
  header?: ReactNode;
}) {
  const p = usePlayer();
  const favs = useFavorites();
  const [sort, setSort] = useState<SortKey>("default");
  const [onlyFav, setOnlyFav] = useState(false);

  /* Ключ избранного несёт хвост обхода кэша (`?v=2`) — он часть адреса, а не
     часть записи. Сравниваем по чистой части, иначе сердце «теряется» после
     смены хвоста и человек видит пустое отложенное при полной полке. */
  const favKeys = useMemo(() => new Set(favs.map((f) => f.key.split("?")[0])), [favs]);
  const nowKey = p.track ? mediaTrackKey(p.track, p.kind).split("?")[0] : "";
  const totalSec = useMemo(() => domain.items.reduce((s, i) => s + i.seconds, 0), [domain.items]);

  /** Очередь = ЭКРАН, с которого включили. Иначе после лекции пойдёт чужая. */
  const queueOf = (it: LibItem, scope: Scope): [string, number] => {
    if (scope === "collection" && it.collectionId && domain.collectionQueue)
      return [domain.collectionQueue(it.collectionId), it.collectionIndex];
    if (scope === "voice") return [domain.voiceQueue(it.voiceSlug), it.voiceIndex];
    return [domain.allQueue, it.globalIndex];
  };
  const start = (it: LibItem, scope: Scope, shuffle = false) => {
    const [q, i] = queueOf(it, scope);
    p.setOrder(shuffle ? "shuffle" : "forward");
    if (domain.kind === "katha") p.playKatha(q, i);
    else p.playKirtan(q, i);
  };
  /** «Слушать» и «Перемешать» — два разных намерения, а не одна кнопка с меню. */
  const playQueue = (list: LibItem[], scope: Scope, shuffle: boolean) => {
    if (!list.length) return;
    start(shuffle ? list[Math.floor(Math.random() * list.length)] : list[0], scope, shuffle);
  };

  const sortItems = (list: LibItem[]): LibItem[] => {
    const a = onlyFav ? list.filter((i) => favKeys.has(i.key)) : list.slice();
    switch (sort) {
      case "title": return a.sort((x, y) => x.title.localeCompare(y.title, "ru"));
      case "voice": return a.sort((x, y) => x.voiceName.localeCompare(y.voiceName, "ru") || x.title.localeCompare(y.title, "ru"));
      case "longest": return a.sort((x, y) => y.seconds - x.seconds);
      case "shortest": return a.sort((x, y) => x.seconds - y.seconds);
      default: return a;
    }
  };

  const sortMenu = (keys: SortKey[]): MenuItem[] => keys.map((k) => ({
    id: k, label: SORT_LABEL[k], checked: sort === k, onSelect: () => setSort(k),
  }));
  const favFilter: MenuItem = {
    id: "fav", label: "Только отложенное", checked: onlyFav, divider: true,
    onSelect: () => setOnlyFav((v) => !v),
  };

  const isPlaying = (key: string) => !!nowKey && nowKey === key;

  /* ═══ КОРЕНЬ ═══
   *
   * ⚠️ БЫЛО: четыре строки разделов — и две трети экрана белого поля. Витрина,
   *    которая ничего не показывает, а только спрашивает «куда пойдёшь», —
   *    это оглавление, а не витрина. Apple так не делает: под разделами
   *    Медиатеки СРАЗУ идёт содержимое.
   *
   * Стало: разделы (компактно) → продолжить → голоса целиком (их единицы, прятать
   * нечего) → самые крупные собрания. Экран отвечает, а не переспрашивает. */
  if (view.name === "home") {
    const mine = domain.items.filter((i) => favKeys.has(i.key));
    const topVoices = domain.voices.slice().sort((a, b) => b.count - a.count);
    const topCols = domain.collections.slice().sort((a, b) => b.count - a.count).slice(0, 6);
    return (
      <div>
        {header}
        {/* ⚠️ РАЗДЕЛ И БЛОК НАЗЫВАЛИСЬ ОДИНАКОВО. «Рассказчики 3 ›» стояло строкой —
            и тут же ниже шли те же три рассказчика списком. Строка-раздел нужна
            ровно тогда, когда за ней ПРЯЧЕТСЯ то, что не поместилось; когда всё
            видно, она просто повторяет заголовок. */}
        <ListCard>
          {domain.voices.length > VOICES_INLINE && (
            <SectionRow icon={domain.kind === "katha" ? <VoiceIcon size={22} /> : <MicIcon size={22} />}
              title={domain.voicesTitle} value={String(domain.voices.length)}
              onClick={() => onView({ name: "voices" })} />
          )}
          <SectionRow icon={<NoteIcon size={22} />} title={domain.itemsTitle}
            value={String(domain.items.length)} onClick={() => onView({ name: "items" })} />
          <SectionRow icon={<StarIcon size={22} />} title="Отложенное"
            value={mine.length ? String(mine.length) : ""} onClick={() => onView({ name: "mine" })} last />
        </ListCard>

        {/* ЗКН-Н091: место в лекции — то, ради чего человек вернулся. */}
        {p.active && p.kind === domain.kind && p.track && (
          <section style={{ marginTop: 24 }}>
            <GroupTitle>Продолжить</GroupTitle>
            <ListCard>
              <MediaRow title={p.track.title} subtitle={p.track.artist || p.artist}
                meta={p.duration > 0 ? `осталось ${fmtDur(Math.max(0, p.duration - p.currentTime))}` : undefined}
                active playing={p.isPlaying} onClick={() => p.open()} last />
            </ListCard>
          </section>
        )}

        {topVoices.length > 0 && topVoices.length <= VOICES_INLINE && (
          <section style={{ marginTop: 24 }}>
            <GroupTitle>{domain.voicesTitle}</GroupTitle>
            <ListCard>
              {topVoices.map((v, i) => (
                <VoiceRow key={v.slug} voice={v} last={i === topVoices.length - 1}
                  onClick={() => (domain.voiceHref && onOpenPath
                    ? onOpenPath(domain.voiceHref(v.slug))
                    : onView({ name: "voice", slug: v.slug }))} />
              ))}
            </ListCard>
          </section>
        )}

        {topCols.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <GroupTitle action={
              <button type="button" onClick={() => onView({ name: "collections" })}
                style={{ border: "none", background: "none", cursor: "pointer", padding: 0,
                  fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: ACCENT }}>
                Все {domain.collections.length}
              </button>
            }>{domain.collectionsTitle}</GroupTitle>
            <ListCard>
              {topCols.map((c, i) => (
                <MediaRow key={c.id} title={c.title}
                  subtitle={`${count(c.count, "часть", "части", "частей")} · ${fmtDur(c.seconds)}`}
                  onClick={() => onView({ name: "collection", id: c.id })}
                  last={i === topCols.length - 1} />
              ))}
            </ListCard>
          </section>
        )}

        <p style={{ margin: "16px 4px 0", fontSize: "var(--text-footnote)", color: INK3 }}>
          {count(domain.items.length, "запись", "записи", "записей")} · {fmtDur(totalSec)} звучания
        </p>
      </div>
    );
  }

  /* ── список голосов ── */
  if (view.name === "voices") {
    const list = domain.voices.slice().sort((a, b) =>
      sort === "voice" ? a.name.localeCompare(b.name, "ru") : b.count - a.count);
    return (
      <div>
        <ScreenHeader title={domain.voicesTitle} onBack={() => onView({ name: "home" })} backLabel={domain.homeLabel}
          subtitle={`${count(domain.voices.length, "голос", "голоса", "голосов")} · ${fmtDur(totalSec)}`}
          actions={<>
            <MenuButton plain label="Порядок" width={230} items={[
              { id: "count", label: "Сначала с бо́льшим собранием", checked: sort !== "voice", onSelect: () => setSort("default") },
              { id: "az", label: "По имени", checked: sort === "voice", onSelect: () => setSort("voice") },
            ]}><FilterIcon size={21} /></MenuButton>
          </>} />
        <ListCard>
          {list.map((v, i) => (
            <VoiceRow key={v.slug} voice={v} last={i === list.length - 1}
              onClick={() => (domain.voiceHref && onOpenPath
                ? onOpenPath(domain.voiceHref(v.slug))
                : onView({ name: "voice", slug: v.slug }))} />
          ))}
        </ListCard>
      </div>
    );
  }

  /* ── один голос: его собрания и записи ── */
  if (view.name === "voice") {
    const v = domain.voices.find((x) => x.slug === view.slug);
    const items = sortItems(domain.items.filter((i) => i.voiceSlug === view.slug));
    const cols = domain.collections.filter((c) => c.voiceSlug === view.slug);
    if (!v) return <NotFound onBack={() => onView({ name: "voices" })} />;
    return (
      <div>
        <ScreenHeader title={v.name} onBack={() => onView({ name: "voices" })} backLabel={domain.voicesTitle}
          subtitle={[v.role, `${count(v.count, "запись", "записи", "записей")} · ${fmtDur(v.seconds)}`]
            .filter(Boolean).join(" · ")}
          actions={<>
            <MenuButton plain label="Порядок и фильтр" width={240}
              items={[...sortMenu(["default", "title", "longest", "shortest"]), favFilter]}>
              <FilterIcon size={21} />
            </MenuButton>
          </>} />
        <div style={{ marginBottom: 18 }}>
          <PlayShuffle onPlay={() => playQueue(items, "voice", false)} onShuffle={() => playQueue(items, "voice", true)} />
        </div>

        {cols.length > 0 && (
          <section style={{ marginBottom: 22 }}>
            <GroupTitle>{domain.collectionsTitle}</GroupTitle>
            <ListCard>
              {cols.map((c, i) => (
                <MediaRow key={c.id} title={c.title}
                  subtitle={`${count(c.count, "часть", "части", "частей")} · ${fmtDur(c.seconds)}`}
                  onClick={() => onView({ name: "collection", id: c.id })}
                  last={i === cols.length - 1} />
              ))}
            </ListCard>
          </section>
        )}

        <GroupTitle>{domain.itemsTitle}</GroupTitle>
        <ItemList items={items} onPlay={(it) => start(it, "voice")} isPlaying={isPlaying}
          playingNow={p.isPlaying} subtitleOf={(it) => it.collectionTitle}
          empty="Здесь пока нет записей" />
      </div>
    );
  }

  /* ── список собраний ── */
  if (view.name === "collections") {
    const list = domain.collections.slice().sort((a, b) =>
      sort === "title" ? a.title.localeCompare(b.title, "ru")
        : sort === "voice" ? a.voiceName.localeCompare(b.voiceName, "ru")
        : b.count - a.count);
    return (
      <div>
        <ScreenHeader title={domain.collectionsTitle ?? "Собрания"} onBack={() => onView({ name: "home" })} backLabel={domain.homeLabel}
          subtitle={count(list.length, "собрание", "собрания", "собраний")}
          actions={<>
            <MenuButton plain label="Порядок" width={230}
              items={sortMenu(["default", "title", "voice"])}><FilterIcon size={21} /></MenuButton>
          </>} />
        <ListCard>
          {list.map((c, i) => (
            <MediaRow key={c.id} title={c.title}
              subtitle={`${c.voiceName} · ${count(c.count, "часть", "части", "частей")} · ${fmtDur(c.seconds)}`}
              onClick={() => onView({ name: "collection", id: c.id })} last={i === list.length - 1} />
          ))}
        </ListCard>
      </div>
    );
  }

  /* ── одно собрание ── */
  if (view.name === "collection") {
    const c = domain.collections.find((x) => x.id === view.id);
    const items = sortItems(domain.items.filter((i) => i.collectionId === view.id));
    if (!c) return <NotFound onBack={() => onView({ name: "collections" })} />;
    return (
      <div>
        <ScreenHeader title={c.title} onBack={() => onView({ name: "collections" })} backLabel={domain.collectionsTitle}
          subtitle={`${c.voiceName} · ${count(c.count, "часть", "части", "частей")} · ${fmtDur(c.seconds)}`}
          actions={<>
            <MenuButton plain label="Порядок и фильтр" width={240}
              items={[...sortMenu(["default", "title", "longest", "shortest"]), favFilter]}>
              <FilterIcon size={21} />
            </MenuButton>
          </>} />
        {c.note && (
          <p style={{ margin: "0 2px 14px", fontSize: "var(--text-subhead)", color: INK2, lineHeight: 1.45 }}>
            {c.note}
          </p>
        )}
        <div style={{ marginBottom: 18 }}>
          <PlayShuffle onPlay={() => playQueue(items, "collection", false)}
            onShuffle={() => playQueue(items, "collection", true)} />
        </div>
        <ItemList items={items} onPlay={(it) => start(it, "collection")} isPlaying={isPlaying}
          playingNow={p.isPlaying} numbered empty="В этом собрании пока нет записей" />
      </div>
    );
  }

  /* ── все записи ── */
  if (view.name === "items") {
    const items = sortItems(domain.items);
    return (
      <div>
        <ScreenHeader title={domain.itemsTitle} onBack={() => onView({ name: "home" })} backLabel={domain.homeLabel}
          subtitle={`${count(items.length, "запись", "записи", "записей")} · ${fmtDur(totalSec)}`}
          actions={<>
            <MenuButton plain label="Порядок и фильтр" width={240}
              items={[...sortMenu(["default", "title", "voice", "longest", "shortest"]), favFilter]}>
              <FilterIcon size={21} />
            </MenuButton>
          </>} />
        <div style={{ marginBottom: 18 }}>
          <PlayShuffle onPlay={() => playQueue(items, "all", false)} onShuffle={() => playQueue(items, "all", true)} />
        </div>
        <ItemList items={items} onPlay={(it) => start(it, "all")} isPlaying={isPlaying}
          playingNow={p.isPlaying}
          subtitleOf={(it) => (domain.voices.length > 1 && it.collectionTitle
            ? `${it.collectionTitle} · ${it.voiceName}`
            : it.collectionTitle || it.voiceName)}
          empty="Записей пока нет" />
      </div>
    );
  }

  /* ── отложенное ── */
  const mine = domain.items.filter((i) => favKeys.has(i.key));
  return (
    <div>
      <ScreenHeader title="Отложенное" onBack={() => onView({ name: "home" })} backLabel={domain.homeLabel}
        subtitle={mine.length ? count(mine.length, "запись", "записи", "записей") : undefined} />
      {mine.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <PlayShuffle onPlay={() => playQueue(mine, "voice", false)} onShuffle={() => playQueue(mine, "voice", true)} />
        </div>
      )}
      <ItemList items={mine} onPlay={(it) => start(it, "voice")} isPlaying={isPlaying}
        playingNow={p.isPlaying} subtitleOf={(it) => it.collectionTitle || it.voiceName}
        empty="Отложенных записей пока нет"
        hint="Сердце у записи — и она появится здесь." />
    </div>
  );
}

/* ─────────────────────────── список записей ─────────────────────────── */

/**
 * СПИСОК ЗАПИСЕЙ.
 *
 * ⚠️ ПОДПИСЬ ПОВТОРЯЛА ТО, ЧТО И ТАК НАПИСАНО В ШАПКЕ. Внутри цикла «Шримад-
 *    Бхагаватам · Песнь Первая» стояло под каждой из 226 строк — двести
 *    двадцать шесть раз одно и то же. Подпись обязана РАЗЛИЧАТЬ строки, а не
 *    повторять заголовок: где различает цикл — там цикл, где голос — голос,
 *    а внутри собрания различать нечего, и подписи нет.
 */
function ItemList({ items, onPlay, isPlaying, playingNow, numbered, subtitleOf, empty, hint }: {
  items: LibItem[]; onPlay: (i: LibItem) => void;
  isPlaying: (key: string) => boolean; playingNow: boolean;
  numbered?: boolean; subtitleOf?: (i: LibItem) => string | undefined;
  empty: string; hint?: string;
}) {
  if (!items.length) return <EmptyState icon={<NoteIcon size={44} />} text={empty} hint={hint} />;
  return (
    <ListCard>
      {items.map((it, i) => {
        const on = isPlaying(it.key);
        return (
          <MediaRow key={it.key}
            num={numbered ? i + 1 : undefined}
            title={it.title}
            subtitle={subtitleOf?.(it)}
            meta={it.seconds ? fmtDur(it.seconds) : undefined}
            active={on} playing={on && playingNow}
            onClick={() => onPlay(it)}
            last={i === items.length - 1} />
        );
      })}
    </ListCard>
  );
}

/**
 * СТРОКА ГОЛОСА.
 *
 * ⚠️ Была с «аватаром» — фирменной заглушкой, одинаковой у всех: три круга с
 *    одним логотипом подряд. Повторённая картинка НЕ РАЗЛИЧАЕТ, а значит не
 *    работает; вместо неё различает ИМЯ, набранное крупно, и вес собрания.
 */
function VoiceRow({ voice, onClick, last }: { voice: LibVoice; onClick: () => void; last?: boolean }) {
  return (
    <>
      <button type="button" onClick={onClick} className="tap-row"
        style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box",
          minHeight: 62, padding: "8px 16px 8px 0", border: "none", background: "none",
          cursor: "pointer", textAlign: "left", fontFamily: "var(--font-text)",
          WebkitTapHighlightColor: "transparent",
        }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: "var(--text-body)", fontWeight: 600,
            letterSpacing: "-0.01em", color: "var(--color-label)", lineHeight: 1.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {voice.name}
          </span>
          <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-subhead)",
            color: INK2, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {voice.role}
          </span>
        </span>
        <span style={{ flexShrink: 0, textAlign: "right" }}>
          <span style={{ display: "block", fontSize: "var(--text-subhead)", color: "var(--color-label)",
            fontVariantNumeric: "tabular-nums" }}>{voice.count}</span>
          <span style={{ display: "block", marginTop: 1, fontSize: "var(--text-caption)", color: INK3 }}>
            {fmtDur(voice.seconds)}
          </span>
        </span>
        <span aria-hidden style={{ flexShrink: 0, display: "grid", placeItems: "center", color: INK3 }}>
          <ChevronRightIcon size={15} />
        </span>
      </button>
      {!last && <RowLine />}
    </>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <ScreenHeader title="Не найдено" onBack={onBack} />
      <EmptyState icon={<ClockIcon size={44} />} text="Каталог ещё загружается или запись переехала." />
    </div>
  );
}

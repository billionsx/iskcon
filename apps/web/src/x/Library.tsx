/**
 * БИБЛИОТЕКА — экран Apple Music, снятый с кадров f16 · f22 · f28.
 *
 * Разбор всех 35 кадров набора Music показал, что плеерных там пять, а
 * остальные — библиотека, списки и промо. И что экраны библиотеки ПУСТЫЕ:
 * у снятого аккаунта нет фонотеки. Это оказалось удачей — пустое состояние
 * нигде больше не снято, а у нас пустых разделов много.
 *
 * ЧТО ЗАМЕРЕНО (📐, совпало на нескольких кадрах):
 *   навигационная капсула   высота 42.0, верх y 60.0, материал — стекло
 *                           одиночная 41.3 (круг), парная 101.3
 *   нижняя панель           высота 46.0, верх y 714.0, врезка 22.7, ширина 348.3
 *   шаг строки библиотеки   51.7 · 50.0 · 54.3, набор строки 18.3
 *   пустое состояние        заголовок y 393…443 (h 40.3),
 *                           пояснение строкой 12.3 с шагом 19.0
 *
 * Заголовок пустого состояния стоит ВЫШЕ середины: центр его набора приходится
 * на 49% высоты, а не на 50%. Оптический центр выше геометрического.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Menu, type MenuGroups } from "./Menu";

/* ─────────────────────────── знаки ─────────────────────────── */

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.33,
            strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function ChevronRight({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M9.5 6l6 6-6 6" /></svg>;
}
function SearchGlyph({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle {...S} cx="11" cy="11" r="6.4" /><path {...S} d="M15.8 15.8 20 20" /></svg>;
}
function BackGlyph({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M14.5 6l-6 6 6 6" /></svg>;
}
function DotsGlyph({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="5.5" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.7" fill="currentColor" /></svg>;
}

/* ─────────────────────── навигационная капсула ─────────────────────── */

/**
 * 📐 f16 · f28: высота 42.0, верх y 60.0, заливка та же, что у мини-плеера.
 * Одиночная кнопка выходит кругом (41.3 ≈ 42), пара — капсулой 101.3.
 *
 * Кнопки НЕ лежат на плоском фоне и не обведены: у Apple это заливка #181818
 * на чёрном холсте, то есть ступень поверхности, а не рамка.
 */
export function NavCapsule({ children, wide }: { children: ReactNode; wide?: boolean }) {
  /* Капсула — СТЕКЛО. Радиус h/2 = 21 (§4.2: кнопка · чип · поле = капсула). */
  return (
    <span className="glass" style={{
      ["--glass-r" as string]: "21px",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      height: 42, width: wide ? 101.3 : 42, flexShrink: 0,
    } as CSSProperties}>{children}</span>
  );
}

const navBtn: CSSProperties = {
  width: 42, height: 42, display: "grid", placeItems: "center", background: "none",
  border: "none", color: "var(--color-label)", cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

/* ─────────────────────────── пустое состояние ─────────────────────────── */

/**
 * 📐 f22 · f28. Заголовок y 393…443 (высота набора 40.3), пояснение строками
 * 12.3 с шагом 19.0, по центру.
 *
 * Пустое состояние — не заглушка, а полноценный экран: у нас пустых разделов
 * много (главы без текста, божества, циклы без обложек), и «ничего нет» надо
 * говорить так же внятно, как «вот содержимое».
 */
export function EmptyState({ title, hint, action }: {
  title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <div style={{
      position: "absolute", left: 24, right: 24,
      /* 📐 393 из 852 — заголовок стоит ВЫШЕ середины экрана */
      top: `${(393 / 852) * 100}%`, textAlign: "center",
    }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-display)",
        fontSize: "var(--text-title2)", lineHeight: "var(--lh-title2)",
        letterSpacing: "var(--ls-title2)", fontWeight: 700, color: "var(--color-label)" }}>
        {title}
      </h2>
      {hint && (
        <p style={{ margin: "10px 0 0", fontFamily: "var(--font-text)",
          fontSize: "var(--text-subhead)", lineHeight: "var(--lh-subhead)",
          letterSpacing: "var(--ls-subhead)", color: "var(--color-label-3)" }}>
          {hint}
        </p>
      )}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

/* ─────────────────────────── строка раздела ─────────────────────────── */

/**
 * СТРОКА БИБЛИОТЕКИ — 📐 IMG_1963/1966: знак `[21.3+18.7]` цветом продукта,
 * подпись с 58.7, шеврон на 364.7, шаг 52, разделитель начинается ОТ ТЕКСТА,
 * а не от края экрана. У Apple знаки красные — акцент их продукта; наш акцент
 * золото, и правило стандарта то же: акцент берётся из хрома продукта.
 */
export function SectionRow({ label, count, icon, sep, onClick }: {
  label: string; count?: string; icon?: ReactNode; sep?: boolean; onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      position: "relative", display: "flex", alignItems: "center", gap: 0,
      width: "100%", height: 52, padding: 0, background: "none", border: "none",
      cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent",
    }}>
      {sep && <span aria-hidden style={{ position: "absolute", top: 0, left: 58.7,
        right: 0, height: 1, background: "var(--color-separator)", opacity: 0.55 }} />}
      <span aria-hidden style={{ width: 58.7, paddingLeft: 21.3, flexShrink: 0,
        display: "grid", justifyItems: "start", color: "var(--color-gold-deep)" }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-text)",
        fontSize: "var(--text-body)", lineHeight: "var(--lh-body)",
        letterSpacing: "var(--ls-body)", color: "var(--color-label)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {count && (
        <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)",
          lineHeight: "var(--lh-subhead)", letterSpacing: "var(--ls-subhead)",
          color: "var(--color-label-3)", flexShrink: 0, paddingRight: 10 }}>{count}</span>
      )}
      <span style={{ color: "var(--color-label-3)", flexShrink: 0, display: "grid",
        width: 28.3, justifyItems: "start" }}>
        <ChevronRight size={15} />
      </span>
    </button>
  );
}

/** Знак рассказчика — микрофон, как у Apple в Artists. */
function MicGlyph({ size = 19 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle {...S} cx="15.5" cy="7.5" r="3.9" />
    <path {...S} d="M12.7 10.3 5.2 17.8l-1 3 3-1 7.5-7.5" /></svg>;
}

/* ─────────────────────── нижняя плавающая панель ─────────────────────── */

/**
 * 📐 f16 · f22 · f28: высота 46.0, верх y 714.0, врезка 22.7, ширина 348.3.
 *
 * Она НЕ мини-плеер: тот 48.0 при врезке 21.0 и ширине 351.0. Разница в два
 * пункта не случайность — панель поиска у́же и ниже, потому что стоит под
 * содержимым, а мини-плеер лежит ПОВЕРХ него.
 */
export function BottomPanel({ children }: { children: ReactNode }) {
  /* Панель — СТЕКЛО, капсула h/2 = 23. */
  return (
    <div className="glass" style={{
      ["--glass-r" as string]: "23px",
      position: "absolute", left: "50%", transform: "translateX(-50%)",
      top: `${(714 / 852) * 100}%`, width: 348.3, height: 46,
      display: "flex", alignItems: "center", padding: "0 14px", gap: 10,
    } as CSSProperties}>{children}</div>
  );
}

/* ─────────────────────────── экран ─────────────────────────── */

interface SpeakerRow { slug: string; name: string; albums: number; secs: number }

function hours(secs: number): string {
  const h = Math.round(secs / 3600);
  return `${h} ч`;
}

type SortMode = "hours" | "name" | "albums";
const SORT_LABEL: Record<SortMode, string> = {
  hours: "По часам", name: "По имени", albums: "По числу циклов",
};

export default function LibraryScreen() {
  const [rows, setRows] = useState<SpeakerRow[] | null>(null);
  const [menu, setMenu] = useState(false);
  const [sort, setSort] = useState<SortMode>("hours");

  useEffect(() => {
    fetch("/api/katha/albums", { credentials: "same-origin" })
      .then((r) => r.json() as Promise<{ albums: { speaker: string | null; secs: number }[] }>)
      .then((d) => {
        const m = new Map<string, { albums: number; secs: number }>();
        for (const a of d.albums ?? []) {
          const k = a.speaker ?? "Катха";
          const v = m.get(k) ?? { albums: 0, secs: 0 };
          v.albums += 1; v.secs += a.secs; m.set(k, v);
        }
        setRows([...m.entries()]
          .map(([name, v]) => ({ slug: name, name, ...v }))
          .sort((x, y) => y.secs - x.secs));
      })
      .catch(() => setRows([]));
  }, []);

  const sorted = rows && [...rows].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name, "ru")
    : sort === "albums" ? b.albums - a.albums
    : b.secs - a.secs);

  /* Меню собирается ГРУППАМИ: разделитель отделяет выбор порядка от действий.
     Замер это подтверждает — на f02 разделитель стоит после первого пункта,
     отделяя «показать всё» от «показать отобранное». */
  const groups: MenuGroups = [
    (["hours", "name", "albums"] as SortMode[]).map((m) => ({
      id: m, label: SORT_LABEL[m], checked: sort === m, onSelect: () => setSort(m),
    })),
    [{ id: "play", label: "Открыть плеер",
       onSelect: () => { window.location.href = "/x/play"; } }],
  ];

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden",
      background: "var(--color-canvas)" }}>
      {/* НАВИГАЦИЯ — 📐 капсулы 42.0 на высоте y60.0 */}
      <div style={{ position: "absolute", top: `${(60 / 852) * 100}%`, left: 17.7, right: 17.7,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <NavCapsule>
          <button type="button" style={navBtn} aria-label="Назад"
            onClick={() => { window.location.href = "/x/play"; }}>
            <BackGlyph size={18} />
          </button>
        </NavCapsule>
        <NavCapsule wide>
          <button type="button" style={navBtn} aria-label="Поиск"><SearchGlyph size={18} /></button>
          <button type="button" style={navBtn} aria-label="Ещё"
            onClick={() => setMenu(true)}><DotsGlyph size={18} /></button>
        </NavCapsule>
      </div>

      <div style={{ position: "absolute", top: `${(118 / 852) * 100}%`, left: 0, right: 0,
        bottom: `${(852 - 700) / 852 * 100}%`, overflowY: "auto", padding: "0 16px" }}>
        <h1 className="t-display" style={{ margin: "0 0 6px", padding: "0 var(--inset-row)",
          fontWeight: 700, color: "var(--color-label)" }}>Библиотека</h1>

        {rows === null && <p style={{ padding: "0 var(--inset-row)", color: "var(--color-label-3)",
          fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Загружаю…</p>}

        {sorted?.map((r, i) => (
          <SectionRow key={r.slug} label={r.name} count={`${r.albums} · ${hours(r.secs)}`}
            icon={<MicGlyph size={19} />} sep={i > 0}
            onClick={() => { window.location.href = "/x/play"; }} />
        ))}
      </div>

      {/* ПУСТОЕ СОСТОЯНИЕ — показывается, только когда каталог правда пуст */}
      {rows?.length === 0 && (
        <EmptyState title="Пока пусто"
          hint="Записи появятся здесь, когда каталог будет загружен." />
      )}

      {menu && <Menu groups={groups} onClose={() => setMenu(false)}
        place={{ top: `${(59 / 852) * 100}%`, right: 14 }} origin="top right" />}

      <BottomPanel>
        <span style={{ color: "var(--color-label-3)", display: "grid" }}><SearchGlyph size={18} /></span>
        <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)",
          lineHeight: "var(--lh-body)", letterSpacing: "var(--ls-body)",
          color: "var(--color-label-3)" }}>Поиск по библиотеке</span>
      </BottomPanel>
    </div>
  );
}

/* ─────────────────────── строка списка с миниатюрой ─────────────────────── */

/**
 * 📐 IMG_1958 («Интервью»), шаг **102.0** ровно — трижды подряд:
 *   миниатюра        x 20.0, размер 87.7 × 87.7
 *   зазор до текста  13.0
 *   текст            с 120.7
 *   многоточие       x 344.7, ширина 12.0
 *
 * Это НЕ строка библиотеки: там шаг ≈52 и знак 18.7. Разные строки — разные
 * замеры, и подставлять один вместо другого нельзя.
 */
export function MediaRow({ thumb, over, title, subtitle, onMore, onClick }: {
  thumb?: ReactNode; over?: string; title: string; subtitle?: string;
  onMore?: () => void; onClick?: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 102, gap: 13 }}>
      <button type="button" onClick={onClick}
        style={{ display: "flex", alignItems: "center", gap: 13, flex: 1, minWidth: 0,
          height: "100%", padding: "0 0 0 20px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
        <span style={{ width: 87.7, height: 87.7, flexShrink: 0, overflow: "hidden",
          borderRadius: "var(--radius-thumb)", background: "var(--color-fill-1)",
          display: "grid", placeItems: "center" }}>{thumb}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          {over && (
            <span style={{ display: "block", fontFamily: "var(--font-text)",
              fontSize: "var(--text-caption2)", lineHeight: "var(--lh-caption2)",
              letterSpacing: "var(--ls-caption2)", fontWeight: 600,
              textTransform: "uppercase", color: "var(--color-label-3)" }}>{over}</span>
          )}
          <span style={{ display: "block", fontFamily: "var(--font-text)",
            fontSize: "var(--text-body)", lineHeight: "var(--lh-body)",
            letterSpacing: "var(--ls-body)", color: "var(--color-label)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
          {subtitle && (
            <span style={{ fontFamily: "var(--font-text)",
              fontSize: "var(--text-subhead)", lineHeight: "var(--lh-subhead)",
              letterSpacing: "var(--ls-subhead)", color: "var(--color-label-3)",
              overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" }}>{subtitle}</span>
          )}
        </span>
      </button>
      {onMore && (
        <button type="button" onClick={onMore} aria-label="Ещё"
          style={{ width: 44, height: 44, marginRight: 4, flexShrink: 0, display: "grid",
            placeItems: "center", background: "none", border: "none",
            color: "var(--color-label-2)", cursor: "pointer",
            WebkitTapHighlightColor: "transparent" }}>
          <DotsGlyph size={18} />
        </button>
      )}
    </div>
  );
}

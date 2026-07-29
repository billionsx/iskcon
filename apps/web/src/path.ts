/**
 * Ц8 · ПУТЬ УЧЕНИКА — канон ступеней и хранение отметок.
 *
 * Ступени и шаги — НЕ выдумка приложения: это действующий путь ЦОСКР/GBC,
 * тот же, что в справочнике «Обучение» (HomeMore): Школа Бхакти → «Ученик в
 * ИСККОН» → первая инициация → Бхакти-шастры → вторая. Курсы ведут на
 * официальные площадки; сроки и условия рекомендаций у ятр различаются —
 * поэтому шаги называют ТРЕБОВАНИЕ, а не число (ЗКН-БТ001: правдоподобная
 * цифра хуже отсутствующей).
 *
 * Отметки — самоаттестация: только сам преданный знает, выучена ли
 * пранама-мантра. Приложение ХРАНИТ отметку, а не судит.
 *
 * Хранение — как у джапы: локально всегда (гость работает), для вошедшего —
 * зеркало на сервере через reading_progress (work='path', ref=id шага,
 * kind='step'): таблица уже умеет UNIQUE(user, work, ref), миграция не нужна.
 */

import { post } from "./account/track";

export interface PathStep {
  id: string;
  title: string;
  sub?: string;
  /** Официальная страница курса (внешняя). */
  url?: string;
  /** Метка источника требования. */
  badge?: "GBC" | "Обязательный";
}

export interface PathStage {
  id: string;
  title: string;
  sub: string;
  steps: PathStep[];
}

/* Порядок ступеней = порядок пути. Уровень преданного (Ц1) подсвечивает
 * «вы примерно здесь», но НЕ запирает: отметить можно любой шаг. */
export const PATH_STAGES: PathStage[] = [
  {
    id: "first",
    title: "Первые шаги",
    sub: "Знакомство с сознанием Кришны",
    steps: [
      { id: "first-program", title: "Побывать на программе", sub: "Храм, намахатта или бхакти-врикша — живое общение с преданными" },
      { id: "first-japa", title: "Начать джапу", sub: "Хотя бы один круг маха-мантры на чётках каждый день" },
      { id: "first-pranama", title: "Выучить пранама-мантру Шрилы Прабхупады", sub: "Нама ом вишну-падая…" },
      { id: "first-prasad", title: "Готовить и предлагать прасад", sub: "Вегетарианская пища, предложенная Кришне" },
      { id: "first-reading", title: "Начать читать Прабхупаду", sub: "«Бхагавад-гита как она есть» — с первой главы" },
    ],
  },
  {
    id: "practice",
    title: "Устойчивая практика",
    sub: "Садхана как основа дня",
    steps: [
      { id: "practice-16", title: "16 кругов ежедневно", sub: "Полная норма джапы без пропусков" },
      { id: "practice-4", title: "Следовать четырём регулирующим принципам", sub: "Без мяса, интоксикаций, азартных игр и недозволенных отношений" },
      { id: "practice-reading", title: "Ежедневное чтение", sub: "Системное чтение книг Шрилы Прабхупады" },
      { id: "practice-mentor", title: "Найти наставника", sub: "Старший преданный, ведущий по практике в вашей ятре" },
    ],
  },
  {
    id: "diksha1",
    title: "К первой инициации",
    sub: "Курсы Отдела вайшнавского образования ЦОСКР",
    steps: [
      { id: "d1-shraddha", title: "«Бхагавад-гита шраддха»", sub: "Изучение «Бхагавад-гиты как она есть» с кураторской поддержкой", url: "https://bhaktilata.ru/courses" },
      { id: "d1-school", title: "Школа Бхакти — первая ступень", sub: "Философия, садхана, вайшнавская культура", url: "https://bhakti.school/sb1", badge: "GBC" },
      { id: "d1-idc", title: "Курс «Ученик в ИСККОН»", sub: "Гуру-таттва и отношения с духовным учителем", url: "https://bhaktilata.ru/idc", badge: "Обязательный" },
      { id: "d1-etiket", title: "Вайшнавский этикет", sub: "Чистота, распорядок, отношения в общине", url: "https://bhaktilata.ru/etiket" },
      { id: "d1-recommend", title: "Рекомендация к инициации", sub: "Стабильная садхана и рекомендация по порядку вашей ятры" },
    ],
  },
  {
    id: "diksha2",
    title: "Ко второй инициации",
    sub: "Брахманское посвящение",
    steps: [
      { id: "d2-shastras", title: "Бхакти-шастры", sub: "«Бхагавад-гита», «Нектар преданности», «Нектар наставлений», «Шри Ишопанишад»", url: "https://bhaktilata.ru/courses", badge: "GBC" },
      { id: "d2-recommend", title: "Рекомендация духовного учителя", sub: "По зрелости служения и садханы" },
    ],
  },
];

/* Уровень Ц1 → ступень, где преданный «примерно сейчас». */
export const LEVEL_TO_STAGE: Record<string, string> = {
  guest: "first",
  neophyte: "first",
  practicing: "practice",
  initiated: "diksha2",
  guru: "diksha2",
};

/* ── хранение отметок ── */

const KEY = "path:v1";

export function readPathDone(): Set<string> {
  try {
    const s = localStorage.getItem(KEY);
    const a = s ? (JSON.parse(s) as unknown) : [];
    return new Set(Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : []);
  } catch { return new Set(); }
}

function writeLocal(done: Set<string>): void {
  try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch { /* приватный режим */ }
}

/** Переключить шаг. Локально — всегда; вошедшему — зеркало на сервер. */
export function togglePathStep(id: string, want: boolean): Set<string> {
  const done = readPathDone();
  if (want) done.add(id); else done.delete(id);
  writeLocal(done);
  post("/me/progress", { work: "path", ref: id, kind: "step", ...(want ? {} : { remove: true }) });
  return done;
}

/** Слить серверные отметки в локальные (вход с нового устройства). */
export function mergeServerPath(refs: string[]): Set<string> {
  const done = readPathDone();
  let grew = false;
  for (const r of refs) if (!done.has(r)) { done.add(r); grew = true; }
  if (grew) writeLocal(done);
  return done;
}

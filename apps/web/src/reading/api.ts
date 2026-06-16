/**
 * Клиент «Стих дня» — системное чтение БГ→ШБ→ЧЧ. Тот же домен под /api;
 * единицу (стихи до первого пурпорта + глобальный номер) отдаёт worker.
 */
import { api } from "../api";

export interface ReadVerse {
  id: string;
  ref: string;
  devanagari: string | null;
  translit: string | null;
  translation: string | null;
}

export interface ReadUnit {
  work: string;
  workName: string;
  workAbbr: string;
  /** id первого стиха единицы (точка входа в читалку и якорь возобновления). */
  startId: string;
  /** Глобальные номера (1-based) первого и последнего стиха единицы в сумме БГ+ШБ+ЧЧ. */
  fromGnum: number;
  toGnum: number;
  /** Всего стихов в трёх книгах. */
  total: number;
  verses: ReadVerse[];
  /** Комментарий Прабхупады, на котором закрывается единица (или null). */
  purport: { ref: string; text: string } | null;
  /** Точка старта следующей единицы (null — корпус прочитан до конца). */
  nextFrom: string | null;
  done: boolean;
}

export const readingClient = {
  async unit(from?: string | null): Promise<ReadUnit> {
    const url = from ? api(`/reading/unit?from=${encodeURIComponent(from)}`) : api(`/reading/unit`);
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`reading unit ${r.status}`);
    return (await r.json()) as ReadUnit;
  },
};

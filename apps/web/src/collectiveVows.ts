/**
 * Совместные враты (Ц6) — клиент. Курируемые обеты сангхи: общий итог + число
 * участников + мой вклад. Присоединение = первый вклад. Без ленты и переписки —
 * только совместное движение к цели.
 */
import { api } from "./api";

export interface CollectiveVow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  unit: string;
  target: number;
  total: number;
  members: number;
  mine: number;
}

export async function listCollectiveVows(): Promise<CollectiveVow[]> {
  try {
    const r = await fetch(api("/vows/collective"), { credentials: "include" });
    if (!r.ok) return [];
    return ((await r.json()) as { items?: CollectiveVow[] }).items || [];
  } catch { return []; }
}

/** Внести вклад. "auth" — нужен вход; null — ошибка; иначе — обновлённый список. */
export async function contributeCollective(vowId: string, amount: number): Promise<CollectiveVow[] | "auth" | null> {
  try {
    const r = await fetch(api("/me/vows/collective"), {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ vowId, amount }),
    });
    if (r.status === 401) return "auth";
    if (!r.ok) return null;
    return ((await r.json()) as { items?: CollectiveVow[] }).items || [];
  } catch { return null; }
}

/**
 * Сторис — серверный слой: диспетчер забора Telegram Stories канала.
 *
 * Страница gaurangers.com/stories-tool запускает GitHub Actions workflow `tg-stories.yml`
 * (Python/Telethon + диск + время), который забирает сторис канала (активные + закреплённые)
 * и публикует медиа + манифест на archive.org. Круг сторис в приложении строится из этого
 * манифеста (см. darshan/server.ts → iskconeStoriesCircle).
 *
 * Доступ закрыт ADMIN_TOKEN (заголовок x-admin-token), как у загрузчика аудио. GH_TOKEN
 * живёт только в воркере и наружу не отдаётся. Эндпоинт /manifest публичен (это уже
 * публичные данные archive.org) — показывает странице, что реально захвачено.
 *
 *   POST /api/stories-sync/run           → запустить забор → { tag }
 *   GET  /api/stories-sync/status?tag=…  → статус прогона
 *   GET  /api/stories-sync/manifest      → текущий манифест сторис (с archive.org)
 */

interface StoriesEnv {
  ADMIN_TOKEN?: string;
  GH_TOKEN?: string;
  GH_REPO?: string; // default billionsx/iskcon
}

const GH_API = "https://api.github.com";
const DEFAULT_REPO = "billionsx/iskcon";
const STORIES_WORKFLOW = "tg-stories.yml";
const REF = "main";
const IA_MANIFEST = "https://archive.org/download/iskcone-stories/stories.json";

interface GhRun {
  id: number;
  name?: string;
  display_title?: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  run_started_at?: string;
}

function reply(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "iskcon-one-love-stories",
  };
}

export async function storiesSyncApi(
  request: Request,
  env: StoriesEnv,
  url: URL,
): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/stories-sync/")) return null;
  const sub = url.pathname.slice("/api/stories-sync/".length);

  // ── текущий манифест с archive.org (публично) ──
  if (sub === "manifest" && request.method === "GET") {
    try {
      const r = await fetch(IA_MANIFEST, {
        headers: { accept: "application/json,*/*", "User-Agent": "iskcon-one-love-stories" },
        cf: { cacheTtl: 60 },
      } as RequestInit);
      if (!r.ok) return reply({ ok: false, status: r.status, count: 0, stories: [] });
      const mf = (await r.json()) as Record<string, unknown>;
      return reply({ ok: true, ...mf });
    } catch (e) {
      return reply({ ok: false, count: 0, stories: [], detail: (e as Error).message });
    }
  }

  // ── запуск / статус — только оператору ──
  if (!env.ADMIN_TOKEN) return reply({ error: "admin_disabled" }, 503);
  const given = request.headers.get("x-admin-token") || "";
  if (given !== env.ADMIN_TOKEN) return reply({ error: "unauthorized" }, 401);
  if (!env.GH_TOKEN) return reply({ error: "gh_token_missing" }, 503);

  const repo = env.GH_REPO || DEFAULT_REPO;

  try {
    if (sub === "run" && request.method === "POST") {
      const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const tag = crypto.randomUUID().slice(0, 8);
      const inputs: Record<string, string> = {
        run_tag: tag,
        channel: String(b.channel || "").trim(),
        identifier: String(b.identifier || "").trim(),
      };
      const res = await fetch(
        `${GH_API}/repos/${repo}/actions/workflows/${STORIES_WORKFLOW}/dispatches`,
        {
          method: "POST",
          headers: { ...ghHeaders(env.GH_TOKEN), "content-type": "application/json" },
          body: JSON.stringify({ ref: REF, inputs }),
        },
      );
      if (res.status !== 204) {
        const txt = await res.text().catch(() => "");
        return reply({ error: "dispatch_failed", status: res.status, detail: txt.slice(0, 300) }, 502);
      }
      return reply({ ok: true, tag });
    }

    if (sub === "status" && request.method === "GET") {
      const tag = url.searchParams.get("tag") || "";
      if (!tag) return reply({ error: "tag_required" }, 400);
      const runsRes = await fetch(
        `${GH_API}/repos/${repo}/actions/workflows/${STORIES_WORKFLOW}/runs?per_page=30`,
        { headers: ghHeaders(env.GH_TOKEN) },
      );
      if (!runsRes.ok) return reply({ error: "runs_failed", status: runsRes.status }, 502);
      const runs = (await runsRes.json()) as { workflow_runs?: GhRun[] };
      const run = (runs.workflow_runs || []).find(
        (r) => (r.display_title || "").includes(tag) || (r.name || "").includes(tag),
      );
      if (!run) return reply({ found: false, status: "queued" });
      return reply({
        found: true,
        runId: run.id,
        status: run.status,
        conclusion: run.conclusion,
        htmlUrl: run.html_url,
      });
    }

    return reply({ error: "not_found" }, 404);
  } catch (e) {
    return reply({ error: "internal", detail: (e as Error).message }, 500);
  }
}

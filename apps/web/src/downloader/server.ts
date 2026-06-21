/**
 * Загрузчик аудио — серверный слой (тот же воркер/origin, что Лента, кабинет, даршан).
 *
 * Страница gaurangers.com/downloader запускает выгрузку всех аудио из Telegram-канала
 * и публикацию на archive.org. Тяжёлую работу (MTProto + большие файлы + минуты времени)
 * браузер и Cloudflare Worker не тянут — нет сокетов под MTProto, лимиты CPU/памяти,
 * нет диска. Поэтому этот слой лишь ДИСПЕТЧЕРИЗУЕТ GitHub Actions workflow `tg-archive.yml`
 * (там есть Python/Telethon, диск и время) и отдаёт странице:
 *   • статус прогона,
 *   • временную ссылку на .zip-артефакт      → ПУТЬ Б («дай ссылку, залью сам»),
 *   • URL объекта archive.org                 → ПУТЬ А (автозагрузка + связь с книгой).
 *
 * Доступ закрыт ADMIN_TOKEN (тот же секрет, что у /api/admin/*): страница шлёт его в
 * заголовке x-admin-token. GitHub-токен GH_TOKEN живёт только в воркере и наружу не отдаётся.
 *   wrangler secret put GH_TOKEN     # PAT (fine-grained): Actions: read+write, Contents: read
 *
 * Эндпоинты:
 *   POST /api/downloader/run            → запустить (тело JSON, см. ниже) → { tag }
 *   GET  /api/downloader/status?tag=…   → статус прогона (+ artifactId, когда готово)
 *   GET  /api/downloader/artifact?id=…  → { url } короткоживущая ссылка на .zip
 */

interface DownloaderEnv {
  ADMIN_TOKEN?: string;
  GH_TOKEN?: string;
  GH_REPO?: string; // default billionsx/iskcon
  GH_WORKFLOW?: string; // default tg-archive.yml
}

const GH_API = "https://api.github.com";
const DEFAULT_REPO = "billionsx/iskcon";
const DEFAULT_WORKFLOW = "tg-archive.yml";
const REF = "main";

interface GhRun {
  id: number;
  name?: string;
  display_title?: string;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | …
  html_url: string;
}
interface GhArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
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
    "User-Agent": "gaurangers-downloader",
  };
}

export async function downloaderApi(
  request: Request,
  env: DownloaderEnv,
  url: URL,
): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/downloader/")) return null;

  // ── доступ только оператору ──
  if (!env.ADMIN_TOKEN) return reply({ error: "admin_disabled" }, 503);
  const given = request.headers.get("x-admin-token") || "";
  if (given !== env.ADMIN_TOKEN) return reply({ error: "unauthorized" }, 401);
  if (!env.GH_TOKEN) return reply({ error: "gh_token_missing" }, 503);

  const repo = env.GH_REPO || DEFAULT_REPO;
  const workflow = env.GH_WORKFLOW || DEFAULT_WORKFLOW;
  const sub = url.pathname.slice("/api/downloader/".length);

  try {
    // ── запуск выгрузки ──
    if (sub === "run" && request.method === "POST") {
      const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const channel = String(b.channel || "").trim();
      const mode = b.mode === "upload" ? "upload" : "package";
      const iaMode = b.iaMode === "attach_to_book" ? "attach_to_book" : "new_item";
      const identifier = String(b.identifier || "").trim();
      const bookIdentifier = String(b.bookIdentifier || "").trim();
      const book = String(b.book || "").trim();

      if (!channel) return reply({ error: "channel_required" }, 400);
      if (mode === "upload" && iaMode === "new_item" && !identifier && !book)
        return reply({ error: "identifier_required" }, 400);
      if (mode === "upload" && iaMode === "attach_to_book" && !bookIdentifier)
        return reply({ error: "book_identifier_required" }, 400);

      const tag = crypto.randomUUID().slice(0, 8);
      const inputs: Record<string, string> = {
        run_tag: tag,
        mode,
        channel,
        ia_mode: iaMode,
        identifier,
        related_book_url: String(b.relatedBookUrl || "").trim(),
        book_identifier: bookIdentifier,
        book,
      };

      const res = await fetch(
        `${GH_API}/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
        {
          method: "POST",
          headers: { ...ghHeaders(env.GH_TOKEN), "content-type": "application/json" },
          body: JSON.stringify({ ref: REF, inputs }),
        },
      );
      if (res.status !== 204) {
        const txt = await res.text().catch(() => "");
        return reply(
          { error: "dispatch_failed", status: res.status, detail: txt.slice(0, 300) },
          502,
        );
      }
      return reply({ ok: true, tag, mode, repo, workflow });
    }

    // ── статус прогона ──
    if (sub === "status" && request.method === "GET") {
      const tag = url.searchParams.get("tag") || "";
      if (!tag) return reply({ error: "tag_required" }, 400);

      const runsRes = await fetch(
        `${GH_API}/repos/${repo}/actions/workflows/${encodeURIComponent(
          workflow,
        )}/runs?event=workflow_dispatch&per_page=30`,
        { headers: ghHeaders(env.GH_TOKEN) },
      );
      if (!runsRes.ok) return reply({ error: "runs_failed", status: runsRes.status }, 502);
      const runs = (await runsRes.json()) as { workflow_runs?: GhRun[] };
      const run = (runs.workflow_runs || []).find(
        (r) => (r.display_title || "").includes(tag) || (r.name || "").includes(tag),
      );
      // прогон ещё не появился в индексе GitHub — это нормально первые секунды
      if (!run) return reply({ found: false, status: "queued" });

      const out: Record<string, unknown> = {
        found: true,
        runId: run.id,
        status: run.status,
        conclusion: run.conclusion,
        htmlUrl: run.html_url,
      };

      if (run.status === "completed" && run.conclusion === "success") {
        const artRes = await fetch(`${GH_API}/repos/${repo}/actions/runs/${run.id}/artifacts`, {
          headers: ghHeaders(env.GH_TOKEN),
        });
        if (artRes.ok) {
          const arts = (await artRes.json()) as { artifacts?: GhArtifact[] };
          const art =
            (arts.artifacts || []).find((a) => a.name === "iskcon-audio") ||
            (arts.artifacts || [])[0];
          if (art) {
            out.artifactId = art.id;
            out.artifactName = art.name;
            out.sizeBytes = art.size_in_bytes;
          }
        }
      }
      return reply(out);
    }

    // ── короткоживущая ссылка на скачивание .zip ──
    if (sub === "artifact" && request.method === "GET") {
      const id = url.searchParams.get("id") || "";
      if (!id) return reply({ error: "id_required" }, 400);
      const res = await fetch(
        `${GH_API}/repos/${repo}/actions/artifacts/${encodeURIComponent(id)}/zip`,
        { headers: ghHeaders(env.GH_TOKEN), redirect: "manual" },
      );
      const loc = res.headers.get("location");
      if (!loc) return reply({ error: "no_download_url", status: res.status }, 502);
      return reply({ url: loc });
    }

    return reply({ error: "not_found" }, 404);
  } catch (e) {
    return reply({ error: "internal", detail: (e as Error).message }, 500);
  }
}

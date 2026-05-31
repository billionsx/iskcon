interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  DB: D1Database;
}

const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "X-Robots-Tag": NOINDEX,
      "Cache-Control": "public, max-age=300",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── Library API (served from D1; structure + deep-links only) ──
    // GET /api/books/bg/chapters → 18 chapters with verse counts + source_url
    if (url.pathname === "/api/books/bg/chapters") {
      const { results } = await env.DB.prepare(
        `SELECT d.id, d.number,
                json_extract(d.title,'$.ru') AS title_ru,
                json_extract(d.title,'$.en') AS title_en,
                d.source_url,
                COUNT(v.id) AS verses
         FROM divisions d
         LEFT JOIN verses v ON v.division_id = d.id
         WHERE d.work_id = 'bg'
         GROUP BY d.id
         ORDER BY CAST(d.number AS INTEGER)`
      ).all();
      return json({ work: "bg", chapters: results });
    }

    // GET /api/books/bg/chapters/:n/verses → verse refs + source_url for a chapter
    const m = url.pathname.match(/^\/api\/books\/bg\/chapters\/(\d+)\/verses$/);
    if (m) {
      const divId = `bg.${m[1]}`;
      const { results } = await env.DB.prepare(
        `SELECT ref, source_url, devanagari, translit
         FROM verses WHERE work_id='bg' AND division_id=?1
         ORDER BY ordinal`
      ).bind(divId).all();
      return json({ work: "bg", chapter: Number(m[1]), verses: results });
    }

    // Same-origin proxy to the API so the browser never makes a cross-origin call.
    if (url.pathname.startsWith("/api/")) {
      const target = "https://api.gaurangers.com/v1/" + url.pathname.slice(5) + url.search;
      const upstream = await fetch(target, {
        method: request.method,
        headers: { accept: "application/json" },
      });
      const out = new Response(upstream.body, upstream);
      out.headers.set("X-Robots-Tag", NOINDEX);
      out.headers.set("Cache-Control", "no-store");
      return out;
    }

    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set("X-Robots-Tag", NOINDEX);
    return out;
  },
};

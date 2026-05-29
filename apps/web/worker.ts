interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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

// Cloudflare Worker — API proxy
//
// Intercepts /api/<service>/... and proxies to the upstream API.
// All other requests fall through to static assets (SPA).

const UPSTREAMS = {
  yahoo: "https://query1.finance.yahoo.com",
  coingecko: "https://api.coingecko.com",
  finnhub: "https://finnhub.io",
  fred: "https://api.stlouisfed.org",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      // /api/yahoo/v8/finance/chart/GME → service="yahoo", rest="v8/finance/chart/GME"
      const segments = url.pathname.replace(/^\/api\//, "").split("/");
      const [service, ...rest] = segments;
      const upstream = UPSTREAMS[service];

      if (!upstream) {
        return new Response("Unknown API service", { status: 404 });
      }

      const upstreamUrl = `${upstream}/${rest.join("/")}${url.search}`;

      const headers = new Headers(request.headers);
      headers.delete("host");
      if (service === "yahoo") {
        headers.set("User-Agent", "Mozilla/5.0");
      }

      const proxyReq = new Request(upstreamUrl, {
        method: request.method,
        headers,
        body: request.method !== "GET" && request.method !== "HEAD"
          ? request.body
          : undefined,
      });

      try {
        const response = await fetch(proxyReq);
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Non-API requests: serve static assets (SPA fallback)
    return env.ASSETS.fetch(request);
  },
};

// Cloudflare Pages Function — API proxy
//
// Routes /api/<service>/... to the corresponding upstream, mirroring the
// dev-server proxy config in vite.config.js and the nginx rules in Dockerfile.
//
// Services: yahoo, coingecko, finnhub, fred

const UPSTREAMS = {
  yahoo:     "https://query1.finance.yahoo.com",
  coingecko: "https://api.coingecko.com",
  finnhub:   "https://finnhub.io",
  fred:      "https://api.stlouisfed.org",
};

export async function onRequest({ request, params }) {
  // params.path is an array of path segments after /api/
  // e.g. /api/yahoo/v8/finance/chart/AAPL → ["yahoo", "v8", "finance", "chart", "AAPL"]
  const [service, ...rest] = params.path ?? [];
  const upstream = UPSTREAMS[service];

  if (!upstream) {
    return new Response("Unknown API service", { status: 404 });
  }

  const url = new URL(request.url);
  const upstreamUrl = `${upstream}/${rest.join("/")}${url.search}`;

  const headers = new Headers(request.headers);
  // Yahoo Finance rejects requests without a browser-like User-Agent
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

  const response = await fetch(proxyReq);

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

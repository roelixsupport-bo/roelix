import { loadSitemapProducts } from "@/lib/seo-data";

const SITE_URL = "https://roelix.com";

const ROBOTS_CONTENT = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin",
  "Disallow: /cart",
  "Disallow: /checkout",
  "Disallow: /success",
  "Disallow: /auth",
  "Sitemap: https://roelix.com/sitemap.xml",
  "",
].join("\n");

const SITEMAP_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
};

function methodResponse(
  method: string,
  body: string,
  headers: Record<string, string>,
): Response {
  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
  }
  return new Response(method === "HEAD" ? null : body, { headers });
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function lastModified(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export function createRobotsResponse(method = "GET"): Response {
  return methodResponse(method, ROBOTS_CONTENT, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
}

export async function createSitemapResponse(method = "GET"): Promise<Response> {
  if (method !== "GET" && method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...SITEMAP_HEADERS, Allow: "GET, HEAD" } });
  }

  try {
    const products = await loadSitemapProducts();
    const urls = new Map<string, string | undefined>([[`${SITE_URL}/`, undefined]]);
    urls.set(`${SITE_URL}/shop`, undefined);

    for (const product of products) {
      const date = lastModified(product.updated_at);
      urls.set(`${SITE_URL}/product/${encodeURIComponent(product.id)}`, date);
      const category = `${SITE_URL}/shop?c=${encodeURIComponent(product.category)}`;
      const previousDate = urls.get(category);
      urls.set(category, date && (!previousDate || date > previousDate) ? date : previousDate);
    }

    const entries = [...urls]
      .map(
        ([url, modified]) =>
          `  <url><loc>${escapeXml(url)}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ""}</url>`,
      )
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
    return methodResponse(method, xml, SITEMAP_HEADERS);
  } catch (error) {
    console.error("ROELIX SEO: could not load sitemap products", error);
    const emptySitemap =
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" />\n';
    return new Response(method === "HEAD" ? null : emptySitemap, {
      status: 503,
      headers: SITEMAP_HEADERS,
    });
  }
}

export function handleSeoRequest(request: Request): Promise<Response> | Response | null {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/robots.txt") return createRobotsResponse(request.method);
  if (pathname === "/sitemap.xml") return createSitemapResponse(request.method);
  return null;
}
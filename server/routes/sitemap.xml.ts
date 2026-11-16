import { createSitemapResponse } from "../../src/lib/seo-responses";

export default async function sitemapRoute(event: { method?: string }) {
  return createSitemapResponse(event.method ?? "GET");
}
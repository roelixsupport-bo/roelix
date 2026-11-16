import { createFileRoute } from "@tanstack/react-router";
import { createSitemapResponse } from "@/lib/seo-responses";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        return createSitemapResponse();
      },
      HEAD: () => createSitemapResponse("HEAD"),
    },
  },
});
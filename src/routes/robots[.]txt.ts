import { createFileRoute } from "@tanstack/react-router";
import { createRobotsResponse } from "@/lib/seo-responses";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        createRobotsResponse(),
      HEAD: () => createRobotsResponse("HEAD"),
    },
  },
});
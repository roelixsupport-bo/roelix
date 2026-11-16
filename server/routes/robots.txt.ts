import { createRobotsResponse } from "../../src/lib/seo-responses";

export default function robotsRoute(event: { method?: string }) {
  return createRobotsResponse(event.method ?? "GET");
}
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // The app ships as an SPA, so a route's code and loader only start loading
    // after the click. Preloading on hover/focus (intent) means a product link
    // is already resolved by the time the visitor presses it, while a direct
    // cold load still gets the shell skeleton first.
    defaultPreload: "intent",
    defaultPreloadDelay: 60,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

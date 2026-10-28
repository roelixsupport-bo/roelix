import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { StoreProvider } from "@/lib/store";
import { RouteSkeleton } from "@/components/site/route-skeleton";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { CartDrawer } from "@/components/site/cartdrawer";
import { Concierge } from "@/components/site/concierge";
import { Toaster } from "@/components/ui/sonner";
import { initMetaPixel } from "@/utils/metaPixel";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // viewport-fit=cover lets env(safe-area-inset-*) work on notched phones.
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "ROELIX — Luxury Bedding & Hotel Linens" },
      {
        name: "description",
        content: "Ultra-luxury Egyptian cotton bedding, hotel-grade linens and home textiles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg?v=3", type: "image/svg+xml" },
      { rel: "alternate icon", href: "/favicon.png?v=3", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png?v=3" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {/*
          The shell above is rendered left-to-right on the server. A visitor who
          already chose Arabic would otherwise see the whole page flip direction
          once the store hydrates, so the saved language is applied before the
          first paint. It only handles "ar": the shell default is already "en".
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(JSON.parse(localStorage.getItem("roelix_language"))==="ar"){document.documentElement.lang="ar";document.documentElement.dir="rtl"}}catch(e){}',
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // The prerendered shell carries no route match in SPA mode, so it paints with
  // a skeleton and the real route mounts on the first client commit. Flipping in
  // an effect (never during render) keeps server and client markup identical, so
  // hydration cannot mismatch.
  const [routerReady, setRouterReady] = useState(false);

  useEffect(() => {
    setRouterReady(true);
  }, []);

  useEffect(() => {
    // Meta Pixel is third-party and competes with the hero image for bandwidth
    // and the main thread. It is a pageview tag, not page content, so it waits
    // for idle time instead of delaying the first paint.
    if (typeof window === "undefined") return;

    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(() => initMetaPixel(), { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(() => initMetaPixel(), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <Header />
        <main className="min-h-[60vh]">{routerReady ? <Outlet /> : <RouteSkeleton />}</main>
        <Footer />
        <CartDrawer />
        <Concierge />
        <Toaster />
      </StoreProvider>
    </QueryClientProvider>
  );
}

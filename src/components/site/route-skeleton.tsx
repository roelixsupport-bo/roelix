/**
 * Content shown inside <main> until the client router has hydrated.
 *
 * The app ships in TanStack Start's SPA mode, so the prerendered HTML carries
 * the header and footer but an empty <main>: on a cold load the visitor stares
 * at a blank column until the route chunk arrives, and the largest paint is
 * whatever happens to render after hydration.
 *
 * Rendering this in the shell keeps something visible from the first paint and
 * reserves the two-column product height, so the swap to real content does not
 * shift the page. It is intentionally generic: it is used for every route.
 */
export function RouteSkeleton({ label = "Loading the ROELIX collection" }: { label?: string }) {
  return (
    <div
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">{label}</p>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
          <div className="hidden shrink-0 flex-col gap-2 sm:flex">
            <div className="h-24 w-20 animate-pulse bg-muted" />
            <div className="h-24 w-20 animate-pulse bg-muted" />
          </div>
          <div className="aspect-[4/5] w-full animate-pulse bg-muted" />
        </div>
        <div className="space-y-4">
          <div className="h-3 w-24 animate-pulse bg-muted" />
          <div className="h-10 w-4/5 animate-pulse bg-muted" />
          <div className="h-8 w-40 animate-pulse bg-muted" />
          <div className="h-4 w-full animate-pulse bg-muted" />
          <div className="h-4 w-2/3 animate-pulse bg-muted" />
          <div className="h-24 w-full animate-pulse bg-muted" />
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { healStaleSession, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // A stale token would otherwise pass this gate and then fail every dashboard
    // query with an RLS-shaped error the admin cannot act on.
    await healStaleSession();

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: location.pathname } });
  },
  component: () => <Outlet />,
});

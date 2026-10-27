import { createFileRoute, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Workspace · voee360tour" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Outlet,
});

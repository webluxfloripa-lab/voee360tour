import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "../components/Dashboard";
export const Route = createFileRoute("/admin/historico")({
  component: () => <Dashboard section="history" />,
});

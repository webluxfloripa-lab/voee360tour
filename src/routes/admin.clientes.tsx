import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "../components/Dashboard";
export const Route = createFileRoute("/admin/clientes")({
  component: () => <Dashboard section="clients" />,
});

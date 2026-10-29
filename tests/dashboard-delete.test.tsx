import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const state = vi.hoisted(() => ({ load: vi.fn(), remove: vi.fn(), sign: vi.fn() }));
vi.mock("../src/components/AuthGate", () => ({ AuthGate: ({ children }: { children: ReactNode }) => children }));
vi.mock("../src/components/AdminShell", () => ({ AdminShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children, to, params: _params, ...rest }: any) => <a href={to} {...rest}>{children}</a> }));
vi.mock("../src/lib/api", () => ({ getDashboard: state.load, deleteProject: state.remove, signedAssets: state.sign, rpc: vi.fn() }));
vi.mock("../src/lib/duplicate", () => ({ duplicateProject: vi.fn() }));
import { Dashboard } from "../src/components/Dashboard";
const project = { id: "qa", client_id: "client", title: "Passeio QA", slug: "passeio-qa", status: "draft", updated_at: new Date().toISOString() };
const other = { ...project, id: "other", title: "Outro passeio", slug: "outro-passeio" };
const data = { clients: [{ id: "client", name: "Cliente QA" }], projects: [project, other], assets: [], versions: [] };
beforeEach(() => {
  vi.clearAllMocks();
  state.load.mockResolvedValue(data);
  state.sign.mockResolvedValue({});
  state.remove.mockResolvedValue(undefined);
});
afterEach(cleanup);
async function open() {
  render(<Dashboard section="projects" />);
  fireEvent.click(await screen.findByRole("button", { name: "Opções de Passeio QA" }));
  fireEvent.click(screen.getByRole("button", { name: "Excluir passeio virtual" }));
  return screen.getByRole("dialog", { name: "Excluir passeio virtual?" });
}
it("requires exact confirmation and cancelling never sends a deletion request", async () => {
  const dialog = await open();
  expect(within(dialog).getByRole("button", { name: "Excluir definitivamente" })).toBeDisabled();
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "wrong" } });
  expect(within(dialog).getByRole("button", { name: "Excluir definitivamente" })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  expect(state.remove).not.toHaveBeenCalled();
});
it("removes only the selected tour after server success", async () => {
  const dialog = await open();
  state.load.mockResolvedValue({ ...data, projects: [other] });
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "passeio-qa" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Excluir definitivamente" }));
  await waitFor(() => expect(state.remove).toHaveBeenCalledWith("qa", "passeio-qa"));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Passeio QA" })).not.toBeInTheDocument());
  expect(screen.getByRole("heading", { name: "Outro passeio" })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("excluídos definitivamente");
});
it("keeps a failed deletion visible for retry and never claims success", async () => {
  const dialog = await open();
  state.remove.mockRejectedValue(new Error("A exclusão dos arquivos não terminou."));
  state.load.mockResolvedValue({ ...data, projects: [{ ...project, status: "archived", deletion_pending: true }, other] });
  fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "passeio-qa" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Excluir definitivamente" }));
  await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("não terminou"));
  expect(screen.queryByText("Passeio virtual, arquivos e registros excluídos definitivamente.")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  fireEvent.click(screen.getByRole("button", { name: "Opções de Passeio QA" }));
  expect(screen.getByRole("button", { name: "Concluir exclusão" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Reabrir rascunho" })).toBeDisabled();
});

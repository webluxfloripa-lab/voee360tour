import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mock = vi.hoisted(() => ({
  load: vi.fn(),
  rpc: vi.fn(),
  signedAssets: vi.fn(),
}));
vi.mock("../src/components/AuthGate", () => ({
  AuthGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../src/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params: _params, ...rest }: any) => <a href={to} {...rest}>{children}</a>,
}));
vi.mock("../src/lib/api", () => ({
  getDashboard: mock.load,
  signedAssets: mock.signedAssets,
  rpc: mock.rpc,
  deleteProject: vi.fn(),
}));
vi.mock("../src/lib/duplicate", () => ({ duplicateProject: vi.fn() }));

import { Dashboard } from "../src/components/Dashboard";

const existing = { id: "existing", name: "Cliente existente", slug: "cliente-existente", active: true };
const newClient = { id: "new-client", name: "Nostro Fumo", slug: "nostro-fumo", active: true };
const initialData = { clients: [existing], projects: [], assets: [], versions: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mock.load.mockResolvedValue(initialData);
  mock.rpc.mockResolvedValue(null);
  mock.signedAssets.mockResolvedValue({});
});
afterEach(cleanup);

async function openProject() {
  render(<Dashboard section="projects" />);
  fireEvent.click(await screen.findByRole("button", { name: "Novo projeto" }));
  return screen.getByRole("dialog", { name: "Criar uma nova experiência" });
}

it("creates client inline, selects it and preserves tour fields", async () => {
  mock.load.mockResolvedValueOnce(initialData).mockResolvedValue({
    ...initialData, clients: [existing, newClient],
  });
  const dialog = await openProject();
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Título do tour" }), {
    target: { value: "Tour Nostro Fumo" },
  });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Endereço" }), {
    target: { value: "tour-nostro-fumo" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Adicionar novo cliente" }));
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Nome do novo cliente" }), {
    target: { value: "Nostro Fumo" },
  });
  expect(within(dialog).getByRole("textbox", { name: "Identificador do novo cliente" }))
    .toHaveValue("nostro-fumo");
  fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar e selecionar" }));
  await waitFor(() =>
    expect(within(dialog).getByRole("combobox", { name: "Cliente" })).toHaveValue("new-client"),
  );
  expect(within(dialog).getByRole("textbox", { name: "Título do tour" }))
    .toHaveValue("Tour Nostro Fumo");
  expect(within(dialog).getByRole("textbox", { name: "Endereço" }))
    .toHaveValue("tour-nostro-fumo");
  expect(mock.rpc).toHaveBeenCalledWith("manage_client", {
    p_data: {
      name: "Nostro Fumo", slug: "nostro-fumo", email: "",
      contact: "", active: true, logo_asset_id: null,
    },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
  await waitFor(() =>
    expect(mock.rpc).toHaveBeenCalledWith("manage_project", {
      p_data: { client_id: "new-client", title: "Tour Nostro Fumo", slug: "tour-nostro-fumo" },
    }),
  );
});

it("keeps inline form and tour draft when client creation fails", async () => {
  mock.rpc.mockRejectedValueOnce(new Error("Identificador já utilizado"));
  const dialog = await openProject();
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Título do tour" }), {
    target: { value: "Tour em andamento" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Adicionar novo cliente" }));
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Nome do novo cliente" }), {
    target: { value: "Nostro Fumo" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar e selecionar" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Identificador já utilizado");
  expect(within(dialog).getByRole("textbox", { name: "Título do tour" }))
    .toHaveValue("Tour em andamento");
  expect(within(dialog).getByRole("button", { name: "Cadastrar e selecionar" })).toBeEnabled();
});

it("rejects invalid client identifiers without saving", async () => {
  const dialog = await openProject();
  fireEvent.click(within(dialog).getByRole("button", { name: "Adicionar novo cliente" }));
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Nome do novo cliente" }), {
    target: { value: "Nostro Fumo" },
  });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Identificador do novo cliente" }), {
    target: { value: "Nostro Fumo" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar e selecionar" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("letras minúsculas");
  expect(mock.rpc).not.toHaveBeenCalled();
});

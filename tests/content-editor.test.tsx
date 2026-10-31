import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ContentEditor from "../src/components/ContentEditor";
import { emptySnapshot, snapshotSchema } from "../src/lib/model";
import { getPresentation, presentationSchema } from "../src/lib/presentation";
afterEach(cleanup);
it("edits visible text by clicking the preview, resizes the logo and applies a versioned snapshot", () => {
  const apply = vi.fn();
  render(
    <ContentEditor
      snapshot={emptySnapshot("Meu tour")}
      urls={{}}
      onApply={apply}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "UMA EXPERIÊNCIA EM 360°" }),
  );
  fireEvent.change(screen.getByLabelText("Conteúdo do texto"), {
    target: { value: "Conheça nosso espaço" },
  });
  expect(
    screen.getByRole("button", { name: "Conheça nosso espaço" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Largura da logomarca"), {
    target: { value: "120" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar ao rascunho" }));
  const saved = apply.mock.calls[0]![0];
  expect(snapshotSchema.parse(saved).presentation?.copy.subtitle).toBe(
    "Conheça nosso espaço",
  );
  expect(saved.presentation.layout.logoWidth).toBe(120);
  expect(saved.scenes).toEqual([]);
});
it("adds, duplicates, hides and deletes content sections without touching the tour's scenes", () => {
  const apply = vi.fn();
  render(
    <ContentEditor
      snapshot={emptySnapshot("Tour")}
      urls={{}}
      onApply={apply}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Adicionar seção de conteúdo" }),
  );
  fireEvent.change(screen.getByLabelText("Conteúdo do texto"), {
    target: { value: "Nossa história" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Duplicar seção 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Ocultar seção 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Excluir seção 2" }));
  fireEvent.click(screen.getByRole("button", { name: "Aplicar ao rascunho" }));
  expect(apply.mock.calls[0]![0].presentation.blocks).toMatchObject([
    { title: "Nossa história", visible: false },
  ]);
  expect(apply.mock.calls[0]![0].presentation.blocks).toHaveLength(1);
});
it("blocks an invalid title and unsafe call-to-action URLs, and supports legacy tours", () => {
  expect(getPresentation(emptySnapshot("Legado")).copy.menu).toBe("Ambientes");
  const p = presentationSchema.parse({});
  p.blocks = [
    {
      id: crypto.randomUUID(),
      title: "Teste",
      body: "Texto",
      cta: "Abrir",
      url: "javascript:alert(1)",
      visible: true,
      align: "center",
      titleSize: 30,
      bodySize: 16,
    },
  ];
  expect(presentationSchema.safeParse(p).success).toBe(false);
  const apply = vi.fn();
  render(
    <ContentEditor
      snapshot={emptySnapshot("Tour")}
      urls={{}}
      onApply={apply}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Conteúdo do texto"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar ao rascunho" }));
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Informe um título");
});
it("rejects a title made only of spaces instead of applying an empty heading", () => {
  const apply = vi.fn();
  render(<ContentEditor snapshot={emptySnapshot("Tour")} urls={{}} onApply={apply} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Conteúdo do texto"), {
    target: { value: "   " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar ao rascunho" }));
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Informe um título");
});

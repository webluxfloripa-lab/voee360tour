import { z } from "zod";
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const copyLabels = {
  subtitle: "Subtítulo do cabeçalho",
  credit: "Marca no cabeçalho",
  eyebrow: "Chamada da apresentação",
  introTitle: "Título da apresentação",
  descriptionFallback: "Descrição padrão",
  footer: "Texto do rodapé",
  footerBrand: "Marca no rodapé",
  sceneLabel: "Indicação do ambiente",
  menu: "Botão de ambientes",
  menuTitle: "Título do menu",
  search: "Busca de ambientes",
  loading: "Mensagem de carregamento",
  error: "Mensagem de erro",
  retry: "Botão de tentar novamente",
  pause: "Pausar movimento",
  play: "Iniciar movimento",
  back: "Voltar ao ponto anterior",
  home: "Voltar ao início",
  zoomOut: "Diminuir zoom",
  zoomIn: "Aumentar zoom",
  fullscreen: "Tela cheia",
  next: "Próximo ambiente",
  closeMenu: "Fechar ambientes",
} as const;
export const presentationSchema = z.object({
  copy: z
    .object({
      subtitle: z.string().max(240).default("UMA EXPERIÊNCIA EM 360°"),
      credit: z.string().max(100).default("voee360tour"),
      eyebrow: z.string().max(240).default("ENTRE. EXPLORE. DESCUBRA."),
      introTitle: z
        .string()
        .max(300)
        .default("Uma nova perspectiva de {tour}."),
      descriptionFallback: z
        .string()
        .max(1000)
        .default(
          "Arraste para olhar ao redor. Toque nas setas para descobrir cada ambiente.",
        ),
      footer: z.string().max(300).default("Experiência criada com"),
      footerBrand: z.string().max(100).default("voee360tour"),
      sceneLabel: z.string().max(100).default("VOCÊ ESTÁ EM"),
      menu: z.string().min(1).max(100).default("Ambientes"),
      menuTitle: z.string().max(200).default("Explore os ambientes"),
      search: z.string().max(100).default("Buscar ambiente…"),
      loading: z.string().max(160).default("Carregando ambiente…"),
      error: z.string().max(200).default("Não foi possível abrir o panorama."),
      retry: z.string().min(1).max(100).default("Tentar novamente"),
      pause: z.string().min(1).max(100).default("Pausar movimento automático"),
      play: z.string().min(1).max(100).default("Iniciar movimento automático"),
      back: z.string().min(1).max(100).default("Voltar ao ponto anterior"),
      home: z.string().min(1).max(100).default("Voltar ao início"),
      zoomOut: z.string().min(1).max(100).default("Diminuir zoom"),
      zoomIn: z.string().min(1).max(100).default("Aumentar zoom"),
      fullscreen: z.string().min(1).max(100).default("Tela cheia"),
      next: z.string().min(1).max(100).default("Próximo ambiente"),
      closeMenu: z.string().min(1).max(100).default("Fechar ambientes"),
    })
    .prefault({}),
  layout: z
    .object({
      background: color.default("#121921"),
      text: color.default("#c6d0da"),
      heading: color.default("#d8e4cf"),
      muted: color.default("#89968b"),
      subtitleSize: z.number().min(8).max(24).default(9),
      eyebrowSize: z.number().min(8).max(24).default(9),
      footerSize: z.number().min(9).max(24).default(11),
      viewerTextSize: z.number().min(10).max(24).default(12),
      buttonSize: z.number().min(32).max(64).default(36),
      titleSize: z.number().min(16).max(60).default(19),
      headingSize: z.number().min(18).max(72).default(30),
      bodySize: z.number().min(12).max(28).default(14),
      logoWidth: z.number().min(32).max(240).default(48),
      viewerHeight: z.number().min(40).max(100).default(76),
      contentWidth: z.number().min(320).max(1600).default(800),
      spacing: z.number().min(16).max(120).default(50),
      align: z.enum(["left", "center", "right"]).default("center"),
      header: z.boolean().default(true),
      description: z.boolean().default(true),
      footer: z.boolean().default(true),
      showLogo: z.boolean().default(true),
      showCredit: z.boolean().default(true),
      order: z
        .array(z.enum(["tour", "description", "blocks"]))
        .length(3)
        .refine(
          (v) => new Set(v).size === 3,
          "Cada seção deve aparecer uma vez.",
        )
        .default(["tour", "description", "blocks"]),
    })
    .prefault({}),
  blocks: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string().max(300),
        body: z.string().max(4000),
        cta: z.string().max(120).default(""),
        url: z.union([z.literal(""), z.url().regex(/^https:\/\//)]).default(""),
        visible: z.boolean().default(true),
        align: z.enum(["left", "center", "right"]).default("center"),
        titleSize: z.number().min(18).max(72).default(30),
        bodySize: z.number().min(12).max(28).default(16),
      }),
    )
    .max(30)
    .default([]),
});
export type Presentation = z.infer<typeof presentationSchema>;
export type CopyKey = keyof Presentation["copy"];
export function getPresentation(snapshot: { presentation?: Presentation }) {
  return snapshot.presentation ?? presentationSchema.parse({});
}
export function moveItem<T>(items: T[], index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

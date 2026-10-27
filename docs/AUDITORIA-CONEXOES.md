# Auditoria e conexão guiada entre ambientes

Implementação na plataforma existente, em branch `feat/guided-connections`, a partir do remoto `9130c94237761822359ee9e6fb02b1ed46d64299`. As atualizações anteriores de histórico, imagem OG estável e auditoria mobile foram preservadas.

## Comportamento entregue

1. Ative Adicionar seta e dê um toque curto no ponto da passagem.
2. O painel Conectar ambiente mostra origem, seletor de destino e miniatura. O próprio ambiente não é uma opção de destino.
3. Cancelar antes da confirmação não altera o snapshot. Confirmar destino cria só a ida, com retorno pendente.
4. Continuar e posicionar volta abre o panorama de destino. Arrastar gira a câmera e não cria setas.
5. Toque na passagem da volta. Corrija a posição se necessário e escolha Concluir conexão.
6. Ida e volta têm IDs independentes e um pairId compartilhado. Propriedades e posições de cada lado são independentes.
7. Salvar rascunho usa a RPC existente com revisão otimista. Não há publicação automática.
8. É possível conectar outro ambiente, permanecer no destino, voltar à origem e testar a navegação do par.

No desktop o painel ocupa a lateral do editor. Em celulares ele é um bottom sheet de até 46% da altura da tela, com rolagem interna e controle de recolher/expandir. Os botões de ação principais têm pelo menos 44px.

O painel Conexões entre ambientes distingue pares completos, setas ocultas, retornos pendentes e destinos inválidos. Permite abrir a ida/volta, destacar a seta, retomar o retorno, testar ou remover a conexão. A auditoria apresenta ambientes isolados, conexões completas, retornos pendentes, duplicações e pareamentos inconsistentes. Conexões recíprocas legadas são reconhecidas sem reescrever coordenadas. Voltas ambíguas ou pertencentes a outro par não são duplicadas automaticamente.

## Correções da auditoria técnica

- Um gesto de arrastar o panorama podia terminar em click e disparar posicionamento. Agora movimentos maiores que 7px e gestos cancelados não posicionam setas.
- A navegação dentro do editor passava para Explorar após trocar de cena. Agora mantém o modo Navegar.
- O enquadramento atual podia carregar valores do ambiente anterior antes da primeira interação. Agora é informado ao terminar o carregamento do panorama.
- A indicação Ida/volta não usa apenas a presença de pairId: verifica a seta correspondente.
- A tela de erro do visualizador agora se limpa ao carregar uma nova cena corretamente.
- Endereços malformados de tour e iframe retornavam 500. Agora retornam 404 antes de consultar o provedor.
- Histórico e backup agora paginam todas as versões, sem depender do limite padrão de 1.000 linhas.
- Links de Storage são assinados em lotes de 100. A leitura pública de arquivos também usa paginação, evitando URLs gigantes com listas de IDs.
- O workflow de qualidade cobre branches feat/** e mantém as verificações de build, TypeScript, lint, unidades e navegador.

## Evidências executadas

| Camada                    | Resultado                     | Limite da evidência                                                                                                                                                                          |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build Vite/TanStack/Nitro | Passou                        | Os avisos de diretivas do bundler em dependências não são erros de build                                                                                                                     |
| TypeScript e ESLint       | Passaram                      | Sem erros ou warnings do ESLint                                                                                                                                                              |
| Vitest                    | 24 testes passaram            | Inclui conexões legadas, duplicação, posição independente, segurança do par, 1.101 versões e 205 arquivos                                                                                    |
| Playwright                | 18 testes passaram            | Chromium desktop 1440×1000 e Android emulado com toque 360×800; não é teste em aparelho físico                                                                                               |
| PostgreSQL local          | 17 verificações passaram      | Histórico, publicação, restauração e autorização com migrações reais em PGlite                                                                                                               |
| Supabase real             | 3 cenários passaram           | Cliente/projeto de QA criados em transação isolada; ida pendente, par persistido, leitura posterior, edição independente, conflito otimista e nenhuma publicação. Rollback integral ao final |
| Dependências de produção  | 0 vulnerabilidades reportadas | Resultado de npm audit --omit=dev no momento da execução                                                                                                                                     |

O navegador usa um projeto de homologação em memória e intercepta as requisições ao provedor, com fotografias reais de teste e Pannellum/WebGL reais. A persistência e a autorização são verificadas separadamente no Supabase. Isso não equivale a um login real da titular pelo navegador. Nenhuma senha foi solicitada no chat nem incluída nos testes.

Os testes de interface cobrem cancelamento, escolha de destino, abertura do panorama B, giro sem posicionamento acidental, marcação/correção da volta, conclusão, salvamento, refresh, edição de apenas um lado, desfazer/refazer, navegação real pelas setas, retorno pendente após refresh, reabertura sem duplicar, auditoria e regressão de publicação/restauração com fixtures. O fluxo guiado não publica o projeto de QA.

## Preservação

Antes da implantação: Seven com 22 ambientes, 50 setas, 44 arquivos e 1 versão; Nostro Fumo com 8 ambientes, 1 seta, 16 arquivos e nenhuma versão. Os dois projetos permanecem privados em rascunho. Nenhum objeto registrado está ausente no Storage e nenhuma tabela pública está sem RLS.

O release não contém migração de banco, alteração de credenciais ou instrução de publicação de tours. A conferência posterior compara revisões e hashes dos rascunhos e versões. O estado anterior do código permanece no Git e o deployment anterior pode ser utilizado para reversão.

## Limitações e pendências explícitas

- A direção física de portas e passagens depende do posicionamento visual humano; o sistema não a inventa.
- Android físico e a sessão real da titular ainda exigem homologação no dispositivo.
- WhatsApp externo e iframe de um cliente publicado não são liberados como teste: os clientes continuam privados. URLs desses rascunhos devem responder 404.
- O advisor Supabase ainda aponta proteção contra senhas vazadas desabilitada. Não foram alteradas configurações de Auth ou plano nesta implementação. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- A conta Vercel segue no plano Hobby. Não foi contratado plano pago nem liberado uso comercial de tours de clientes; a publicação da aplicação não torna esse plano adequado a clientes comerciais.

Os IDs de commits, resultado do preview, checks do GitHub e implantação de produção ficam registrados no PR e no histórico de deployments do provedor.

# Auditoria e correções — voee360tour

Data: 30/10/2026 (America/Sao_Paulo). Base: `deaa780`.

## Resultado publicado

Aplicação: https://voee360tour.webluxfloripa-lab.workers.dev/

Deployment Cloudflare: `92f9096dd94c47cfa92757935a58d02f`.
SHA-256 do Worker compilado e conferido após publicação:
`d7ffa42ac0ecdf919a17f52782996c72aec453ebf46ca041e9ff9539fbb132a4`.

## Erros encontrados e corrigidos

| Problema | Correção |
| --- | --- |
| A API anônima permitia consultar clientes, rascunhos, históricos e arquivos não publicados, apesar da interface administrativa protegida. | Removidas as permissões temporárias irrestritas. Mantidos os tours publicados e suas mídias. Migração aplicada e conferida no Supabase real: zero permissões públicas nas oito tabelas internas e zero políticas temporárias irrestritas. |
| Renovação de URLs de um tour antigo podia substituir as imagens de uma publicação nova. | A resposta atrasada é descartada quando o conjunto de mídia muda. |
| Logotipos e imagens fora do panorama podiam expirar em abas abertas por muito tempo. | Renovação das URLs após 45 minutos, preservando o ambiente selecionado. |
| Uma publicação retirada continuava visível em abas e embeds abertos. | Consulta periódica remove o visualizador e informa indisponibilidade; republicações voltam a aparecer. |
| Duplicar títulos e identificadores próximos do limite gerava valores inválidos. | Reserva de espaço para os sufixos de cópia. |
| Importação aceitava logotipo ou imagem social de outro projeto. | Verificação de todas as referências de mídia antes de substituir o rascunho local. |
| Nomes longos de fotografias podiam impedir o salvamento. | Normalização e limite de 120 caracteres para nomes de ambientes. |
| Títulos em branco e identificadores repetidos de seções eram aceitos. | Validação antes de salvar ou importar. |
| Comandos de desenvolvimento e caminhos de imagens de teste falhavam no Windows. | Inicialização portável dos comandos e uso de caminhos de arquivo adequados. |

## Validação

- TypeScript e ESLint passaram.
- 57 testes automatizados em 14 arquivos passaram.
- Suite de banco passou: publicação, restauração, conflito de revisão, permissões, mídias e exclusão completa em dados descartáveis locais.
- 26 cenários de navegador passaram em celular e desktop: entrada, rotas protegidas, criação, upload, conexões, conteúdo, salvar/publicar/restaurar e confirmação de exclusão. O encerramento automático do servidor de testes ficou pendente neste ambiente Windows restrito e foi interrompido após os cenários; não se declara código de saída zero do comando completo.
- Build Cloudflare e verificação de sintaxe do Worker passaram.
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas nas dependências de produção consultadas.
- Pacote publicado conferido por SHA-256. Painel, editor de conteúdo, panorama e navegação pública conferidos no navegador real.
- Um tour publicado e uma conta administrativa preservados no banco.

## Limites e configuração restante

- A recomendação do Supabase de ativar proteção contra senhas comprometidas continua pendente. O conector disponível não oferece a alteração dessa configuração. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- O aviso de RLS sem política em `private.project_deletion_jobs` corresponde à tabela privada usada pelo serviço de exclusão; não foi aberto acesso público a ela.
- Links de mídia assinados antes da mudança de permissão continuam válidos até sua expiração, de até uma hora. Novas consultas seguem as permissões corrigidas.
- Exclusão real e envio de e-mails de autenticação não foram usados para testar produção. Esses fluxos foram cobertos com dados e serviços simulados ou banco local.

Esta entrega cobre o código atual, os fluxos descritos e as permissões consultadas na sessão.

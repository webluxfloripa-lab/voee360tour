# Operação e continuidade

## Estado inicial

Seven Sports Bar: 22 ambientes, 50 setas, 25 pares; 22 panoramas e 22 miniaturas recuperados e armazenados independentemente. Rascunho, sem publicação. O snapshot exportado não é prova de equivalência com eventuais alterações posteriores no Seven publicado.

Nostro Fumo: cadastro e projeto vazio. Nenhuma fotografia ou identidade do Seven foi reutilizada para esse cliente.

Um checkpoint preserva o Seven antes da recuperação das mídias. Não pode ser publicado/restaurado como tour completo enquanto suas referências nulas não forem corrigidas. O JSON original está preservado nas fixtures e na tabela privada de importação.

## Recuperação e backup

Use **Backup ZIP** antes de grandes alterações. Ele inclui `project.json` com rascunho, versões e inventário, mais os bytes em `media/projects/...`. Use **Exportar** para obter apenas o JSON editável do rascunho.

Para restaurar conteúdo: Histórico → Prévia → Restaurar rascunho → conferir → Publicar. Atualize a página para confirmar persistência. Se outra aba tiver salvo, exporte seu trabalho e recarregue para resolver o conflito, sem sobrescrever silenciosamente.

Rollback de deployment na Vercel é diferente de restauração de conteúdo. Não reverta migrations destrutivamente em um banco com dados. Antes de uma mudança de schema, faça backup e prefira uma migration compensatória.

## Fotos e licenças

O pacote de entrega inclui backup das 44 imagens reais recuperadas do domínio original autorizado. O script de importação restringiu os paths ao inventário, comparou tamanho e SHA-256 e gravou em bucket privado próprio. O runtime não consulta o domínio de origem.

Pannellum está em `public/vendor`; sua licença MIT foi preservada em `LICENSE-pannellum.txt`. A autorização para reaproveitamento do código Seven foi fornecida pela titular nesta missão. Outras dependências mantêm suas licenças de distribuição; não atribuímos licença aberta ao código proprietário da plataforma.

## Segurança e contas

O e-mail administrador é o informado pela titular. Nenhuma senha recebida no chat foi utilizada ou gravada no projeto. A senha é definida no fluxo do Supabase. Não envie tokens de convite ou recuperação para o chat.

O projeto usa chave publicável no frontend, com RLS. Não coloque service*role em variáveis VITE*. Não habilite associação pública a profiles. O painel dos clientes não existe nesta versão.

O advisor de segurança do Supabase não encontrou problemas de RLS, mas sinalizou **Leaked Password Protection Disabled** após a ativação do Auth. A habilitação deve ser conferida no dashboard e no plano contratado; não foi feito upgrade ou pagamento.

Os redirecionamentos de Auth ainda precisam ser ajustados no dashboard para o domínio final. O primeiro acesso oferece validação do endereço do convite diretamente no app como alternativa segura.

## Pendências externas

- Código enviado e verificado no GitHub privado `webluxfloripa-lab/voee360tour`. O projeto Vercel existente já foi conectado pela titular e o vínculo foi confirmado pela API; alterações em `main` disparam o fluxo de produção.
- A titular relatou redefinição de senha e acesso ao aplicativo. Homologar a operação real de tours nessa sessão; o agente não utilizou sua senha nem inspecionou a sessão.
- Homologação visual física de todas as setas do Seven e comparação com a configuração publicada mais recente, se diferente do snapshot exportado.
- Escolher plano de hospedagem comercial antes de abrir os tours a clientes pagantes. O domínio `voee360tour.vercel.app` está vinculado ao preview, sem promover tours de clientes para produção comercial.
- Validar prévia WhatsApp por um compartilhamento real quando houver publicação e domínio apropriados.
# Excluir definitivamente um passeio virtual

Em **Projetos e tours**, abra o menu de três pontos do passeio e escolha **Excluir passeio virtual**. Digite o identificador exibido e confirme **Excluir definitivamente**. A exclusão é irreversível e remove o projeto, fotos, ambientes, setas, rascunhos, publicações e versões; o cadastro do cliente permanece. Se o logo do cliente pertencer ao passeio excluído, somente essa referência é removida.

O servidor valida a sessão e o papel de superadministradora. A chave administrativa fica exclusivamente na Edge Function `delete-tour`. O passeio sai do acesso público antes da remoção dos arquivos pelo Storage API. A finalização no banco só ocorre após a confirmação de que não restam objetos do passeio. Não há exclusão direta de metadados de Storage por SQL em produção.

Se a conexão cair ou a remoção de arquivos falhar, o projeto fica arquivado com **Exclusão pendente**. Use **Concluir exclusão** no mesmo menu. Edição, reabertura e novos uploads ficam bloqueados durante esse processo. O banco conserva apenas um recibo de operação sem nome, identificador, conteúdo ou caminhos do passeio.

Verificações desta entrega: 37 testes de aplicação; 45 verificações locais de banco, incluindo autorização, mídia ainda presente, retomada, exclusão física de registros e preservação de outros projetos. Nenhum passeio real foi excluído para testar a função.

# Limites desta migração

- O aplicativo Base44 Varejarte Agenda está em uso pela equipe. O usuário proibiu
  alterar, excluir ou remover qualquer dado, código ou configuração da origem.
- Trate o Base44 original como somente leitura: consultar e exportar cópias é
  permitido; não executar funções, workflows, cadastros, testes de escrita,
  publicação, mudanças de domínio, permissões ou plano na origem.
- Todo desenvolvimento e teste com escrita deve usar exclusivamente a cópia local
  ou um projeto Supabase exclusivo do Varejarte. Não alterar Maestro ou Deskcomm.
- Troca do aplicativo em uso ou mudança de domínio exige autorização explícita.
- O destino Supabase deve permanecer no plano gratuito. Não contratar serviços,
  pagar faturas ou alterar cobrança sem instrução específica do usuário.
- Backups, credenciais e dados reais ficam em `.migration/`, ignorada pelo Git.
- Consulte `docs/MIGRATION.md` para o estado verificado e os impedimentos atuais.

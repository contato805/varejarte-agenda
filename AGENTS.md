# Limites desta migração

- O aplicativo Base44 Varejarte Agenda está em uso pela equipe. O usuário proibiu
  alterar, excluir ou remover qualquer dado, código ou configuração da origem.
- Trate o Base44 original como somente leitura: consultar e exportar cópias é
  permitido; não executar funções, workflows, cadastros, testes de escrita,
  publicação, mudanças de domínio, permissões ou plano na origem.
- Todo desenvolvimento e teste com escrita deve usar exclusivamente a cópia local
  ou um projeto Supabase exclusivo do Varejarte. Não alterar Maestro ou Deskcomm.
- O Varejarte deve ser independente e permitir entrega integral a terceiros:
  repositório, organização/projeto Supabase, hospedagem, domínio, armazenamento,
  e-mail e credenciais próprios. Não reutilizar bancos, autenticação, APIs,
  serviços, segredos, cobrança ou infraestrutura dos outros aplicativos.
- Não usar a sessão Supabase global existente nesta máquina para o Varejarte.
  Ela foi identificada como outra conta; a organização Varejarte criada nessa
  sessão está vazia e não é um destino aprovado para a infraestrutura definitiva.
  Aguardar a identidade exclusiva indicada pelo usuário e configurar um perfil
  de acesso próprio do projeto, sem alterar ou encerrar sessões de outros apps.
- Antes de qualquer operação remota, confirmar identidade, organização e projeto
  do Varejarte. A entrega a terceiros deve conceder acesso somente aos recursos
  deste projeto, sem compartilhar contas pessoais ou credenciais globais.
- Troca do aplicativo em uso ou mudança de domínio exige autorização explícita.
- O destino Supabase deve permanecer no plano gratuito. Não contratar serviços,
  pagar faturas ou alterar cobrança sem instrução específica do usuário.
- Backups, credenciais e dados reais ficam em `.migration/`, ignorada pelo Git.
- Consulte `docs/MIGRATION.md` para o estado verificado e os impedimentos atuais.

# Contratos e pendências do aplicativo

## Estado deste marco

O frontend deixou de importar o SDK e o plugin Vite do Base44. As chamadas das
telas passam por `src/api/client.js` e `agenda-client.js`, sem fallback para a
origem. Logos e fonte Inter são distribuídos pelo próprio projeto. Arquivos de
plataforma sem uso no produto foram preservados em `base44/recovered-platform/`,
fora do runtime; a fonte integral está na tag `base44-recovered-2026-11-13`.

O sistema ainda não está pronto para a equipe: o Supabase exclusivo não existe;
login real, funções administrativas, importação, rotinas, PDFs e jornadas no
navegador precisam ser concluídos e validados. A origem permanece intacta.

## Configuração e acesso

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_REF` e a chave pública são obrigatórios.
A URL hospedada deve corresponder à ref de 20 letras. Stack local isolada aceita
localhost/127.0.0.1 com ref `local-varejarte`. Chaves secretas/service-role são
recusadas. A propriedade do projeto deve ser confirmada na conta correta antes
de preencher essas variáveis; validação sintática não comprova titularidade.

Antes de enviar a senha, o adaptador exige a identificação `varejarte-agenda`,
protocolo 1, em `app_identity()`. Auth valida a senha; `current_actor()` determina
o papel pelo vínculo privado. Dados de papel no navegador e user_metadata não
autorizam acesso. Entrar no painel Supabase não cria uma conta no aplicativo;
o proprietário do produto ainda precisa ser provisionado.

Nomes de usuário são normalizados com NFKC, trim e minúsculas e convertidos em
um endereço técnico SHA-256 `@login.varejarte.invalid`; e-mails são usados
diretamente. A função de provisionamento deve compartilhar essa transformação.
Endereços técnicos não recebem recuperação por e-mail: o administrador precisará
redefinir senhas. Não importar/exibir senhas antigas; na edição, senha vazia
mantém a atual. O bootstrap de novas senhas/acessos está pendente.

Auth é conferido no servidor. Mudança de identidade/perfil limpa o cache;
respostas anteriores ao logout não restauram acesso. Supervisor e visualizador
montam somente a agenda, sem consultas de abas administrativas ocultas.

## Dados e operações preparadas

- Agenda, atividades e histórico usam tabelas com RLS. Colaboradores/clientes
  usam leitores RPC que enriquecem dados privados somente para administradores.
- Leituras exigem contagem exata e percorrem todas as páginas, mesmo com limite
  menor no servidor. Mudança de contagem, término prematuro ou repetição de IDs
  geram erro. Paginação por deslocamento não é snapshot transacional: alterações
  concorrentes com mesma contagem e sem IDs repetidos ainda podem escapar.
- Dashboard/relatórios não têm mais limite fixo de 2.000 registros. Falha de
  consulta oculta os totais e oferece recarregar.
- `save_client` grava cadastro, contatos e contrato em transação, normalizando
  quantidades, duração e aniversários. Atualização parcial preserva dados privados.
- `remove_client` faz remoção lógica do cadastro e das atividades não concluídas;
  mantém histórico concluído e backup. `remove_agenda_record` remove logicamente
  agendamentos/tipos de atividade. Nenhuma operação muda a origem Base44.
- O trigger de nome do cliente preserva sufixos de filial históricos, incluindo
  filiais já desativadas/removidas; não divide arbitrariamente nomes com hífens.
- `append_audit_log` atribui o autor no servidor; INSERT direto foi revogado.
  A descrição ainda vem da tela. Log e alteração continuam chamadas separadas,
  como na origem: não há garantia forense/transacional de todas as mudanças.
- `export_backup()` captura as cinco entidades em uma leitura SQL, incluindo
  removidos logicamente e dados privados administrativos, sem senhas/sessões.
  O download Markdown contém JSON estruturado. Restauração, CSVs e envio da
  rotina diária permanecem pendentes.

## Funções e rotinas pendentes

Os endpoints abaixo **ainda não foram implementados/publicados**. Não declarar
cadastro de colaboradores ou importação prontos com base no adaptador:

| Função | Entrada | Trabalho necessário |
| --- | --- | --- |
| `employee-access` | `{action: create/update/delete, id?, data?}` | Validar JWT/papel; gerenciar Auth, cadastro, salário privado e vínculo; inativar/remover logicamente; tratar falhas parciais entre Auth e banco, idempotência e recuperação. Nunca devolver senha. |
| `import-schedule` | Contrato do importador original | Validar administrador, formato e referências; preservar parser/critério da origem; importar atomicamente, relatar e impedir duplicação. |

Conclusão automática e backup diário ainda precisam de execução agendada e
serviços próprios. Sincronização de nomes está escrita em SQL e não aplicada
remotamente. Não reutilizar SMTP, destinatários ou infraestrutura de outros apps.

## Evidência e próximos gates

Passam 9 testes Python, 18 SQL e 21 do adaptador/sessão/interface. Os builders HTTP
do Supabase são reais com respostas locais simuladas. Componentes React provam
recusa de sessão legada, limpeza de cache, invalidação de resposta atrasada,
bloqueio de abas administrativas e ocultação de totais após erro. SQL roda em
PostgreSQL/WASM descartável. Build e lint passam; a limpeza de lint removeu
somente imports sem uso herdados. O build ainda avisa sobre o tamanho do pacote.

Após as novas migrações, os 7.826 registros/campos projetados, valores privados e
snapshots sanitizados foram novamente comparados; repetição preserva edição
posterior simulada. Restam replay Supabase completo, JWT/API reais, cadastro de
acessos, navegador com três perfis, PDFs, importador, rotinas e atualização final
dos dados antes de qualquer troca autorizada.

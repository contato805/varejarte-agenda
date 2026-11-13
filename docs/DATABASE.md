# Banco candidato do Varejarte

Somente projeto próprio. As migrations ainda não foram aplicadas no Supabase.

| Origem | Destino canônico | Campos restritos |
| --- | --- | --- |
| Employee | public.employees | app_private.employee_finances: salário |
| Client | public.clients | app_private.client_details: contatos e contrato |
| ActivityType | public.activity_types | — |
| ScheduleEntry | public.schedule_entries | RLS limita a agenda por perfil |
| AuditLog | public.audit_logs | Leitura/escrita administrativa |

IDs legados continuam como texto; novas linhas podem gerar UUID em formato texto.
Filiais e atividades previstas ficam em arrays JSONB, preservando campos adicionais.
Quantidades, durações e aniversários em arrays são convertidos explicitamente.
Nenhuma tabela de negócio contém senha ou token. O snapshot sanitizado permanece
em `base44_migration.records`, fora dos schemas expostos pela Data API.

`app_private.user_access` vinculará um usuário do Supabase Auth a um colaborador
ou ao proprietário administrativo. Não há contas ou vínculos criados pelo importador.
Um usuário autenticado sem vínculo ativo continua sem acesso ao produto. O papel
vem do vínculo/colaborador mantidos no servidor, nunca de metadados enviados pelo
navegador. Colaborador desativado ou removido perde acesso ao consultar o banco.

| Perfil | Agenda | Colaboradores/clientes | Financeiro/contatos | Escrita |
| --- | --- | --- | --- | --- |
| Administrador | Todas | Todos | Permitido pelos leitores administrativos | Permitida nas tabelas do produto |
| Supervisor | Todas | Todos | Não | Não |
| Visualizador | Própria | Próprio colaborador e clientes vinculados à sua agenda | Não | Não |
| Sem vínculo/anônimo | Não | Não | Não | Não |

Os leitores `employee_records()` e `client_records()` acrescentam os atributos
privados somente para administradores. As políticas nas tabelas continuam
obrigatórias; tabelas privadas e vínculos não têm acesso direto pelo navegador.
Exclusão física não é concedida aos papéis do navegador. O modelo prevê
`deleted_at`; as operações administrativas de remoção, gravação financeira,
gerenciamento de acesso e auditoria verificada ainda precisam ser implementadas.

## Importação inicial

```sh
python3 scripts/render_import.py .migration/backups/2026-11-13 --output .migration/prepared/NOVO/import-initial.sql
node scripts/verify_local_import.mjs .migration/backups/2026-11-13 .migration/prepared/NOVO/import-initial.sql
npm run test:database
```

O SQL gerado contém dados reais e permanece privado, ignorado pelo Git, com
permissão local 0600. Gerar SQL não o executa. O verificador usa apenas banco
PostgreSQL/WASM em memória, sem conexão de rede. Não aponta a projeto remoto.

A primeira carga exige destino vazio. Snapshots, projeções, dados privados e
registro da importação são gravados numa transação; FK inválida aborta a carga
inteira. Uma nova execução do mesmo snapshot verifica o staging e não reescreve
as projeções, preservando alterações posteriores. Outra carga sobre um destino
populado é recusada: atualização final dos dados precisa de procedimento próprio.
O importador não provisiona usuários do Auth nem preserva senhas antigas.

Os horários da agenda ficam separados em data e texto HH:mm, inclusive término
à meia-noite. Os metadados exportados `created_date`/`updated_date` não contêm
offset: são preservados como timestamp sem fuso, com microssegundos, sem inferir
um deslocamento pela configuração deste computador. Novos defaults usam UTC
explicitamente. O snapshot também mantém os valores literais originais.

## Alcance das provas atuais

11 testes SQL cobrem papéis, negações, upgrade do staging e limites da importação;
nove testes Python cobrem CSVs, credenciais e conversões. A carga real em memória
conferiu as cinco entidades e todos os campos projetados, salários, contratos,
contatos e 7.826 snapshots sanitizados. A repetição preservou uma edição posterior.

O bootstrap de `auth.users`/`auth.uid()` desses testes é simulado. Isso NÃO prova
autenticação real, validação de JWT, PostgREST, Edge Functions, configuração de
produção ou replay da stack Supabase inteira. Esses testes e a paridade no
projeto exclusivo são condições ainda pendentes para a migração.

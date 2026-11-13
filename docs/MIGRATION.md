# Migração Varejarte Agenda

## Estado em 13/11/2026

Código recuperado pela interface de leitura do Base44, sem contratação de plano:
143 arquivos, incluindo seis esquemas (cinco tabelas de negócio e User), oito
funções e três workflows. Hashes do original em `source-manifest.json`.
O projeto local tem Git próprio, separado do repositório da pasta superior.

Destino do código: https://github.com/contato805/varejarte-agenda (privado).
Destino dos dados: **conta exclusiva `varejarteagenda@gmail.com`, indicada pelo
usuário; autenticação ainda pendente**. A sessão global desta máquina foi identificada como uma conta distinta
da conta que o usuário esperava usar no navegador. A organização **Varejarte**
(`hptgenccwkznoahivtab`) foi criada nessa sessão antes da identificação e continua
vazia: o provisionamento do projeto foi recusado por uma pendência de cobrança
nessa conta. Essa organização não será usada como destino definitivo sem resolver
a titularidade e a separação exigidas pelo usuário. Não houve alteração de plano,
pagamento, provisionamento de banco ou envio de dados para o Supabase.
Nenhum projeto Maestro ou Deskcomm foi alterado.

**Restrição do usuário:** o aplicativo Base44 está em uso pela equipe e deve
permanecer integralmente intacto. A origem é somente leitura; desenvolvimento e
testes com escrita devem ocorrer apenas nas cópias isoladas. A troca do aplicativo
em uso depende de autorização explícita. Essa regra também consta em `AGENTS.md`.

**Independência e entrega a terceiros:** código, banco, autenticação, hospedagem,
domínio, arquivos, envio de e-mail e segredos devem pertencer exclusivamente ao
Varejarte. Não compartilhar serviços, credenciais ou dependências de outros apps.
O repositório GitHub já é separado e privado; uma futura transferência ou convite
deve conceder acesso apenas a esse repositório. Contas pessoais e sessões globais
não fazem parte da entrega. O Supabase deve usar uma identidade própria, mantendo
o plano gratuito, e acesso de desenvolvimento separado das sessões dos outros apps.
A organização vazia criada anteriormente não foi apagada ou alterada.

## Fluxo e critérios de avanço

1. **Recuperar e preservar — concluído.** Código original e cinco CSVs exportados.
   Backup em `.migration/backups/2026-11-13/`, somente local e ignorado pelo Git.
2. **Conferir — concluído para o snapshot.** 41 ActivityType, 4.266 AuditLog,
   35 Client, 19 Employee e 3.465 ScheduleEntry: 7.826 registros. Zero IDs
   duplicados e zero vínculos órfãos dos agendamentos. As exportações ocorreram
   separadamente; não representam um snapshot transacional simultâneo.
3. **Preparar Supabase — iniciado.** Configuração, staging privado e modelo do
   produto estão escritos. Replay limpo, upgrade do staging, RLS e importação foram
   ensaiados em PostgreSQL/WASM descartável, com bootstrap de Auth simulado.
   Docker não estava ativo. Nada foi aplicado no Supabase remoto; bootstrap completo
   Supabase, Auth/JWT reais, Data API e deploy continuam pendentes.
   Próximo passo: o usuário concluir a entrada na conta `varejarteagenda@gmail.com`
   e então autenticar um perfil próprio do projeto. Não usar a sessão global existente
   nem alterar faturamento, acessos ou projetos de outras aplicações. Confirmar
   titularidade e plano antes de criar organização/projeto. Não repetir a tentativa
   anterior e não remover ou pausar recursos existentes para abrir espaço.
4. **Migrar o backend — iniciado.** As telas usam o adaptador Supabase, sem SDK,
   plugin ou fallback Base44. Login/sessão dependem de Auth e vínculo no servidor;
   clientes, auditoria, remoção lógica e backup manual têm RPCs candidatas.
   Funções de colaboradores/importação, bootstrap de acessos e validação real
   continuam pendentes. Contratos e limites em `RUNTIME.md`.
5. **Migrar as rotinas — iniciado.** Sincronização do nome do cliente foi escrita
   como trigger e ensaiada localmente preservando filiais históricas. Conclusão
   automática e backup diário ainda exigem substitutos e execução agendada.
6. **Validar e trocar — pendente.** Testar administrador, supervisor e visualizador;
   conferir contagens e relações no destino; comparar agenda, edição, filtros,
   indicadores e relatórios. Reexportar dados durante uma janela sem novas escritas
   antes da troca definitiva. Hospedagem e domínio serão definidos nessa etapa.

## Preparar um novo snapshot

Python 3, sem dependências adicionais:

```sh
python3 scripts/prepare_migration.py CAMINHO_DOS_CSVS --output .migration/prepared/NOVO_SNAPSHOT
python3 -m unittest discover -s scripts -p 'test_*.py' -v
```

A ferramenta valida os cinco arquivos antes de gravar, preserva valores CSV como
strings, mantém os IDs e retira os campos de senha e sessão. Gera `records.json`
e `report.json` com acesso restrito ao usuário local. O destino deve ser uma pasta
nova. Não faz conexão com serviços, importação remota nem alterações no Base44.
Os valores JSON dentro do CSV serão convertidos segundo os esquemas na etapa 4.
Dados financeiros e pessoais continuam presentes no snapshot privado; nunca
publique os arquivos em Git, artefatos de CI ou logs.

## Autenticação

O código original compara senhas de colaboradores e administra sessões em
Employee. Esses campos não integram as tabelas candidatas. A cópia agora usa
Supabase Auth e vínculo privado entre usuário e colaborador/proprietário;
implementar provisionamento e validar com sessões reais ainda é necessário.
Não importar senhas antigas em texto nem tokens de sessão para o novo sistema.
Nenhuma conta foi criada e nenhum convite ou e-mail foi enviado.

## Validações deste marco

- `npm run build`: passou com o runtime convertido, sem SDK/plugin Base44.
  Configuração ausente mostra “Ambiente em preparação”, sem chamar a origem.
- Testes Python: nove passaram (preparação e conversões de dados).
- Testes SQL locais: 18 passaram, cobrindo os três perfis, conta sem vínculo,
  colaborador desativado, acesso anônimo, upgrade do staging, datas sem deslocamento
  e com microssegundos, importação atômica, repetição sem sobrescrita e recusa de
  destino já populado; clientes atômicos, normalização, filiais históricas,
  remoção lógica, autor de auditoria e backup restrito. Identidades são sintéticas.
- Testes do adaptador/sessão/interface: 21 passaram, com SDK real e rede simulada,
  componentes React e cache. Cobrem leitura acima do limite da API, dados incompletos,
  recusa de servidor incorreto antes da senha, sessão legada forjada, limpeza de
  cache e resposta atrasada após logout, abas por perfil e aviso de dados incompletos.
- Validação dos CSVs reais: passou; inventário agregado em `data-inventory.json`.
- Importação dos 7.826 registros em PostgreSQL/WASM descartável: paridade de todos
  os campos projetados, valores financeiros privados, contatos e snapshots
  sanitizados conferida; nova execução preservou uma edição posterior simulada.
- `npm run lint`: passou. Removidos apenas imports sem uso herdados da origem;
  fonte original preservada na tag e no arquivo local de recuperação.
- Replay da stack Supabase completa, Auth/API reais e importação remota: pendentes.
- Teste completo da aplicação fora do Base44: pendente.

## Retorno ao estado anterior

O Base44 permanece como sistema ativo durante a migração. Não houve mudança no
domínio, nos dados de origem nem nas rotinas. A cópia recuperada fica identificada
pela tag `base44-recovered-2026-11-13` no Git. Staging é aditivo e privado;
eventual remoção de snapshots ou dados exige uma decisão própria, nunca um reset
de projeto compartilhado. O retorno após uma futura troca precisará tratar novas
escritas feitas no Supabase; o backup original sozinho não cobre esse período.

## Aprendizado da recuperação

Esforço não medido. A interface de leitura permitiu selecionar/copiar o código
integral, embora exportação ZIP e GitHub estivessem bloqueados pelo plano.
No editor, clicar no texto da primeira linha foi estável; clicar no espaço da
linha inteira podia selecionar o documento da página. As cópias foram conferidas
quanto a conteúdo de página indevido, arquivos ausentes e duplicações; os 143
arquivos tiveram hashes distintos e o frontend compilou. A disponibilidade dessa
interface deve ser verificada por projeto, sem presumir outro meio de exportação.

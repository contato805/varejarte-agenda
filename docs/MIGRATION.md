# Migração Varejarte Agenda

## Estado em 13/11/2026

Código recuperado pela interface de leitura do Base44, sem contratação de plano:
143 arquivos, incluindo seis esquemas (cinco tabelas de negócio e User), oito
funções e três workflows. Hashes do original em `source-manifest.json`.
O projeto local tem Git próprio, separado do repositório da pasta superior.

Destino do código: https://github.com/contato805/varejarte-agenda (privado).
Destino dos dados: projeto Supabase exclusivo na organização **Varejarte**, criada
no plano gratuito em 13/11/2026 (`hptgenccwkznoahivtab`). A criação do projeto
`varejarte-agenda` em São Paulo foi recusada pelo Supabase por uma pendência de
cobrança em outra organização da conta. A listagem posterior confirmou que nenhum
projeto Varejarte foi provisionado. Não houve alteração de plano nem pagamento.
Nenhum projeto Maestro ou Deskcomm foi alterado.

**Restrição do usuário:** o aplicativo Base44 está em uso pela equipe e deve
permanecer integralmente intacto. A origem é somente leitura; desenvolvimento e
testes com escrita devem ocorrer apenas nas cópias isoladas. A troca do aplicativo
em uso depende de autorização explícita. Essa regra também consta em `AGENTS.md`.

## Fluxo e critérios de avanço

1. **Recuperar e preservar — concluído.** Código original e cinco CSVs exportados.
   Backup em `.migration/backups/2026-11-13/`, somente local e ignorado pelo Git.
2. **Conferir — concluído para o snapshot.** 41 ActivityType, 4.266 AuditLog,
   35 Client, 19 Employee e 3.465 ScheduleEntry: 7.826 registros. Zero IDs
   duplicados e zero vínculos órfãos dos agendamentos. As exportações ocorreram
   separadamente; não representam um snapshot transacional simultâneo.
3. **Preparar Supabase — iniciado.** Configuração local e migration de staging
   privado disponíveis. A migration NÃO foi aplicada nem ensaiada em banco.
   Docker não estava ativo nesta máquina. Não há tabelas públicas do produto ainda.
   Organização Varejarte criada; provisionamento remoto bloqueado pela conta.
   Próximo passo: regularizar a pendência pelo painel Supabase e então criar o
   projeto nessa organização, mantendo o plano gratuito. Não repetir a criação
   enquanto a condição externa persistir; antes de tentar, listar os projetos
   para evitar duplicação. Não remover ou pausar outros projetos para abrir espaço.
4. **Migrar o backend — pendente.** Adaptar entidades, `clientCrud`, importação,
   login/sessão e chamadas Base44, preservando IDs, filiais, filtros e relatórios.
5. **Migrar as rotinas — pendente.** Conclusão automática, sincronização do nome
   do cliente e backup diário exigem substitutos para workflows, arquivos e e-mail.
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
Employee. Esses campos não devem integrar as tabelas acessíveis pelo navegador.
A troca precisa definir Supabase Auth e o vínculo entre usuário e colaborador,
incluindo o acesso administrativo hoje fornecido pela conta de plataforma Base44.
Não importar senhas antigas em texto nem tokens de sessão para o novo sistema.
Nenhuma conta foi criada e nenhum convite ou e-mail foi enviado.

## Validações deste marco

- `npm run build`: passou com o código recuperado. Isso comprova compilação;
  as chamadas de dados e autenticação ainda usam Base44.
- Testes de preparação: quatro passaram (preservação, credenciais, órfãos e duplicados).
- Validação dos CSVs reais: passou; inventário agregado em `data-inventory.json`.
- `npm run lint`: 50 erros preexistentes, todos de imports não utilizados.
  Mantidos para preservar a origem, sem limpeza geral durante a recuperação.
- Replay SQL, upgrade, políticas de acesso e importação remota: pendentes.
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

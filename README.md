# Varejarte Agenda

Migração do aplicativo Base44 para desenvolvimento local, GitHub e Supabase.

**Estado atual:** os 143 arquivos originais foram recuperados sem plano pago.
A cópia local usa um adaptador Supabase e compila sem o SDK do Base44. O modelo,
a importação de 7.826 registros e as permissões foram ensaiados localmente.
O projeto Supabase exclusivo ainda não foi criado; funções de colaboradores e
importação, rotinas, autenticação real e publicação permanecem pendentes.
O aplicativo em uso pela equipe permanece intacto no Base44.

## Desenvolvimento

Requisitos: Node.js 22 ou superior e npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Preencha as três variáveis Supabase somente depois de confirmar o projeto
exclusivo da conta `varejarteagenda@gmail.com`. Sem configuração, a aplicação
mostra “Ambiente em preparação” e não acessa o Base44. Nunca use a sessão
Supabase global desta máquina nem recursos dos outros aplicativos.
`npm run build` comprova compilação; não comprova login ou consultas reais.

## Migração

[Estado e próximos passos](docs/MIGRATION.md), [inventário do código](docs/source-manifest.json)
e [inventário agregado dos dados](docs/data-inventory.json).
[Modelo de dados](docs/DATABASE.md) e [contratos e pendências](docs/RUNTIME.md).

Os backups reais ficam em `.migration/`, fora do Git. Senhas e tokens não devem
entrar no repositório, nas variáveis do frontend nem em artefatos de CI.

```sh
python3 -m unittest discover -s scripts -p 'test_*.py' -v
npm run test:database
npm run test:client
npm run lint
npm run build
```

As migrações ainda não foram aplicadas remotamente. Os testes SQL usam
PostgreSQL/WASM descartável com identidades simuladas; os do aplicativo usam o
SDK real com rede simulada. A validação completa no destino continua necessária.
O README exportado da origem foi preservado em `docs/BASE44-README.md`.

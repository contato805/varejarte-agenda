# Varejarte Agenda

Migração do aplicativo Base44 para desenvolvimento local, GitHub e Supabase.

**Estado atual:** os 143 arquivos originais foram recuperados sem plano pago,
e o frontend compila localmente. A autenticação e os dados ainda usam Base44;
o aplicativo ainda não foi convertido para Supabase nem publicado em outra hospedagem.

## Desenvolvimento

Requisitos: Node.js 22 ou superior e npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

O acesso ao backend Base44 continua sujeito às sessões e permissões da origem.
`npm run build` verifica a compilação, sem comprovar login ou consultas no destino.

## Migração

[Estado e próximos passos](docs/MIGRATION.md), [inventário do código](docs/source-manifest.json)
e [inventário agregado dos dados](docs/data-inventory.json).

Os backups reais ficam em `.migration/`, fora do Git. Senhas e tokens não devem
entrar no repositório, nas variáveis do frontend nem em artefatos de CI.

```sh
python3 -m unittest discover -s scripts -p 'test_*.py' -v
```

O esquema privado de staging Supabase foi preparado e ainda não foi aplicado.
O modelo de dados do produto e suas permissões serão definidos na conversão.
O README exportado da origem foi preservado em `docs/BASE44-README.md`.

# Barbearia Bravio

Aplicação React para gestão de barbearia: agenda por barbeiro, serviços,
equipe, controle financeiro e área individual do barbeiro.

## Rodar localmente

```sh
npm install
npm run dev
```

Sem variáveis do Supabase, o app usa armazenamento local do navegador. Esse modo
serve para desenvolvimento em um único navegador e não envia convites por e-mail.

## Publicação

As instruções para conectar Supabase e Vercel estão em [DEPLOY.md](DEPLOY.md).
No modo conectado, o gerente convida barbeiros por e-mail e cada barbeiro define
sua própria senha pelo link recebido.

Não adicione arquivos `.env` nem chaves secret ao repositório. Use `.env.example`
como referência para as variáveis públicas do frontend.
# barbearia-bravio

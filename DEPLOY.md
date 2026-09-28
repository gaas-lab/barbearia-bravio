# Bravio Studio: Supabase + Vercel

O projeto mantém o modo local quando as variáveis do Supabase não existem. Com
VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY, usa Supabase Auth, Postgres,
RLS e Realtime para sincronizar a conta do gerente, os perfis dos barbeiros e
os pedidos de bloqueio entre dispositivos.

## Preparar o Supabase

1. Crie um projeto Supabase e mantenha a chave publishable/anon no frontend.
2. Copie .env.example para .env.local e preencha a URL e a chave pública.
3. Instale/execute o Supabase CLI e vincule este diretório ao projeto.
4. Aplique supabase/migrations/202609270001_barbershop_cloud.sql com
   supabase db push.
5. Configure APP_ORIGIN como secret da Edge Function com a origem do app e
   APP_URL com a URL de destino dos convites. Inclua essa URL em Authentication
   > URL Configuration > Redirect URLs. As chaves secret do projeto são
   injetadas no runtime das Edge Functions pelo Supabase.
6. Publique a função que cria as contas individuais:
   supabase functions deploy manage-barber-account.
7. Configure o SMTP de Authentication para enviar convites em produção. Os
   convites usam o template "Invite user" e levam o barbeiro ao app para criar
   a própria senha. Cadastre também os domínios locais e de produção como URLs
   de redirecionamento.

A chave secret/service-role ignora RLS e nunca deve ser colocada em .env.local do
frontend, no Git ou nas variáveis VITE_* da Vercel. A função de contas usa
essa chave somente no ambiente protegido do Supabase.

## Preparar a Vercel

Importe a pasta Barbearia Bravio como projeto Vite. O vercel.json configura
npm run build, publica dist e redireciona as rotas da SPA para index.html.
Cadastre VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nos ambientes Preview e
Production da Vercel e faça um novo deploy depois de salvar as variáveis.

## Acesso e notificações

- A criação do primeiro usuário master também cria a linha da barbearia.
- O gerente cria o perfil do barbeiro pela tela de cadastro. A Edge Function
  envia um convite por e-mail e vincula o usuário ao perfil; ao aceitar, o
  barbeiro define a própria senha e entra na área individual.
- O barbeiro consulta seus próprios dados pela função SQL get_barber_workspace;
  o retorno não inclui dados financeiros dos colegas ou despesas da casa.
- Pedidos são inseridos por submit_barber_block_request. O gerente recebe
  eventos Realtime em barber_block_requests e decide por
  review_barber_block_request. A aprovação verifica conflitos e grava o
  bloqueio na mesma transação.
- Os dados locais já existentes são usados como carga inicial quando o gerente
  entra pela primeira vez no Supabase naquele navegador. Verifique a agenda e
  os lançamentos antes de considerar essa carga como definitiva.

O Realtime atualiza o painel enquanto ele está aberto. Notificações push do
navegador com o app fechado ainda exigem configurar Service Worker, assinatura
Push e chaves VAPID; esse código não foi ativado neste preparo.

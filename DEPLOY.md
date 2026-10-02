# Bravio Studio: Supabase + Vercel

O projeto mantém o modo local quando as variáveis do Supabase não existem. Com
VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY, usa Supabase Auth, Postgres,
RLS e Realtime para sincronizar a conta do gerente, os perfis dos barbeiros e
os pedidos de bloqueio entre dispositivos.

## Preparar o Supabase

1. Crie um projeto Supabase e mantenha a chave publishable/anon no frontend.
2. Copie .env.example para .env.local e preencha a URL e a chave pública.
3. Instale/execute o Supabase CLI e vincule este diretório ao projeto.
4. Aplique as migrations com `supabase db push` (incluindo
   `202609280001_first_manager_only.sql`). Só o primeiro cadastro pode
   inicializar uma barbearia master; cadastros posteriores não recebem acesso
   ao painel.
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

## Atendente de agendamento pelo WhatsApp

O agente usa a WhatsApp Business Platform Cloud API da Meta e a Responses API
da OpenAI. O webhook roda como Edge Function; os tokens ficam apenas nos
secrets do Supabase. A reserva lê os serviços e a agenda atuais, e uma função
SQL confirma novamente preço, horário de funcionamento e conflitos antes de
inserir o atendimento. O atendimento aparece na mesma agenda do app com origem
`whatsapp`.

1. Aplique as migrations, inclusive `202610020001_whatsapp_booking_agent.sql`,
e publique com `supabase functions deploy whatsapp-booking-agent`.
2. No painel do Supabase, copie o UUID da barbearia em `shops.id` para a qual o
   número será conectado. Neste preparo, cada implantação da função atende uma
   barbearia e um número de telefone.
3. Crie/configure um app Meta com WhatsApp Cloud API, registre o número e
   configure um token de acesso permanente com permissão de envio de mensagens.
   Em Webhooks, assine o campo `messages` do objeto WhatsApp Business Account.
4. Gere um token de verificação próprio e configure os secrets abaixo. Use o
   App Secret do app Meta e o Phone Number ID exibido no painel do WhatsApp:

   ```sh
   supabase secrets set BRAVIO_SHOP_ID="UUID_DA_BARBEARIA" \
     WHATSAPP_VERIFY_TOKEN="TOKEN_DE_VERIFICACAO_QUE_VOCE_ESCOLHEU" \
     WHATSAPP_APP_SECRET="APP_SECRET_META" \
     WHATSAPP_ACCESS_TOKEN="TOKEN_DE_ACESSO_META" \
     WHATSAPP_PHONE_NUMBER_ID="PHONE_NUMBER_ID_META" \
     OPENAI_API_KEY="CHAVE_DA_OPENAI" \
     OPENAI_MODEL="gpt-5-mini"
   ```

   `WHATSAPP_GRAPH_VERSION` é opcional; o padrão atual no código é `v23.0`.
5. Cadastre no painel Meta o callback
   `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-booking-agent` e
   o mesmo `WHATSAPP_VERIFY_TOKEN`. A verificação GET é respondida pela função;
   as mensagens POST são autenticadas com a assinatura HMAC enviada pela Meta.
6. Teste pelo número conectado: pergunte por serviços, escolha uma data, serviço
   e horário. A função envia um resumo e só cria a reserva depois que o cliente
   responde com uma confirmação clara (por exemplo, "sim" ou "confirmo"); então
   confira o atendimento na agenda do app.

O agente só atende mensagens de texto neste primeiro corte. Imagens, áudios,
cancelamentos, reagendamentos e transferência assistida para uma caixa de
entrada humana ainda não estão implementados. A OpenAI recebe o texto da
conversa para gerar respostas; a memória curta fica na tabela privada
`whatsapp_conversations`. Não exponha nenhuma dessas credenciais no frontend.

A chave secret/service-role ignora RLS e nunca deve ser colocada em .env.local do
frontend, no Git ou nas variáveis VITE_* da Vercel. A função de contas usa
essa chave somente no ambiente protegido do Supabase.

## Preparar a Vercel

Importe a pasta Barbearia Bravio como projeto Vite. O vercel.json configura
npm run build, publica dist e redireciona as rotas da SPA para index.html.
Cadastre VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nos ambientes Preview e
Production da Vercel e faça um novo deploy depois de salvar as variáveis.

## Acesso e notificações

- O primeiro cadastro cria a conta master e a linha da barbearia. Cadastros
  seguintes precisam ser convidados como barbeiros pelo gerente.
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

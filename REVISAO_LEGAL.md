# Revisão legal e operacional — Barbearia Bravio

**Checklist interno — versão de trabalho de 25 de outubro de 2026.** Este documento não é parecer jurídico nem certificação de conformidade. Fechar os itens abaixo antes de tratar os textos como definitivos ou ampliar o uso com dados reais.

## Identificação e governança

- [ ] Completar identificação do operador da instância oficial (razão social/nome civil, CPF/CNPJ e endereço para comunicações formais).
- [ ] Confirmar por escrito o papel da Gaaslab e das barbearias usuárias: quem define finalidades e meios, quem opera instruções, e como atender pedidos de titulares.
- [ ] Validar que `gaasbrel@gmail.com` é monitorado, estabelecer responsável e prazo interno para triagem de solicitações LGPD.
- [ ] Definir bases legais e avisos próprios para cada instalação, incluindo dados de clientes e profissionais.
- [ ] Publicar a versão aprovada dos termos e do aviso de privacidade em local visível; acrescentar links no fluxo de login/cadastro/convite e registrar a versão apresentada quando houver aceite.

## Dados e funcionalidades

- [ ] Avaliar os campos de texto livre, especialmente o motivo de bloqueio de horário, que pode receber dados de saúde ou outros dados sensíveis. Preferir opções genéricas e orientar usuários a não inserir detalhes privados.
- [ ] Documentar retenção e exclusão de contas, agenda, registros financeiros, fotos/logotipos, dados no navegador, backups e logs.
- [ ] Implementar e documentar o fluxo para pedidos de acesso, correção, exportação e eliminação, incluindo conta do gerente e histórico associado à conta de barbeiro.
- [ ] Definir como dados são migrados do armazenamento local para a nuvem e como descartar cópias locais após a migração.
- [ ] Confirmar política para registros financeiros e obrigações legais de guarda sem manter dados pessoais além do necessário.

## Segurança e fornecedores

- [ ] Confirmar regiões de hospedagem e processamento, contratos/instruções com Vercel e Supabase e mecanismos para eventuais transferências internacionais.
- [ ] Revisar políticas RLS, funções RPC e Edge Functions com contas de gerente, barbeiro e mais de uma barbearia; documentar resultados e revisão periódica.
- [ ] Confirmar controles de acesso administrativo, MFA, gestão de segredos, backups, restauração, logs, dependências e resposta a incidentes.
- [ ] Avaliar exposição técnica associada ao carregamento de Google Fonts e considerar hospedagem local das fontes.
- [ ] Manter procedimento de incidente que permita avaliação rápida de risco e comunicação nos prazos da Resolução ANPD nº 15/2024, quando aplicável.

## Uso comercial e trabalhista

- [ ] Confirmar que a aplicação não será divulgada como sistema contábil, fiscal, folha de pagamento ou controle formal de jornada sem avaliação específica.
- [ ] Revisar a licença MIT para confirmar titularidade do código e inventariar licenças de dependências, marcas, fotos e outros ativos de terceiros.
- [ ] Se houver remuneração, assinatura ou fornecimento comercial, revisar oferta, suporte, cancelamento, disponibilidade e regras de proteção ao consumidor aplicáveis.
- [ ] Se comissões ou registros forem usados em relações de trabalho ou prestação de serviço, validar os cálculos e documentos com assessoria contábil/trabalhista.

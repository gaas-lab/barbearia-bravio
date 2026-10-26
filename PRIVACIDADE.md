# Aviso de Privacidade — Barbearia Bravio

**Versão de trabalho — 25 de outubro de 2026.** Este aviso descreve o funcionamento conhecido do projeto e precisa ser revisado pelo responsável jurídico e operacional antes de ser tratado como versão definitiva.

## 1. Quem trata os dados

Na instância oficial hospedada em [barbearia-bravio.vercel.app](https://barbearia-bravio.vercel.app/), a operação é realizada por **Gaaslab**, que pode ser contatada pelo e-mail [gaasbrel@gmail.com](mailto:gaasbrel@gmail.com). A identificação jurídica completa do operador (razão social ou nome civil, CPF/CNPJ e endereço para comunicações formais) ainda deve ser incluída.

Em instalações próprias ou no modo local, a barbearia ou pessoa que administra a instalação decide como os dados são usados e deve disponibilizar seu próprio aviso e canal de contato. A Gaaslab publica o software; isso, por si só, não a torna responsável por toda instalação feita por terceiros.

## 2. Dados tratados e finalidades

Conforme os recursos usados, o sistema pode tratar:

- dados de acesso e conta: e-mail, nome, identificador de usuário e dados técnicos de autenticação;
- dados de clientes: nome e, quando informado, telefone;
- agenda e atendimento: data, horário, serviços, duração, valores, descontos e situação do atendimento;
- dados da equipe: nome, e-mail de acesso, foto, função, percentual de comissão, agenda e solicitações de bloqueio de horário;
- informações administrativas e financeiras inseridas pela barbearia: serviços, despesas, retiradas, valores e observações;
- imagens ou elementos de marca enviados como foto de perfil e logotipo;
- dados técnicos necessários para manter a sessão e operar a aplicação.

Esses dados servem para autenticar usuários, organizar agenda e equipe, registrar serviços e apoiar o acompanhamento financeiro da barbearia. O sistema não oferece cadastro de clientes finais nem agenda pública de autoatendimento, conforme a implementação atualmente revisada.

Evite incluir dados sensíveis em campos livres, especialmente no motivo de bloqueio de horário. Use descrições genéricas, sem informações de saúde ou outros detalhes privados.

## 3. Acesso e modos de armazenamento

**Modo local:** os dados são guardados no armazenamento do navegador utilizado e não são sincronizados automaticamente com outros dispositivos. A limpeza dos dados do navegador pode apagá-los. A aplicação mantém dados de autenticação local protegidos por derivação com salt, mas isso não substitui uma senha forte, bloqueio do dispositivo e uso em ambiente confiável.

**Modo em nuvem:** a aplicação usa Supabase Auth, Postgres, políticas de acesso (RLS), Realtime e uma Edge Function para operações de conta. A instância publicada também é servida pela Vercel. A função de gerenciamento de contas usa credenciais privilegiadas no ambiente protegido do servidor; elas não devem ser expostas no frontend. O primeiro cadastro pode inicializar a barbearia e os demais barbeiros entram por convite do gerente.

O gerente administra o espaço da barbearia. O acesso de barbeiros é destinado ao seu próprio espaço de trabalho, sem acesso aos dados financeiros dos colegas ou às despesas da barbearia, de acordo com as regras implementadas no banco. A barbearia deve revisar seus usuários e permissões periodicamente.

A interface carrega fontes do Google Fonts, o que pode enviar ao provedor dados técnicos da conexão, como endereço IP e informações do navegador, ao solicitar esses arquivos. Os locais de processamento e as salvaguardas contratuais dos fornecedores de hospedagem e infraestrutura ainda precisam ser confirmados pelo operador.

## 4. Bases legais

A base legal aplicável depende de quem opera a instalação, do relacionamento com cada titular e do uso concreto. Para a instância hospedada, a Gaaslab e a barbearia devem documentar seus respectivos papéis e avaliar as hipóteses legais pertinentes da LGPD para autenticação, prestação do serviço, gestão da agenda e registros administrativos. Não se presume consentimento como base para todo tratamento.

A barbearia que insere dados de clientes e profissionais deve informar essas pessoas sobre o tratamento e assegurar que possui uma base legal adequada para cada finalidade.

## 5. Compartilhamento

Os dados podem ser processados pelos fornecedores técnicos necessários à operação, incluindo Vercel, Supabase e Google Fonts, conforme o modo de uso. A lista de fornecedores, os países/regiões de processamento, os prazos de retenção e os mecanismos aplicáveis a transferências internacionais precisam ser confirmados e publicados pelo operador antes da versão final deste aviso.

Não há indicação, no código revisado, de venda de dados pessoais ou uso para publicidade comportamental.

## 6. Retenção, correção e exclusão

No modo local, os dados permanecem no navegador até que sejam removidos pela própria pessoa ou apagados pelo navegador/dispositivo. No modo em nuvem, não foi identificada uma política publicada que defina prazos de retenção, exclusão completa do espaço do gerente, remoção de imagens, ou expurgo de cópias de segurança. Esses prazos e procedimentos devem ser definidos pelo operador e pela barbearia antes do uso com dados reais.

O gerente pode remover contas de barbeiros pelo recurso de gerenciamento existente, mas a exclusão da conta não deve ser presumida como apagamento automático de todos os registros históricos associados. Para pedidos de acesso, correção, informação, oposição ou eliminação, escreva para [gaasbrel@gmail.com](mailto:gaasbrel@gmail.com) e indique “Privacidade — Barbearia Bravio” no assunto. Se os dados estiverem sob controle de uma instalação própria, contate também o administrador daquela instalação.

Para ajudar a localizar os dados, informe o e-mail da conta, o nome da barbearia e o pedido desejado. Evite enviar documentos ou dados pessoais adicionais sem necessidade. A resposta e eventual verificação de identidade seguirão a LGPD e os limites legais aplicáveis.

## 7. Segurança e incidentes

São utilizados controles como autenticação, separação de permissões no banco e armazenamento seguro de credenciais privilegiadas em ambiente de servidor. Nenhum sistema elimina todo risco. Use senhas fortes, limite os acessos, encerre sessões em dispositivos compartilhados e não publique chaves privadas.

O operador deve manter um processo interno para investigar incidentes e avaliar comunicação à ANPD e aos titulares quando exigida. A ANPD prevê prazo de três dias úteis para comunicação de incidentes que possam acarretar risco ou dano relevante, ressalvadas regras específicas.

## 8. Atualizações e contato

Este aviso deve ser revisto quando houver mudança material nos dados tratados, fornecedores, finalidades ou modos de operação. A data e a versão devem ser atualizadas a cada publicação.

Contato de privacidade: [gaasbrel@gmail.com](mailto:gaasbrel@gmail.com).

## Referências oficiais

- [Lei Geral de Proteção de Dados Pessoais — Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [Direitos dos titulares — ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares)
- [Comunicação de incidente de segurança — ANPD](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)
- [Resolução CD/ANPD nº 19/2024 — transferência internacional de dados](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024)

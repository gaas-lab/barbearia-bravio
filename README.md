# 💈 Barbearia Bravio

> Sistema web de gestão para barbearias, desenvolvido para centralizar agenda, serviços, equipe e controle financeiro em uma única plataforma.

🌐 **[Acessar aplicação](https://barbearia-bravio.vercel.app/)**

---

## 📌 Sobre o projeto

O **Barbearia Bravio** é uma aplicação web desenvolvida para digitalizar a operação de uma barbearia, oferecendo uma experiência centralizada para gerenciamento do negócio e acompanhamento da rotina dos barbeiros.

A plataforma foi pensada para reduzir processos manuais e facilitar o controle das principais operações da barbearia, desde o gerenciamento da agenda até o acompanhamento financeiro.

O sistema possui diferentes níveis de utilização, permitindo que o gestor tenha uma visão geral da operação enquanto cada barbeiro possui acesso à sua própria área.

---

## ✨ Funcionalidades

### 📅 Agenda

* Visualização da agenda da barbearia
* Organização de horários por barbeiro
* Controle dos atendimentos
* Gestão individual da agenda de cada profissional

### 💈 Serviços

* Cadastro de serviços
* Gerenciamento dos serviços oferecidos
* Organização das opções disponíveis para atendimento

### 👥 Equipe

* Gerenciamento dos barbeiros
* Área individual para cada profissional
* Controle de acesso dos membros da equipe
* Convite de novos barbeiros por e-mail

### 💰 Financeiro

* Controle financeiro da operação
* Acompanhamento dos valores gerados pelos atendimentos
* Organização das informações financeiras da barbearia

### 🔐 Autenticação

* Sistema de autenticação integrado ao Supabase
* Gerenciamento de usuários
* Convite de barbeiros por e-mail
* Definição de senha através de link de convite

### 💾 Modo local

A aplicação também possui um modo de funcionamento utilizando o armazenamento local do navegador.

Esse modo permite executar o projeto para desenvolvimento sem necessidade de configurar o Supabase, sendo ideal para testes em um único navegador.

---

## 🛠️ Tecnologias

| Tecnologia     | Utilização                           |
| -------------- | ------------------------------------ |
| **React**      | Construção da interface              |
| **Vite**       | Ambiente de desenvolvimento e build  |
| **JavaScript** | Lógica da aplicação                  |
| **Supabase**   | Autenticação e persistência de dados |
| **CSS**        | Estilização da interface             |
| **Vercel**     | Deploy da aplicação                  |

---

## 📂 Estrutura do projeto

```text
barbearia-bravio/
├── dist/
├── src/
├── supabase/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── vercel.json
├── DEPLOY.md
└── README.md
```

### Principais diretórios

**`src/`**
Código principal da aplicação React.

**`supabase/`**
Arquivos relacionados à configuração e estrutura do Supabase.

**`dist/`**
Arquivos gerados durante o processo de build.

**`DEPLOY.md`**
Documentação específica para configuração e publicação do projeto.

---

## 🚀 Instalação

### Pré-requisitos

Antes de começar, você precisa ter instalado:

* Node.js
* npm
* Git

### Clone o repositório

```bash
git clone https://github.com/gaas-lab/barbearia-bravio.git
```

Entre na pasta:

```bash
cd barbearia-bravio
```

Instale as dependências:

```bash
npm install
```

Execute o projeto:

```bash
npm run dev
```

Após iniciar o servidor, acesse o endereço informado pelo Vite no terminal.

---

## 🔐 Configuração do Supabase

O projeto pode funcionar sem configuração do Supabase utilizando o armazenamento local do navegador.

Para utilizar a aplicação com persistência de dados e autenticação, é necessário configurar as variáveis de ambiente do Supabase.

Utilize o arquivo:

```text
.env.example
```

como referência.

> ⚠️ Nunca envie arquivos `.env` ou chaves privadas para o GitHub.

A configuração completa de Supabase e Vercel está documentada em:

```text
DEPLOY.md
```

---

## ☁️ Deploy

A aplicação está preparada para publicação utilizando **Vercel**.

O projeto possui configuração própria através do:

```text
vercel.json
```

Fluxo básico:

```bash
npm install
npm run build
```

Depois, o projeto pode ser conectado a um repositório GitHub e publicado através da Vercel.

---

## 🎯 Objetivo do projeto

O Bravio foi desenvolvido com foco em três pilares:

**Operação**
Centralizar a rotina da barbearia em uma única plataforma.

**Gestão**
Facilitar o acompanhamento da equipe, agenda e resultados financeiros.

**Experiência**
Criar uma interface simples e objetiva para gestores e barbeiros.

---

## 🔮 Roadmap

Possíveis evoluções do projeto:

* [ ] Dashboard com indicadores de desempenho
* [ ] Relatórios financeiros avançados
* [ ] Histórico completo de clientes
* [ ] Notificações automáticas de agendamento
* [ ] Integração com WhatsApp
* [ ] Sistema de confirmação de horários
* [ ] Gestão de horários disponíveis
* [ ] Programa de fidelidade
* [ ] Relatórios por barbeiro
* [ ] Melhorias na experiência mobile
* [ ] PWA para instalação em dispositivos móveis

---

## 📱 Aplicação

**Produção:**
https://barbearia-bravio.vercel.app/

**Repositório:**
https://github.com/gaas-lab/barbearia-bravio

---

## 👨‍💻 Desenvolvimento

Projeto desenvolvido por **gaas.lab**.

> **gaas.lab** — laboratório de experimentação, design e desenvolvimento de produtos digitais.

---

## 📄 Licença

Este projeto está disponível para fins de estudo, desenvolvimento e experimentação.

Consulte o arquivo `LICENSE`, caso disponível, para informações sobre os termos de utilização.


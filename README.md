
# NARA - Nova Assistente Residencial Automatizada

> **Assistente virtual para suporte e automação em condomínios** 🏢✨

NARA é uma assistente residencial automatizada criada para oferecer suporte e praticidade na gestão de condomínios. Utilizando integração com o WhatsApp e automação para o gerenciamento de tags veiculares, dúvidas e outras funcionalidades, a NARA visa simplificar a comunicação e facilitar o dia a dia dos moradores e da administração do condomínio.

## ✨ Funcionalidades

- **Ativação de TAG Veicular** 🚗:
  - Fluxo guiado para coleta de informações sobre o veículo e envio de fotos.
  - Confirmação e verificação de dados.
  - Notificação sobre a ativação.

- **Outras Dúvidas** 🤔:
  - Oferece uma forma rápida de contato com o zelador e as síndicas para suporte adicional.
  
- **Controle de Conversas** 🗣️:
  - Fluxo automático e humanizado de mensagens.
  - Opção para encerrar a conversa a qualquer momento.

## 🚀 Tecnologias Utilizadas

- **Node.js** - Back-end e servidor principal.
- **Axios** - Chamadas à API da FIPE para obtenção de dados veiculares.
- **TypeScript** - Para tipagem estática e maior robustez do código.


### Instalação

1. **Clone o repositório**:

   ```bash
   git clone https://github.com/ftapparo/nara-api.git
   cd nara-api
   ```

2. **Instale as dependências**:

   ```bash
   yarn install
   ```

3. **Configure as variáveis de ambiente**:

   Crie um arquivo `.env` na raiz do projeto.

4. **Inicie o projeto**:

   ```bash
   yarn dev:consumer
   ```


---

*© 2024 NARA - Nova Assistente Residencial Automatizada*
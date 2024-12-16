// Carrega variáveis de ambiente a partir de um arquivo .env
import dotenv from "dotenv";
dotenv.config();

// Importação das bibliotecas
import amqp from 'amqplib';
import { MessageService } from './services/messageService';
import { ConversationRepository } from './repositories/conversationRepository';  // Importando o repositório de conversas

// Função principal para iniciar o consumidor
const startConsumer = async () => {

  // Log inicial indicando que o consumidor está sendo iniciado
  console.log("Iniciando no modo CONSUMER...");

  try {
    // Estabelecendo a conexão com o RabbitMQ
    console.log("Tentando conectar ao RabbitMQ...");
    const connection = await amqp.connect('amqp://admin:admin@192.168.15.250:5672/nara_system');
    console.log("Conexão estabelecida com sucesso!");

    // Criando um canal de comunicação com o RabbitMQ
    const channel = await connection.createChannel();
    console.log("Canal criado com sucesso!");

    // Declaração da fila 'incoming-queue' com parâmetros específicos
    console.log("Declarando a fila 'incoming-queue'...");
    await channel.assertQueue("incoming-queue", {
      durable: true,  // A fila será persistente
      arguments: {
        "x-dead-letter-exchange": "nara-dead-letter",  // Fila de mensagens mortas
        "x-max-length": 1000,  // Limite máximo de mensagens na fila
        "x-message-ttl": 30000,  // Tempo de vida da mensagem
        "x-queue-type": "classic",  // Tipo da fila
      },
    });
    console.log("Fila 'incoming-queue' declarada com sucesso!");

    // Declaração da fila 'outgoing-queue' com parâmetros específicos
    console.log("Declarando a fila 'outgoing-queue'...");
    await channel.assertQueue("outgoing-queue", {
      durable: true,  // A fila será persistente
      arguments: {
        "x-dead-letter-exchange": "nara-dead-letter",  // Fila de mensagens mortas
        "x-message-ttl": 60000,  // Tempo de vida da mensagem
        "x-queue-type": "classic",  // Tipo da fila
        "x-single-active-consumer": true,  // Somente um consumidor ativo por vez
      },
    });
    console.log("Fila 'outgoing-queue' declarada com sucesso!");

    // Verificando se o canal foi criado corretamente
    if (!channel) {
      console.log("Erro: Canal não criado!");
      return;
    }

    // Consumindo mensagens da fila 'incoming-queue'
    console.log("Iniciando o consumo de mensagens na fila 'incoming-queue'...");
    channel.consume("incoming-queue", async (message) => {
      if (message) {
        try {
          // Processa a mensagem usando o serviço MessageService
          await MessageService.processIncomingMessage(channel, message);
          channel.ack(message);

        } catch (error) {
          // Caso ocorra um erro ao processar a mensagem
          console.error("Erro ao processar a mensagem:", error);

          // Confirma a mensagem mesmo em caso de erro para removê-la da fila
          channel.ack(message);
          console.log("Mensagem descartada após erro.");
        }
      }
    });


    // Executa o processo de invalidação periodicamente
    setInterval(async () => {
      console.log(`[${new Date().toISOString()}] Verificando conversas inativas...`);
      await ConversationRepository.invalidateConversations(20);
    }, 1 * 60 * 1000); // Executa a cada 1 minuto

    console.log("Consumer iniciado com sucesso!");

  } catch (error) {
    // Caso ocorra um erro ao tentar conectar ao RabbitMQ
    console.error("Erro ao conectar ao RabbitMQ:", error);
  }
}

// Inicia o consumidor
startConsumer();

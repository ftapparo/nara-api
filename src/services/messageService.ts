import { MessageRepository } from "../repositories/messageRepository";
import { ConversationRepository } from "../repositories/conversationRepository";
import { NovaApiIntegration } from "../integrations/novaApiIntegration";
import { MessageDTO, OutgoingMessageDTO } from "../dtos/messageDTO";
import { TagRepository } from "../repositories/tagRepository";
import { CustomError } from "../errors/customError";
import { ConversationDTO } from "../dtos/conversationDTO";
import { ImageService } from "./imageService";
import * as cheerio from 'cheerio';
import puppeteer from "puppeteer";
import axios from 'axios';
import flow from "../config/flow.json";
import { FlowDTO } from "../dtos/flowDTO";
import levenshtein from "levenshtein";
import fs from "fs";
import { ImageRecognizerService } from "./../integrations/imageRecogIntegration";
import { PlateRecognizerService } from './../integrations/plateRecogIntegration';
import amqp from 'amqplib';

const flowData: FlowDTO = flow;

export class MessageService {

  private static rabbitMQChannel: amqp.Channel;

  public static sendMessage(channel: amqp.Channel, response: any) {
    // Envia a resposta para a fila de saída
    channel.sendToQueue("outgoing-queue", Buffer.from(JSON.stringify(response)));
  }
  static async processIncomingMessage(
    channel: amqp.Channel,
    message: amqp.ConsumeMessage
  ) {

    MessageService.rabbitMQChannel = channel;
    let conversation: ConversationDTO | null = null;
    let data: any

    try {

      // Recebe a mensagem
      const payload = message.content.toString();
      data = JSON.parse(payload)

      // Busca conversa ativa
      conversation = await ConversationRepository.findActiveByUserId(data.userId);

      // Se nenhuma conversa ativa, cria uma
      if (!conversation) {

        const phoneNumber = data.userId.replace(/^55/, '').split('@')[0];
        const user = await NovaApiIntegration.getUserByPhone(phoneNumber);

        // Se não for condômino, encerra a conversa
        if (!user || ![10, 11, 20, 21, 7].includes(user.CLASSIFICACAO)) {
          let responsePackage: OutgoingMessageDTO = {
            status: "success",
            userId: data.userId,
            messages: [
              {
                id: 1,
                type: "chat",
                body: "🚫 Olá! Infelizmente, só consigo atender pessoas vinculadas ao condomínio Nova Residence." +
                  " Caso precise de mais informações ou tenha dúvidas, recomendamos entrar em contato com a administração do condomínio" +
                  " ou verificar nossos canais de atendimento.\n\nAgradecemos sua compreensão! 😊",
                timestamp: Date.now().toString(),
              }
            ]
          }
          MessageService.sendMessage(MessageService.rabbitMQChannel, responsePackage);

          return responsePackage;
        }

        // Se for condômino, inicia a conversa
        else {

          // if (!MessageService.validateMessage(data.body, flowData.flow.sessions["greetings"].steps["start"].expectedInput, 0.5)) {
          //   console.error("Mensagem de abertura de conversa inválida");
          //   return;
          // }

          conversation = await ConversationRepository.createConversation(
            data.userId,
            "active",
            { session: "greetings", step: "start" },
            "start"
          );
        }

      }

      // Se existe uma conversa ativa
      else {

        // Se enviar a palavra "fim" encerra a conversa
        if (data.body.toLowerCase() === "fim") {
          await ConversationRepository.updateConversationStatus(conversation.id, "closed");
          let responsePackage: OutgoingMessageDTO = {
            status: "success",
            userId: conversation.user_id,
            messages: [
              {
                id: 1,
                type: "chat",
                body: "😉 Entendido! Nosso atendimento foi encerrado. Caso queira começar novamente, é me chamar novamente, até logo",
                timestamp: Date.now().toString(),
              }
            ]
          };
          MessageService.sendMessage(MessageService.rabbitMQChannel, responsePackage);

          return responsePackage;
        }

        // Caso ainda esta em processamento
        if (conversation.status != "active") {
          let responsePackage: OutgoingMessageDTO = {
            status: "success",
            userId: conversation.user_id,
            messages: [
              {
                id: 1,
                type: "chat",
                body: "Ainda estou processando sua ultima mensagem. Só um momento, por favor! 🙂",
                timestamp: Date.now().toString(),
              }
            ]
          };

          MessageService.sendMessage(MessageService.rabbitMQChannel, responsePackage);

          return responsePackage;
        }

        await ConversationRepository.updateLastActivity(conversation.id);
      }

      // Cria o registro da mensagem no banco de dados
      await MessageRepository.createMessage(conversation.id, "user", data.body, data.type, data.timestamp);

      // Processa o conteudo da mensagem
      const response = await this.processMessageContent(conversation, data.body, data.type);

      // Envia a resposta para fila
      MessageService.sendMessage(MessageService.rabbitMQChannel, response);

      // Retorna a resposta
      return response;

    } catch (error: any) {

      if (conversation)
        await ConversationRepository.updateConversationStatus(conversation.id, "error");

      console.error("[ERROR] processIncomingMessage:", error.message);

      const responsePackageError: OutgoingMessageDTO = {
        status: "error",
        userId: data.userId,
        messages: [
          {
            id: 1,
            type: "chat",
            body: error.message,
            timestamp: Date.now().toString(),
          }
        ]
      };

      MessageService.sendMessage(MessageService.rabbitMQChannel, responsePackageError);
      throw { message: responsePackageError, statusCode: error.statusCode || 500 };;
    }
  }

  public static validateMessage(
    message: string,
    expectedInputs: string[] | null,
    threshold: number = 0.5
  ): boolean {

    // Verifica se houver tokens validos
    if (!expectedInputs)
      return true;

    const tokens = message.toLowerCase().split(" ").filter(Boolean);
    let validCount = 0;

    for (const token of tokens) {
      for (const expected of expectedInputs) {
        const distance = new levenshtein(token, expected).distance;
        const maxLen = Math.max(token.length, expected.length);
        const similarity = 1 - distance / maxLen;

        if (similarity >= threshold) {
          validCount++;
          break; // Conta apenas uma vez por token
        }
      }
    }

    const matchPercentage = validCount / tokens.length;
    return matchPercentage >= threshold;
  }

  public static calculateTokenMatch(message: string, validTokens: string[] | null, threshold: number = 0.5): boolean {

    // Verifica se houver tokens validos
    if (!validTokens)
      return true;

    // Normaliza a mensagem para tokens (removendo pontuação e transformando em minúsculas)
    const tokens = message
      .toLowerCase()
      .split(/\s+/) // Divide por espaços
      .map(token => token.replace(/[^\w]/g, "")); // Remove pontuação

    // Calcula tokens válidos
    const validCount = tokens.filter(token => validTokens.includes(token)).length;

    // Calcula porcentagem de correspondência
    const matchPercentage = validCount / tokens.length;

    // Retorna se a correspondência está acima do limiar
    return matchPercentage >= threshold;
  }

  public static async processMessageContent(
    conversation: ConversationDTO,
    body: string,
    type: string
  ): Promise<OutgoingMessageDTO> {

    let responsePackage: OutgoingMessageDTO = {
      status: "success",
      userId: conversation.user_id,
      messages: []
    };

    try {

      // Muda o status da conversa para processando
      await ConversationRepository.updateConversationStatus(conversation.id, "processing");

      switch (conversation.flow.session) {
        case "greetings": // Inicia o menu principal
          responsePackage.messages = await this.initiateConversation(conversation);
          break;

        case "main": // Processa o menu principal
          responsePackage.messages = await this.handleMainMenu(conversation, body, type);
          break;

        case "tag": // Processa o cadastro de TAG
          responsePackage.messages = await this.handleRegisterTag(conversation, body, type);
          break;

        default: // Reinicia o menu principal para contextos desconhecidos
          responsePackage.messages = await this.initiateConversation(conversation);
      }

      // Busca o status da conversa
      const conversationStatus = await ConversationRepository.getConversationStatus(conversation.id);

      //console.log("o status da conversa: ", conversationStatus);

      // Volta o status da conversa para ativo
      if (conversationStatus != "waiting") {
        await ConversationRepository.updateConversationStatus(conversation.id, "active");
      }

    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      responsePackage.status = "error";
      responsePackage.messages = await MessageService.processOutgoingErrorFlow(conversation);
      await ConversationRepository.updateConversationStatus(conversation.id, "error");
    }

    //this.delay(10000);
    return responsePackage;
  }

  private static getNextState(currentSession: string, currentStep: string, input: string | null, isSuccess: boolean): any {

    const session = flowData.flow.sessions[currentSession];

    if (!session) {
      throw new Error(`Sessão "${currentSession}" não encontrada no fluxo.`);
    }

    const step = session.steps[currentStep];

    if (!step) {
      throw new Error(`Passo "${currentStep}" não encontrado na sessão "${currentSession}".`);
    }

    // Determina o próximo estado com base no tipo de transição
    const nextStateKey = isSuccess ? 'successState' : 'errorState';

    let nextStateName = null;

    //console.log("usuasrio digitou: ", input);

    if (input === null || input === undefined) {
      const content = step.content[0]
      nextStateName = content[nextStateKey];
    }
    else {
      for (const contentElement of step.content) {
        if (contentElement.input === input) {

          //console.log("usuasrio digitou: ", input);
          //console.log("usuasrio ", contentElement.input);
          nextStateName = contentElement[nextStateKey];
          break;
        }
      }
    }

    if (!nextStateName) {
      throw new Error(`O próximo estado (${nextStateKey}) não está definido no passo "${currentStep}".`);
    }

    // Divide o próximo estado em sessão e passo
    const [nextSession, nextStep] = nextStateName.split('.');
    const nextSessionData = flowData.flow.sessions[nextSession];


    if (!nextSessionData && nextSession !== "finish") {
      throw new Error(`Sessão "${nextSession}" não encontrada no fluxo.`);
    }

    return { session: nextSession, step: nextStep }
  }

  private static async initiateConversation(conversation: ConversationDTO): Promise<MessageDTO[]> {
    try {
      const nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, null, true);
      await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);
      const responsePackage = this.processOutgoingSuccessMessage(conversation);
      return responsePackage;
    } catch (error) {
      throw new Error("Falha em initiateConversation.");
    }
  }

  private static async handleMainMenu(
    conversation: ConversationDTO,
    body: string,
    type: string
  ): Promise<MessageDTO[]> {

    if (conversation.flow.step !== "start") {
      return MessageService.processOutgoingErrorFlow(conversation);
    }

    const inputData = flowData.flow.sessions[conversation.flow.session].steps[conversation.flow.step];

    if (inputData.expectedInput && !inputData.expectedInput.includes(body)) {
      return MessageService.processOutgoingErrorSession(conversation);
    }

    // Atualiza o fluxo para o próximo estado
    const nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, body, true);
    await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);

    if (nextFlow.session === "finish") {
      await ConversationRepository.updateConversationStatus(conversation.id, "closed");
    }
    return MessageService.processOutgoingSuccessMessage(conversation, body);
  }

  private static async handleRegisterTag(
    conversation: ConversationDTO,
    body: string,
    type: string
  ): Promise<MessageDTO[]> {

    let nextFlow: any

    if (conversation.flow.step === "start") {

      // Remover caracteres não numéricos
      const inputData = body.trim();
      const cpf = inputData.replace(/\D/g, ''); // Remove tudo que não for número

      // Remover caracteres não numéricos
      const isValidFormat = /^\d{11}$/.test(cpf);
      if (!isValidFormat) {
        console.error("CPF inválido: precisa ter exatamente 11 dígitos.");
        return MessageService.processOutgoingErrorSession(conversation);
      }

      // Validar o CPF
      if (!MessageService.validateCPF(cpf)) {
        console.error("CPF inválido: o número informado não é válido.");
        return MessageService.processOutgoingErrorSession(conversation);
      }

      // Consulta o CPF
      const cpfVerified = await NovaApiIntegration.verifyCpf(cpf);

      // Se o CPF não é valido, não inicia o processo e retorna tentativa
      if (cpfVerified.error === true) {

        // Não existente
        if (cpfVerified.message === "not_found") {
          return MessageService.processOutgoingErrorMessage(conversation);
        }

        // Erro genérico
        console.error("Erro ao consultar CPF: " + cpfVerified.message);
        return await MessageService.processOutgoingErrorFlow(conversation);
      }

      // Se o CPF é valido, inicia o processo
      const tagData = await TagRepository.upsertTag(conversation,
        {
          user_id: cpfVerified.content?.id,
          cpf: cpfVerified.content?.cpf,
          name: cpfVerified.content?.nome,
          apartment: cpfVerified.content?.apartamento,
          block: cpfVerified.content?.torre
        });

      if (!tagData) {
        // Erro ao criar TAG
        console.error("Erro ao criar TAG");
        return await MessageService.processOutgoingErrorFlow(conversation);
      }

      nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, null, true);
      await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);
      return MessageService.processOutgoingSuccessMessage(conversation, undefined, [tagData.name, tagData.apartment, tagData.block]);

    }
    else if (conversation.flow.step === "confirmCPF") {

      const inputData = flowData.flow.sessions[conversation.flow.session].steps[conversation.flow.step];

      if (inputData.expectedInput && !inputData.expectedInput.includes(body)) {
        return MessageService.processOutgoingErrorSession(conversation);
      }

      nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, body, true);
      await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);
      return MessageService.processOutgoingSuccessMessage(conversation, body);

    }
    else if (conversation.flow.step === "inputTAG") {

      // Remover caracteres não numéricos
      const inputData = body.trim();
      const tag = inputData.replace(/\D/g, ''); // Remove tudo que não for número

      // Remover caracteres não numéricos
      const isValidFormat = /^\d{10}$/.test(tag);
      if (!isValidFormat) {
        console.error("TAG inválido: precisa ter exatamente 10 dígitos.");
        return MessageService.processOutgoingErrorSession(conversation);
      }

      // Consulta o TAG
      const tagVerified = await NovaApiIntegration.verifyTag(tag);

      // Se o TAG não é invalido, nao inicia o processo e retorna tentativa
      if (tagVerified.error === true) {

        // Ja existente
        if (tagVerified.content) {
          return MessageService.processOutgoingErrorMessage(conversation);
        }

        // Erro genérico
        if (tagVerified.message === "api_fail") {
          console.error("Erro ao consultar TAG: " + tagVerified.message);
          return await MessageService.processOutgoingErrorFlow(conversation);
        }
      }

      // Se o TAG é valido, inicia o processo
      const tagData = await TagRepository.upsertTag(conversation, { tag_number: tagVerified.tag });

      if (!tagData) {
        // Erro ao atualizar TAG
        console.error("Erro ao atualizar TAG");
        return await MessageService.processOutgoingErrorFlow(conversation);
      }

      // Pede foto do TAG
      nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, null, true);
      await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);
      return MessageService.processOutgoingSuccessMessage(conversation);

    }
    else if (conversation.flow.step === "uploadPhotoTAG") {

      if (type != "image") {
        console.error("A mensagem tem que ser uma imagem");
        return MessageService.processOutgoingErrorSession(conversation);
      }

      const buffer = fs.readFileSync(`C:\\nara\\images\\downloads\\${conversation.user_id}\\${body}`);

      // Se não foi possivel abrir a foto
      if (!buffer) {
        console.error("Foto do TAG inválido");
        return MessageService.processOutgoingErrorSession(conversation);
      }

      // Se for uma foto, salva no banco
      const tagData = await TagRepository.upsertTag(conversation, { photo_tag: buffer });

      if (!tagData) {
        // Erro ao atualizar TAG
        console.error("Erro ao atualizar TAG");
        return await MessageService.processOutgoingErrorFlow(conversation);
      }

      // Pede foto do veiculo
      nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, null, true);
      await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);
      return MessageService.processOutgoingSuccessMessage(conversation);

    }
    else if (conversation.flow.step === "uploadPhotoVehicle") {

      try {
        if (type != "image") {
          console.error("A mensagem tem que ser uma imagem");
          return MessageService.processOutgoingErrorSession(conversation);
        }

        const buffer = fs.readFileSync(`C:\\nara\\images\\downloads\\${conversation.user_id}\\${body}`);

        // Se não foi possível abrir a foto
        if (!buffer) {
          console.error("Foto do veículo inválida");
          return MessageService.processOutgoingErrorSession(conversation);
        }

        // Tenta processar a placa
        const imageData = await ImageRecognizerService.recognizePlate(
          `C:\\nara\\images\\downloads\\${conversation.user_id}\\${body}`,
          `C:\\nara\\images\\processed\\${conversation.user_id}`
        );

        if (imageData.error === true) {
          console.error("Erro ao processar placa");
          return MessageService.processOutgoingErrorMessage(conversation);
        }

        // Carrega a foto da placa
        const plateBuffer = fs.readFileSync(imageData.content.imagePath.plate);

        // Se for uma foto, salva no banco
        let tagData = await TagRepository.upsertTag(conversation, {
          photo_vehicle: buffer,
          photo_plate: plateBuffer,
          vehicle_plate: imageData.content.plate,
        });

        if (!tagData) {
          console.error("Erro ao atualizar TAG");
          return await MessageService.processOutgoingErrorFlow(conversation);
        }

        // Informa o processamento
        let nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, null, true);
        await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);
        const intermediateResponse = MessageService.processOutgoingSuccessMessage(conversation)

        // Muda o estado para aguardando processamento
        await ConversationRepository.updateConversationStatus(conversation.id, "waiting");

        // Continua com o processamento após a mensagem intermediária
        setImmediate(async () => {
          try {
            // Atualiza a conversa
            conversation = await ConversationRepository.findActiveByUserId(conversation.user_id);

            // Verifica se não tem registro para essa placa
            const plateInfo = await NovaApiIntegration.verifyPlate(imageData.content.plate);

            console.log("Dados da verificação da iamgem da placa: " + plateInfo)

            let responsePackage: OutgoingMessageDTO

            if (plateInfo.error === false) {
              let nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, null, false);
              await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);
              responsePackage = {
                status: "success",
                userId: conversation.user_id,
                messages: MessageService.processOutgoingErrorMessage(conversation)
              };

              // Introduz um atraso de 5 segundos
              await MessageService.delay(5000);

            }
            else {
              // Consulta a placa
              let plateData = await PlateRecognizerService.consultarPlaca(tagData.vehicle_plate);

              console.log("Dados da placa: " + plateData)

              // Caso falhe ambas as operações, retorna erro
              if (!plateData) {
                console.error("Erro ao consultar placa");
                await MessageService.processOutgoingErrorFlow(conversation);
                return;
              }

              // Se retornou uma placa, salva no banco
              tagData = await TagRepository.upsertTag(conversation, {
                vehicle_brand: plateData.marca,
                vehicle_model: plateData.modelo,
                vehicle_color: plateData.cor,
              });

              if (!tagData) {
                console.error("Erro ao atualizar TAG");
                await MessageService.processOutgoingErrorFlow(conversation);
                return;
              }

              let nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, null, true);
              await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);

              responsePackage = {
                status: "success",
                userId: conversation.user_id,
                messages: MessageService.processOutgoingSuccessMessage(conversation, undefined, [
                  tagData.cpf,
                  tagData.name,
                  tagData.apartment,
                  tagData.block,
                  tagData.tag_number,
                  tagData.vehicle_plate,
                  tagData.vehicle_brand,
                  tagData.vehicle_model,
                  tagData.vehicle_color,
                ])
              };

            }

            // Envia a mensagem final para a fila
            MessageService.sendMessage(MessageService.rabbitMQChannel, responsePackage);
            //console.log("Resposta final enviada");

            // Muda o estado para aguardando processamento
            await ConversationRepository.updateConversationStatus(conversation.id, "active");

          } catch (error) {
            console.error("Erro no processamento assíncrono:", error);
            await MessageService.processOutgoingErrorFlow(conversation);
          }
        });

        // Resposta intermediária
        return intermediateResponse;
      } catch (error) {
        console.error("Erro no processamento:", error);
        await MessageService.processOutgoingErrorFlow(conversation);
      }
    }
    else if (conversation.flow.step === "confirmData") {

      // 1 - SIM
      if (body === "1") {

        // Busca TAG ativa
        let tagData = await TagRepository.readTag(conversation.id);

        if (!tagData) {
          // Erro ao atualizar TAG
          console.error("Erro ao atualizar TAG");
          return await MessageService.processOutgoingErrorFlow(conversation);
        }

        // Registra o veiulo
        const registerVehicleResponse = await NovaApiIntegration.registerVehicle(tagData);

        //console.log("dados que retornoru:", registerVehicleResponse.content.SEQUENCIA)

        if (registerVehicleResponse.error === true) {
          console.error("Erro ao registrar veiculo");
          return await MessageService.processOutgoingErrorFlow(conversation);
        }

        // Se retornou uma placa, salva no banco
        tagData = await TagRepository.upsertTag(conversation, { vehicle_id: registerVehicleResponse.content.SEQUENCIA });

        // Registra o acesso
        const registerAccessResponse = await NovaApiIntegration.registerAccess(tagData);

        if (registerAccessResponse.error === true) {
          console.error("Erro ao registrar o acesso");
          return await MessageService.processOutgoingErrorFlow(conversation);
        }

        nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, body, true);
        await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);
        await ConversationRepository.updateConversationStatus(conversation.id, "executed");

        // Monta relatório
        const responsePackage: OutgoingMessageDTO = {
          status: "success",
          userId: '120363357345869823@g.us',
          messages: [{
            id: 1,
            type: "chat",
            body: "*Nova TAG cadastrada*\n" +
              "\nTAG: " + tagData.tag_number +
              "\nPlaca: " + tagData.vehicle_plate +
              "\nMarca: " + tagData.vehicle_brand +
              "\nModelo: " + tagData.vehicle_model +
              "\nCor: " + tagData.vehicle_color +
              "\nApto: " + tagData.apartment + " " + tagData.block +
              "\nCPF: " + tagData.cpf +
              "\nNome: " + tagData.name,
            timestamp: Date.now().toString()
          }]
        };

        // Envia relatório no grupo
        MessageService.sendMessage(MessageService.rabbitMQChannel, responsePackage);
        //console.log("Resposta final enviada");

        return MessageService.processOutgoingSuccessMessage(conversation, body);
      }

      // 2 - NAO
      if (body === "2") {
        nextFlow = MessageService.getNextState(conversation.flow.session, conversation.flow.step, body, true);
        await ConversationRepository.updateConversationFlow(conversation.id, nextFlow);
        return MessageService.processOutgoingSuccessMessage(conversation, body);
      }

      return MessageService.processOutgoingErrorSession(conversation);
    }

    // Tratamento para caso responsePackage permaneça vazio
    return await MessageService.processOutgoingErrorFlow(conversation);;
  }

  private static replaceDynamicTokens(template: string, values?: (string | number)[]): string {
    if (!values || values.length === 0) {
      return template; // Retorna o template original se não houver valores
    }

    return template.replace(/\$(\d+)/g, (_, index) => {
      const value = values[parseInt(index, 10) - 1];
      return value !== undefined ? String(value) : `$${index}`; // Retorna o token original se não houver valor
    });
  }

  private static processOutgoingSuccessMessage(
    conversation: ConversationDTO,
    body?: string,
    dynamicValues?: (string | number)[]
  ): MessageDTO[] {
    let responsePackage: MessageDTO[] = [];

    const session = flowData.flow.sessions[conversation.flow.session];
    const step = session.steps[conversation.flow.step];

    if (body) {
      for (const contentElement of step.content) {
        if (contentElement.input === body) {
          const newMessages = contentElement.success.map((message) => {
            const processedMessage = MessageService.replaceDynamicTokens(message, dynamicValues);
            return this.processOutgoingMessage(contentElement.type, processedMessage, responsePackage.length + 1);
          }).flat();
          responsePackage.push(...newMessages);
          break;
        }
      }
    } else {
      const newMessages = step.content[0].success.map((message) => {
        const processedMessage = MessageService.replaceDynamicTokens(message, dynamicValues);
        return this.processOutgoingMessage(step.content[0].type, processedMessage, responsePackage.length + 1);
      }).flat();
      responsePackage.push(...newMessages);
    }

    return responsePackage;
  }

  private static processOutgoingErrorMessage(conversation: ConversationDTO): MessageDTO[] {
    let responsePackage: MessageDTO[] = [];

    const session = flowData.flow.sessions[conversation.flow.session];
    const step = session.steps[conversation.flow.step];

    for (const item of step.content) {
      const newMessages = this.processOutgoingMessage("chat", item.error, responsePackage.length + 1);
      responsePackage.push(...newMessages);
    }

    return responsePackage
  }

  private static processOutgoingErrorSession(conversation: ConversationDTO): MessageDTO[] {
    let responsePackage: MessageDTO[] = [];
    const data = flowData.flow.sessions[conversation.flow.session].steps[conversation.flow.step].inputError;

    if (!data)
      return responsePackage

    const newMessages = this.processOutgoingMessage("chat", data, 1);
    responsePackage.push(...newMessages);

    return responsePackage
  }

  private static async processOutgoingErrorFlow(conversation: ConversationDTO): Promise<MessageDTO[]> {

    await ConversationRepository.updateConversationStatus(conversation.id, "error");

    let responsePackage: MessageDTO[] = [];

    const data = flowData.flow.flowError;

    if (!data)
      return responsePackage

    const newMessages = this.processOutgoingMessage("chat", data, 1);
    responsePackage.push(...newMessages);

    return responsePackage
  }

  private static processOutgoingMessage(
    type: string,
    content: string | string[],
    startId: number = 1
  ): MessageDTO[] {
    return Array.isArray(content)
      ? content.map((message, index) => ({
        id: startId + index,
        type,
        body: message,
        timestamp: new Date().toISOString(),
      }))
      : [
        {
          id: startId,
          type,
          body: content,
          timestamp: new Date().toISOString(),
        },
      ];
  }

  private static validateCPF(cpf: string): boolean {
    let sum = 0;
    let rest;

    if (cpf === "00000000000") return false;

    // Valida o primeiro dígito verificador
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(cpf.substring(9, 10))) return false;

    sum = 0;
    // Valida o segundo dígito verificador
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(cpf.substring(10, 11))) return false;

    return true;
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

}
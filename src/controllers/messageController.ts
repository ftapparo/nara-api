import { Request, Response } from "express";
import { MessageService } from "../services/messageService";
import { CustomError } from "../errors/customError";

export class MessageController {
  // Recebe uma mensagem do BOT e processa a lógica
  static async handleIncomingMessage(req: Request, res: Response) {
    try {
      const { userId, body, type, timestamp } = req.body;

      // const response = await MessageService.processIncomingMessage(
      //   userId,
      //   body,
      //   type,
      //   timestamp
      // );

      const response = null

      if (response === null) {
        return res.status(202).send(); // Sem conteúdo a retornar
      }

      return res.status(200).json(response);

    } catch (error: CustomError | any) {
      return res.status(error.statusCode || 500).json(error.message || "Ocorreu um erro inesperado.");
    }
  }
}

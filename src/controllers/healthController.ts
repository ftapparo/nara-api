import { Request, Response } from "express";

export class HealthController {

  // Verifica a saúde da API
  static async checkHealth(req: Request, res: Response) {
    try {
      return res
        .status(200)
        .json({ status: "OK", message: "NARA-API está rodando!" });
    } catch (error: any) {
      console.error("Erro na verificação de saúde:", error.message);
      return res
        .status(500)
        .json({ status: "ERROR", error: "API com problemas." });
    }
  }
}

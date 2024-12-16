// Carrega variáveis de ambiente
import dotenv from "dotenv";
dotenv.config();

// Importacão das bibliotecas
import express, { Express, Request, Response } from "express";
import cors from "cors";
import { setupSwagger } from "./config/swagger";
import { errorHandler } from "./middlewares/errorHandle";
import router from "./routes";


const startAPI = async () => {

  console.log("Iniciando no modo API...");

  const port = process.env.PORT;

  if (!port) {
    console.error("Nenhuma porta definida nas variáveis de ambiente.");
    process.exit(1);
  }

  // Cria uma instância do Express
  const app = express();

  // Configura middlewares globais
  app.use(
    cors({
      origin: ["http://192.168.15.250:3000", "http://localhost:3000"],
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
    next();
  });

  // Configura Swagger
  setupSwagger(app);

  // Configura rotas
  app.use("/api", router);

  // Inicia o servidor
  app.use((req: Request, res: Response) => {
    res.status(404).json({ message: "Rota não encontrada." });
  });

  // Configura middleware de tratamento de erros
  app.use(errorHandler);

  // Inicia o servidor
  app.listen(port, () => { console.log(`Servidor rodando no modo API na porta ${port}`) });

}

startAPI();

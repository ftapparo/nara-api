import swaggerUi from "swagger-ui-express";
import { Express, RequestHandler } from "express";
import * as fs from "fs";
import * as path from "path";

const swaggerDocument = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "./swaggerConfig.json"), "utf-8"),
);

export const setupSwagger = (app: Express) => {
  console.log("Setup Swagger iniciado");
  app.use(
    "/swagger",
    swaggerUi.serve as unknown as RequestHandler,
    swaggerUi.setup(swaggerDocument) as unknown as RequestHandler
  );
};

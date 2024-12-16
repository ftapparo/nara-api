import fs from "fs/promises";
import sharp from "sharp";
import { CustomError } from "../errors/customError";

export class ImageService {

    static async processImage(imagePath: string): Promise<Buffer> {
        try {
            // Verifica se o arquivo existe
            await fs.access(imagePath);

            // Processa a imagem
            const processedImage = await sharp(imagePath)
                .resize({
                    width: 512,
                    height: 512,
                    fit: "cover", // Faz o crop mantendo o centro
                    position: "center",
                })
                .toBuffer(); // Retorna o resultado como buffer

            return processedImage;
        } catch (error: any) {
            console.error("[ERROR] processImage:", error.message);
            throw new CustomError("Falha ao processar a imagem", 500);
        }
    }
}

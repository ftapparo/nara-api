import axios from "axios";
import fs from "fs";
import sharp from "sharp";
import path from "path";
import FormData from "form-data";

export class ImageRecognizerService {
    private static apiUrl = "https://api.platerecognizer.com/v1/plate-reader/";
    private static token = "81f48083c60344ff7635d28f5197da9ec97d4d69";

    /**
     * Envia uma imagem para a API do PlateRecognizer, recorta a placa e salva a imagem
     * @param imagePath Caminho da imagem original
     * @param outputDir Diretório de saída para salvar a imagem recortada
     * @returns Texto da placa e informações adicionais
     */
    public static async recognizePlate(imagePath: string, outputDir: string): Promise<{ error: boolean; content: any }> {
        try {
            // Cria o formulário para envio
            const form = new FormData();
            form.append("upload", fs.createReadStream(imagePath)); // Adiciona a imagem

            // Configura o cabeçalho com o token e o tipo de conteúdo do formulário
            const headers = {
                ...form.getHeaders(),
                Authorization: `Token ${this.token}`,
            };

            // Faz a requisição para a API
            const response = await axios.post(this.apiUrl, form, { headers });
            const result = response.data;

            // Verifica se placas foram detectadas
            if (result.results && result.results.length > 0) {
                const plateInfo = result.results[0];
                const box = plateInfo.box; // Coordenadas da caixa delimitadora

                if (plateInfo.plate && plateInfo.score > 0.9) {

                    console.log(plateInfo);

                    // Processa a imagem original para recortar a região da placa
                    const outputImagePath = await this.cropPlateRegion(imagePath, box, outputDir);
                    console.log(`Placa recortada salva em: ${outputImagePath}`);

                    // Retorna informações da placa e o caminho da imagem recortada
                    return {
                        error: false,
                        content: {
                            plate: plateInfo.plate.toUpperCase(),
                            imagePath: outputImagePath,
                            confidence: plateInfo.score,
                        }
                    };
                }
                return { error: true, content: null };
            } else {
                console.warn("Nenhuma placa detectada na imagem.");
                return { error: true, content: null };
            }
        } catch (error: any) {
            console.error("Erro ao acessar a API do PlateRecognizer:", error.message);
            if (error.response) {
                console.error("Detalhes do erro:", error.response.data);
            }
            throw new Error("Falha ao reconhecer a placa.");
        }
    }

    /**
     * Recorta a região da placa na imagem e salva em um novo arquivo
     * @param imagePath Caminho da imagem original
     * @param box Coordenadas da caixa delimitadora da placa {xmin, ymin, xmax, ymax}
     * @param outputDir Diretório de saída para salvar a imagem recortada
     * @returns Caminho do arquivo recortado
     */
    private static async cropPlateRegion(
        imagePath: string,
        box: { xmin: number; ymin: number; xmax: number; ymax: number },
        outputDir: string
    ): Promise<{ plate: string; vehicle: string }> {
        try {
            const buffer = fs.readFileSync(imagePath);

            // Calcula as dimensões e corta a região da placa
            const croppedImageBuffer = await sharp(buffer)
                .extract({
                    left: box.xmin,
                    top: box.ymin,
                    width: box.xmax - box.xmin,
                    height: box.ymax - box.ymin,
                })
                .resize({
                    width: 512
                })
                .toBuffer();

            // Verifica e cria o diretório de saída se necessário
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Salva a imagem recortada
            const outputPlateFileName = `plate_${Date.now()}.jpeg`;
            const outputPlateImagePath = path.join(outputDir, outputPlateFileName);
            fs.writeFileSync(outputPlateImagePath, croppedImageBuffer);

            // Salva a imagem do veiculo
            const outputVehicleFileName = `vehicle_${Date.now()}.jpeg`;
            const outputVehicleImagePath = path.join(outputDir, outputVehicleFileName);
            fs.writeFileSync(outputVehicleImagePath, buffer);

            return {
                plate: outputPlateImagePath,
                vehicle: outputVehicleImagePath
            }
        } catch (error: any) {
            console.error("Erro ao recortar a região da placa:", error.message);
            throw new Error("Falha ao recortar a placa.");
        }
    }
}

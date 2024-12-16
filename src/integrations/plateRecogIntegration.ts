import axios from 'axios';
import puppeteer, { Browser, Page } from 'puppeteer';

export class PlateRecognizerService {
    private static browser: Browser | null = null;
    private static page: Page | null = null;

    // Inicializa o navegador
    private static async launchBrowser(): Promise<{ browser: Browser; page: Page }> {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
            ],
        });

        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1366, height: 768 });

        return { browser, page };
    }

    // Consulta a placa no KePlaca
    public static async consultarKePlaca(placa: string): Promise<Record<string, string>> {
        const { browser, page } = await this.launchBrowser();

        try {

            const url = `https://www.keplaca.com/placa?placa-fipe=${placa}`;
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Extração de dados
            const dados = await page.evaluate(() => {
                const getValue = (selector: string): string =>
                    document.querySelector(selector)?.textContent?.trim() || '';

                return {
                    marca: getValue('table.fipeTablePriceDetail tr:nth-child(1) td:nth-child(2)').toUpperCase(),
                    modelo: getValue('table.fipeTablePriceDetail tr:nth-child(2) td:nth-child(2)').toUpperCase(),
                    cor: getValue('table.fipeTablePriceDetail tr:nth-child(6) td:nth-child(2)').toUpperCase(),
                };
            });

            return dados;
        } catch (error) {
            console.error(`Erro ao consultar a placa ${placa}:`, error);
            return { marca: '', modelo: '', cor: '' }; // Retorno padrão em caso de erro
        } finally {
            await browser.close();
        }

    }

    // Consulta a placa no PlacaFipe
    public static async consultarPlacaFipe(placa: string): Promise<Record<string, string>> {
        const { browser, page } = await this.launchBrowser();

        try {
            const url = `https://placafipe.com/placa/${placa}`;
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Extração de dados
            const dados = await page.evaluate(() => {
                const getValue = (selector: string): string =>
                    document.querySelector(selector)?.textContent?.trim() || '';

                return {
                    marca: getValue('table.fipeTablePriceDetail tr:nth-child(1) td:nth-child(2)').toUpperCase(),
                    modelo: getValue('table.fipeTablePriceDetail tr:nth-child(3) td:nth-child(2)').toUpperCase(),
                    cor: getValue('table.fipeTablePriceDetail tr:nth-child(7) td:nth-child(2)').toUpperCase(),
                };
            });


            return dados;
        } catch (error) {
            console.error(`Erro ao consultar a placa ${placa}:`, error);
            return { marca: '', modelo: '', cor: '' }; // Retorno padrão em caso de erro
        } finally {
            await browser.close();
        }
    }

    // Consulta a placa no ApiPlacas
    public static async consultarApiPlacas(placa: string): Promise<Record<string, string>> {
        try {
            const url = `https://wdapi2.com.br/consulta/${placa}/f5659a01059cc637a088d0c1f784c316`;

            const response = await axios.get(url);

            if (response.status !== 200) {
                console.error(`Erro ao consultar a placa ${placa}.`);
                return { marca: '', modelo: '', cor: '' }; // Retorno padrão em caso de erro
            }

            return {
                marca: response.data.MARCA.toUpperCase(),
                modelo: response.data.MODELO.toUpperCase(),
                cor: response.data.cor.toUpperCase(),
            };

        } catch (error) {
            console.error(`Erro ao consultar a placa ${placa}:`, error);
            return { marca: '', modelo: '', cor: '' }; // Retorno padrão em caso de erro
        }
    }

    // Finaliza o navegador
    public static async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    public static async consultarPlaca(placa: string): Promise<Record<string, string>> {
        let dados: Record<string, string> = {};

        // Tentativa com a KePlaca
        try {
            dados = await this.consultarKePlaca(placa);
            if (this.validarDados(dados)) {
                console.log("Dados obtidos da KePlaca:", dados);
                return dados;
            }
        } catch (error) {
            console.warn("Erro na consulta KePlaca ou dados inválidos. Tentando a próxima...", error);
        }

        // Tentativa com a PlacaFipe
        try {
            dados = await this.consultarPlacaFipe(placa);
            if (this.validarDados(dados)) {
                console.log("Dados obtidos da PlacaFipe:", dados);
                return dados;
            }
        } catch (error) {
            console.warn("Erro na consulta PlacaFipe ou dados inválidos. Tentando a próxima...", error);
        }

        // Tentativa com a ApiPlacas (serviço pago)
        try {
            dados = await this.consultarApiPlacas(placa);
            if (this.validarDados(dados)) {
                console.log("Dados obtidos da ApiPlacas:", dados);
                return dados;
            }
        } catch (error) {
            console.error("Erro na consulta ApiPlacas ou dados inválidos.", error);
        }

        // Se nenhum serviço retornou dados válidos
        throw new Error("Nenhum serviço conseguiu retornar dados válidos para a placa informada.");
    }

    // Método para validar se os dados são completos e válidos
    private static validarDados(dados: Record<string, string>): boolean {
        return Boolean(
            dados.marca && dados.marca !== '' &&
            dados.modelo && dados.modelo !== '' &&
            dados.cor && dados.cor !== ''
        );
    }
}

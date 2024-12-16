import dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";

// Configuração do banco de dados usando variáveis de ambiente
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "nara",
  password: process.env.DB_PASSWORD || "password",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  max: 10, // Número máximo de conexões no pool
  idleTimeoutMillis: 30000, // Tempo antes de uma conexão inativa ser encerrada
  connectionTimeoutMillis: 2000, // Tempo para tentar conectar antes de dar timeout
});

// Testar conexão no momento da inicialização
(async () => {
  try {
    const client = await pool.connect();
    console.log("Conexão com o banco de dados estabelecida com sucesso!");
    client.release(); // Liberar conexão após o teste
  } catch (error) {
    if (error instanceof Error) {
      console.error("Erro:", error.message);
    } else {
      console.error("Erro desconhecido:", error);
    }
    process.exit(1); // Encerra o processo em caso de erro crítico
  }
})();

export default pool;

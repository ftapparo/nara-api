import pool from "../config/db";
import fs from "fs";

export class MessageRepository {
  // Cria um novo registro de mensagem no banco de dados
  static async createMessage(conversationId: number, sender: string, message: string, type: string, timestamp: string) {
    const query = `
            INSERT INTO messages (conversation_id, sender, message, type, timestamp)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
    const values = [conversationId, sender, message, type, timestamp];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  //  Busca mensagens por ID de conversa
  static async findByConversationId(conversationId: number) {
    const query = `
            SELECT * FROM messages
            WHERE conversation_id = $1
            ORDER BY timestamp ASC;
        `;
    const { rows } = await pool.query(query, [conversationId]);
    return rows;
  }
}

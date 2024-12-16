import pool from "../config/db";
import { ConversationDTO } from "../dtos/conversationDTO";

export class ConversationRepository {

  static async createConversation(userId: string, status: string, flow: any, step: string): Promise<ConversationDTO> {
    const now = new Date();
    const query = `
            INSERT INTO conversations (user_id, status, flow, step, last_activity, updated_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
    const values = [userId, status, JSON.stringify(flow), step, now, now, now];

    try {
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error: any) {
      console.error('Erro ao criar conversa:', error.message);
      throw new Error('Falha ao inserir no banco de dados. Por favor, tente novamente.');
    }
  }

  static async findActiveByUserId(userId: string): Promise<ConversationDTO> {
    const query = `
            SELECT * FROM conversations
            WHERE user_id = $1 AND status NOT IN ('closed', 'error', 'executed', 'timeout')	;
        `;

    try {
      const { rows } = await pool.query(query, [userId]);
      return rows[0];
    } catch (error: any) {
      console.error('Erro ao consultar conversa ativa:', error.message);
      throw new Error('Falha ao consultar conversa ativa.');
    }
  }

  static async updateConversationStatus(conversationId: number, status: string) {
    const now = new Date();

    // Verificar se o status atual é "closed"
    const query = `
            SELECT * FROM conversations
            WHERE id = $1 AND status NOT IN ('closed', 'error', 'executed', 'timeout');
        `;

    try {
      const { rows: checkRows } = await pool.query(query, [conversationId]);

      if (checkRows.length === 0) {
        //console.log("Nenhum registro encontrado");
        return null;
      }

      if (checkRows[0].status === "closed" || checkRows[0].status === "error" || checkRows[0].status === "executed") {
        //console.log("O status da conversa é 'closed', 'error' ou 'executed'");
        return null;
      }

      //console.log("passou aqui");

      // Atualizar o status
      const updateQuery = `
      UPDATE conversations
      SET status = $1, updated_at = $2
      WHERE id = $3
      RETURNING *;
    `;
      const values = [status, now, conversationId];
      const { rows } = await pool.query(updateQuery, values);

      return rows[0];
    } catch (error: any) {
      console.error("Erro ao atualizar status da conversa:", error.message);
      throw new Error("Falha ao atualizar status da conversa.");
    }
  }

  static async getConversationStatus(conversationId: number) {
    const query = `
            SELECT status FROM conversations
            WHERE id = $1;
        `;
    const values = [conversationId];

    try {
      const { rows } = await pool.query(query, values);
      return rows[0].status;
    } catch (error: any) {
      console.error('Erro ao consultar status da conversa:', error.message);
      throw new Error('Falha ao consultar status da conversa');
    }
  }

  static async updateConversationFlow(conversationId: number, flow: any): Promise<ConversationDTO> {
    const now = new Date();
    const query = `
            UPDATE conversations
            SET flow = $1, updated_at = $2
            WHERE id = $3
            RETURNING *;
        `;
    const values = [flow, now, conversationId];

    try {
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error: any) {
      console.error('Erro ao atualizar contexto da conversa:', error.message);
      throw new Error('Falha ao atualizar contexto da conversa.');
    }
  }

  static async updateLastActivity(conversationId: number) {
    const now = new Date();
    const query = `
            UPDATE conversations
            SET last_activity = $1, updated_at = $1
            WHERE id = $2
            RETURNING *;
        `;
    const values = [now, conversationId];

    try {
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error: any) {
      console.error('Erro ao atualizar ultima atividade da conversa:', error.message);
      throw new Error('Falha ao atualizar ultima atividade da conversa.');
    }
  }

  static async invalidateConversations(timeoutMinutes = 0) {
    try {
      // Hora limite calculada
      const currentTime = new Date();
      currentTime.setMinutes(currentTime.getMinutes() - timeoutMinutes);

      // Obtenha os registros do banco de dados
      const selectQuery = `
      SELECT id, last_activity
      FROM conversations
      WHERE status NOT IN ('closed', 'error', 'executed', 'timeout');
    `;

      const result = await pool.query(selectQuery);
      const conversations = result.rows;

      // Verifica e atualiza cada registro
      const toUpdate: any[] = [];
      conversations.forEach((conversation) => {
        const lastActivityDate = new Date(conversation.last_activity);
        if (lastActivityDate < currentTime) {
          toUpdate.push(conversation.id);
        }
      });

      // Atualiza os registros que precisam ser invalidados
      if (toUpdate.length > 0) {
        const updateQuery = `
        UPDATE conversations
        SET status = 'timeout'
        WHERE id = ANY($1::int[]);
      `;
        const updateResult = await pool.query(updateQuery, [toUpdate]);

        console.log(`[${new Date().toISOString()}] Registros invalidados: ${updateResult.rowCount}`);
      } else {
        console.log(`[${new Date().toISOString()}] Nenhum registro para invalidar.`);
      }

      return;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Erro ao invalidar conversas:`, error);
    }
  }

}

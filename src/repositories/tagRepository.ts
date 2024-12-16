import pool from "../config/db";
import { ConversationDTO } from "../dtos/conversationDTO";
import { TagDTO } from "../dtos/tagDTO";

export class TagRepository {

    static async updateTag(userId: string, updates: Partial<TagDTO>): Promise<TagDTO> {
        // Busca o registro atual no banco
        const selectQuery = `
      SELECT * FROM tags WHERE conversation_id = $1 AND user_validation = 'pending';
    `;

        try {
            const { rows } = await pool.query(selectQuery, [userId]);

            if (rows.length === 0) {
                throw new Error(`Nenhum registro não encontrado.`);
            }

            // Registro atual
            const currentTag: TagDTO = rows[0];

            // Cria uma nova versão dos dados com as atualizações
            const updatedTag: TagDTO = {
                ...currentTag,
                ...updates, // Sobrescreve os campos com os valores fornecidos em `updates`
                updated_at: new Date(), // Atualiza o timestamp
            };

            // Atualiza o registro no banco
            const updateQuery = `
        UPDATE tags
        SET 
          user_id = $1,
          cpf = $2,
          name = $3,
          block = $4,
          apartment = $5,
          tag_number = $6,
          vehicle_plate = $7,
          vehicle_brand = $8,
          vehicle_model = $9,
          vehicle_color = $10,
          photo_tag = $11,
          photo_plate = $12,
          photo_vehicle = $13,
          user_validation = $14,
          api_validation = $15,
          api_error = $16,
          updated_at = $17
        WHERE id = $18
        RETURNING *;
      `;

            const values = [
                updatedTag.user_id,
                updatedTag.cpf,
                updatedTag.name,
                updatedTag.block,
                updatedTag.apartment,
                updatedTag.tag_number,
                updatedTag.vehicle_plate,
                updatedTag.vehicle_brand,
                updatedTag.vehicle_model,
                updatedTag.vehicle_color,
                updatedTag.photo_tag,
                updatedTag.photo_plate,
                updatedTag.photo_vehicle,
                updatedTag.user_validation,
                updatedTag.api_validation,
                updatedTag.api_error,
                updatedTag.updated_at,
                updatedTag.id,
            ];

            const updateResult = await pool.query(updateQuery, values);

            return updateResult.rows[0]; // Retorna o registro atualizado
        } catch (error: any) {
            console.error("Erro ao atualizar TAG:", error.message);
            throw new Error("Falha ao atualizar o registro da TAG.");
        }
    }

    static async upsertTag(conversation: ConversationDTO, data: Partial<TagDTO>): Promise<TagDTO> {
        const selectQuery = `
        SELECT * FROM tags WHERE conversation_id = $1 AND user_validation = 'pending';
    `;
        const insertQuery = `
        INSERT INTO tags (
            conversation_id, user_id, vehicle_id, cpf, name, block, apartment, tag_number,
            vehicle_plate, vehicle_brand, vehicle_model, vehicle_color, 
            photo_tag, photo_plate, photo_vehicle, user_validation, api_validation, api_error, updated_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
        RETURNING *;
    `;
        const updateQuery = `
        UPDATE tags
        SET 
            user_id = $1,
            vehicle_id = $2,
            cpf = $3,
            name = $4,
            block = $5,
            apartment = $6,
            tag_number = $7,
            vehicle_plate = $8,
            vehicle_brand = $9,
            vehicle_model = $10,
            vehicle_color = $11,
            photo_tag = $12,
            photo_plate = $13,
            photo_vehicle = $14,
            user_validation = $15,
            api_validation = $16,
            api_error = $17,
            updated_at = $18
        WHERE id = $19
        RETURNING *;
    `;

        try {
            // Verifica se existe um registro pendente
            const { rows: existingTags } = await pool.query(selectQuery, [conversation.id]);

            const timestamp = new Date();

            if (existingTags.length > 0) {
                // Atualiza o registro existente
                const currentTag = existingTags[0];

                const updatedTag = {
                    ...currentTag,
                    ...data, // Atualiza os campos com os valores fornecidos
                    updated_at: timestamp, // Atualiza o timestamp
                };

                const updateValues = [
                    updatedTag.user_id,
                    updatedTag.vehicle_id,
                    updatedTag.cpf,
                    updatedTag.name,
                    updatedTag.block,
                    updatedTag.apartment,
                    updatedTag.tag_number,
                    updatedTag.vehicle_plate,
                    updatedTag.vehicle_brand,
                    updatedTag.vehicle_model,
                    updatedTag.vehicle_color,
                    updatedTag.photo_tag,
                    updatedTag.photo_plate,
                    updatedTag.photo_vehicle,
                    updatedTag.user_validation,
                    updatedTag.api_validation,
                    updatedTag.api_error,
                    updatedTag.updated_at,
                    updatedTag.id,
                ];

                const updateResult = await pool.query(updateQuery, updateValues);
                return updateResult.rows[0]; // Retorna o registro atualizado
            } else {
                // Cria um novo registro
                const insertValues = [
                    conversation.id,
                    data.user_id || null,
                    data.vehicle_id || null,
                    data.cpf || null,
                    data.name || null,
                    data.block || null,
                    data.apartment || null,
                    data.tag_number || null,
                    data.vehicle_plate || null,
                    data.vehicle_brand || null,
                    data.vehicle_model || null,
                    data.vehicle_color || null,
                    data.photo_tag || null,
                    data.photo_plate || null,
                    data.photo_vehicle || null,
                    data.user_validation || 'pending',
                    data.api_validation || null,
                    data.api_error || null,
                    timestamp,
                ];

                const insertResult = await pool.query(insertQuery, insertValues);
                return insertResult.rows[0]; // Retorna o registro criado
            }
        } catch (error: any) {
            console.error('Erro ao inserir ou atualizar TAG:', error.message);
            throw new Error('Falha ao inserir ou atualizar TAG.');
        }
    }

    static async readTag(conversation_id: string | number,): Promise<TagDTO> {
        // Busca o registro atual no banco
        const selectQuery = `
      SELECT * FROM tags WHERE conversation_id = $1 AND user_validation = 'pending';
    `;

        try {
            const { rows } = await pool.query(selectQuery, [conversation_id]);

            if (rows.length === 0) {
                throw new Error(`Nenhum registro não encontrado.`);
            }

            // Registro atual
            const currentTag: TagDTO = rows[0];

            return currentTag; // Retorna o registro atualizado
        } catch (error: any) {
            console.error("Erro ao atualizar TAG:", error.message);
            throw new Error("Falha ao atualizar o registro da TAG.");
        }
    }

}
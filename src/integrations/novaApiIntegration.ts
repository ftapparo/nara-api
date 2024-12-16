import axios from "axios";
import { TagDTO } from "../dtos/tagDTO";

export class NovaApiIntegration {
    static async getUserByPhone(phoneNumber: string) {
        try {
            // Monta a query SQL
            const query = {
                query: `SELECT * FROM PESSOAS WHERE TELCELULAR = '${phoneNumber}'`
            };

            // Faz a requisição à NOVA-API
            const response = await axios.post(
                `${process.env.NOVA_API_URL}/query`,
                query
            );

            if (response.data.status === 'success') {
                // Verifica se a resposta contém dados
                if (response.data.data && response.data.data.length > 0) {
                    return response.data.data[0]; // Retorna o primeiro registro encontrado
                } else {
                    return null; // Caso não encontre o usuário
                }
            }
        } catch (error) {
            console.error("Erro ao consultar NOVA-API:", error);
            return null;
        }
    }

    static async verifyCpf(cpf: string) {
        try {
            // Remove caracteres não numéricos e valida o CPF
            const sanitizedCpf = cpf.replace(/\D/g, ""); // Remove tudo que não for número

            if (sanitizedCpf.length !== 11) {
                return { error: true, message: "invalid" };
            }

            // Monta a query SQL
            const query = {
                query: `SELECT p.SEQUENCIA, p.CPF, p."NOME", u.QUADRA, u.LOTE
                FROM PESSOAS p 
                INNER JOIN PESSOASVINC p2 ON p2.SEQPESSOA = p.SEQUENCIA 
                INNER JOIN UNIDADES u ON u.SEQUENCIA = p2.SEQUNIDADE  
                WHERE p."CPF" = '${sanitizedCpf}'`
            };

            // Faz a requisição à NOVA-API
            const response = await axios.post(
                `${process.env.NOVA_API_URL}/query`,
                query
            );

            if (response.data.status === "success") {
                // Verifica se a resposta contém dados
                if (response.data.data && response.data.data.length > 0) {

                    const userData = response.data.data[0];

                    return {
                        error: false,
                        content: {
                            id: userData.SEQUENCIA,
                            cpf: userData.CPF.trim(),
                            nome: userData.NOME.trim(),
                            apartamento: userData.LOTE.trim(),
                            torre: userData.QUADRA.trim(),
                        }
                    }; // Retorna sucesso
                } else {
                    return { error: true, message: "not_found" }; // Caso não encontre o usuário
                }
            }

            // Se a API não retornar 'success'
            return { error: true, message: "api_fail" };
        } catch (error) {
            console.error("Erro ao consultar NOVA-API:", error);
            return { error: true, message: "api_error" };
        }
    }

    static async verifyTag(tag: string) {
        try {
            // Remove caracteres não numéricos e valida o TAG
            const sanitizedTag = tag.replace(/\D/g, ""); // Remove tudo que não for número

            if (sanitizedTag.length !== 10) {
                return { error: true, tag: sanitizedTag, message: "invalid" };
            }

            // Monta a query SQL
            const query = {
                query: `SELECT v.SEQUENCIA, v.PLACA, v.MARCA, v.MODELO, v.COR, v.SEQUNIDADE, v.PROPRIETARIO, v.TAGVEICULO FROM VEICULOS v 
                WHERE v.TAGVEICULO = '${sanitizedTag}'`
            };

            // Faz a requisição à NOVA-API
            const response = await axios.post(
                `${process.env.NOVA_API_URL}/query`,
                query
            );

            if (response.data.status === "success") {

                // Verifica se a resposta contém dados
                if (response.data.data && response.data.data.length > 0) {
                    return { error: true, tag: sanitizedTag, content: response.data.data }; // Retorna sucesso
                } else {
                    return { error: false, tag: sanitizedTag, message: "not_found" }; // Caso não encontre o TAG
                }
            }

            // Se a API não retornar 'success'
            return { error: true, tag: sanitizedTag, message: "api_fail" };
        } catch (error) {
            console.error("Erro ao consultar NOVA-API:", error);
            return { error: true, message: "api_error" };
        }
    }

    static async verifyPlate(plate: string) {
        try {
            const vehiclePlate = plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
            const regex = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

            const isValidPlate = regex.test(vehiclePlate);

            if (!isValidPlate) {
                return { error: true, plate: vehiclePlate, message: "invalid" };
            }

            // Monta a query SQL
            const query = {
                query: `SELECT v.SEQUENCIA, v.PLACA, v.MARCA, v.MODELO, v.COR, v.SEQUNIDADE, v.PROPRIETARIO, v.TAGVEICULO FROM VEICULOS v 
                WHERE v.PLACA = '${vehiclePlate}'`
            };

            // Faz a requisição à NOVA-API
            const response = await axios.post(
                `${process.env.NOVA_API_URL}/query`,
                query
            );

            if (response.data.status === "success") {
                // Verifica se a resposta contém dados
                if (response.data.data && response.data.data.length > 0) {
                    return { error: false, plate: vehiclePlate, content: response.data.data }; // Retorna sucesso
                } else {
                    return { error: true, plate: vehiclePlate, message: "not_found" }; // Caso não encontre a placa
                }
            }

            // Se a API não retornar 'success'
            return { error: true, plate: vehiclePlate, message: "api_fail" };
        } catch (error) {
            console.error("Erro ao consultar NOVA-API:", error);
            return { error: true, message: "api_error" };
        }
    }

    static async registerVehicle(updates: Partial<TagDTO>) {
        try {

            // Faz a requisição à NOVA-API
            let response = await axios.post(`${process.env.NOVA_API_URL}/registerVehicle`, {
                plate: String(updates.vehicle_plate),
                brand: String(updates.vehicle_brand),
                model: String(updates.vehicle_model),
                color: String(updates.vehicle_color),
                user_seq: String(updates.user_id),
                unit_seq: '0',
                tag: String(updates.tag_number)
            });

            const content = response.data

            if (content.status === "success") {

                // Verifica se a resposta contém dados
                if (content.data.SEQUENCIA) {
                    if (updates.photo_tag !== undefined && updates.photo_vehicle !== undefined) {
                        const photoTagBlob = new Blob([Buffer.from(updates.photo_tag)], { type: 'image/jpeg' });
                        const photoVehicleBlob = new Blob([Buffer.from(updates.photo_vehicle)], { type: 'image/jpeg' });

                        console.log("SEQUENCIA: ", content.data.SEQUENCIA)

                        const formData = new FormData();
                        formData.append('vehicleSequence', content.data.SEQUENCIA); // Sequência do veículo
                        formData.append('photoTag', photoTagBlob); // Arquivo do input de foto da TAG
                        formData.append('photoVehicle', photoVehicleBlob); // Arquivo do input de foto do veículo

                        response = await axios.post(`${process.env.NOVA_API_URL}/registerVehiclePhoto`, formData);

                        if (content.status === "success") {
                            return { error: false, message: "success", content: content.data };
                        }
                    }
                }
            }

            // Se a API não retornar 'success'
            return { error: true, message: "api_fail", content: null };
        } catch (error) {
            //console.error("Erro ao consultar NOVA-API:", error);
            return { error: true, message: "api_error", content: null };
        }
    }

    static async registerAccess(updates: Partial<TagDTO>) {
        try {

            // Faz a requisição à NOVA-API
            const response = await axios.post(`${process.env.NOVA_API_URL}/registerAccess`, {
                personSequence: String(updates.user_id),
                type: 'Y',
                panic: 'N',
                id2: String(updates.tag_number),
                user: 'NARA',
                vehicleSequence: String(updates.vehicle_id)
            });

            const content = response.data

            if (content.status === "success") {
                return { error: false, message: "success", content: null };
            }

            // Se a API não retornar 'success'
            return { error: true, message: "api_fail", content: null };
        } catch (error) {
            // console.error("Erro ao consultar NOVA-API:", error);
            return { error: true, message: "api_error", content: null };
        }
    }
}

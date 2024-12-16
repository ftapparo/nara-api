export interface TagDTO {
    id: number;
    user_id: string;
    conversation_id: number;
    cpf: string;
    name: string;
    block: string;
    apartment: string;
    tag_number: string;
    vehicle_id: string;
    vehicle_plate: string;
    vehicle_brand: string;
    vehicle_model: string;
    vehicle_color: string;
    photo_tag: Buffer | string;
    photo_plate: Buffer | string;
    photo_vehicle: Buffer | string;
    user_validation: string; // Status de validação do usuário ('confirmed', 'rejected', 'expired', 'error')
    api_validation: string; // Status de envio para NOVA-API ('pending', 'success', 'failed')
    api_error: string;
    updated_at: Date;
    created_at?: Date;
}
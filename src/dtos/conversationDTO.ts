import { FlowDTO, FlowSession, FlowStep } from "./flowDTO";

export interface ConversationDTO {
    id: number;
    user_id: string;
    status: string;
    flow: {
        session: string;
        step: string;
    };
    step: string;
    last_activity: Date;
    updated_at: Date;
    created_at?: Date;
}

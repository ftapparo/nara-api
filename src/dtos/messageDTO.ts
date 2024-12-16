export interface OutgoingMessageDTO {
    status: string;
    userId: string;
    messages: MessageDTO[];
}
export interface MessageDTO {
    id: number;
    type: string;
    body: string;
    timestamp: string;
}


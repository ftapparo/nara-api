// export interface FlowContent {
//     input: string | null;
//     type: string;
//     success: string[]; // Mensagens de sucesso em cada passo
//     error: string[]; // Mensagens de erro específicas do passo
//     successState: string | null; // Próximo estado em caso de sucesso
//     errorState: string | null; // Próximo estado em caso de erro
// }

// export interface FlowStep {
//     expectedInput: string[] | null; // Entradas esperadas para validação
//     inputError: string | null; // Mensagem de erro para entradas inválidas
//     content: FlowContent[]; // Lista de conteúdos (passos) dentro do estado
// }

// export interface FlowSession {
//     stateName: string; // Nome da sessão (e.g., "greetings", "main", "tag")
//     steps: { [key: string]: FlowStep }; // Estados dentro da sessão (e.g., "start", "confirmCPF")
// }

// export interface Flow {
//     sessions: { [key: string]: FlowSession }; // Mapeia cada sessão do fluxo
// }

export interface FlowDTO {
    version: string;
    description: string;
    flow: {
        sessions: Record<string, FlowSession>; // Aceita qualquer chave string
        flowError: string[] | null;
    };
}

export interface FlowSession {
    stateName: string;
    steps: Record<string, FlowStep>;
}

export interface FlowStep {
    expectedInput: string[] | null;
    inputError: string | null;
    content: FlowContent[];
}

export interface FlowContent {
    input: string | null;
    type: string;
    success: string[];
    error: string[];
    successState: string | null;
    errorState: string | null;
}

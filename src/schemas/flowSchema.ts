import { z } from 'zod';

// Defina o schema de FlowContent
const flowContentSchema = z.object({
    input: z.string().nullable(),
    type: z.string(),
    success: z.array(z.string()),
    error: z.array(z.string()),
    successState: z.string().nullable(),
    errorState: z.string().nullable(),
});

// Defina o schema de FlowStep
const flowStepSchema = z.object({
    expectedInput: z.array(z.string()).nullable(),
    inputError: z.string().nullable(),
    content: z.array(flowContentSchema),
});

// Defina o schema de FlowSession
const flowSessionSchema = z.object({
    stateName: z.string(),
    steps: z.record(flowStepSchema),
});

// Defina o schema principal do Flow
export const flowSchema = z.object({
    version: z.string(),
    description: z.string(),
    flow: z.record(flowSessionSchema),
});

// Inferir o tipo TypeScript a partir do schema
export type Flow = z.infer<typeof flowSchema>;

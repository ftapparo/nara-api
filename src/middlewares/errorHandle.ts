import { Request, Response, NextFunction } from "express";
import { CustomError } from "../errors/customError";

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    if (err instanceof CustomError) {
        console.error(`[CustomError] ${err.message}`);
        return res.status(err.statusCode).json({ error: err.message });
    }

    console.error(`[UnhandledError]`, err);

    return res.status(500).json({
        error: "Ocorreu um erro inesperado. Por favor, tente novamente mais tarde.",
    });
}

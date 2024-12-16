import { Router } from "express";
import messageRoutes from "./messageRoutes";
import healthRoutes from "./healthRoutes";

const router = Router();

// Rota raiz para mensagens
router.use("/messages", messageRoutes);

// Rota para verificação de saúde
router.use("/health", healthRoutes);

export default router;

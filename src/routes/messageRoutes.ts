import { Router } from "express";
import { MessageController } from "../controllers/messageController";

const router = Router();

// Processa uma mensagem recebida do BOT
router.post("/incoming", (req, res) => {
  MessageController.handleIncomingMessage(req, res);
});

export default router;

import { Router } from "express";
import { HealthController } from "../controllers/healthController";

const router = Router();

// Verifica a saúde da API
router.get("/teste", (req, res) => {
  HealthController.checkHealth(req, res);
});

export default router;

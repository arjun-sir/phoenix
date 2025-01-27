import express, { RequestHandler } from "express";
import { login, register, logout } from "../controllers/auth";
import { refreshAccessToken, authenticateToken } from "../middlewares/auth";

const router = express.Router();

router.post("/register", register as RequestHandler);
router.post("/login", login as RequestHandler);
router.post("/refresh", refreshAccessToken as RequestHandler);
router.post("/logout", authenticateToken as RequestHandler, logout);

export default router;

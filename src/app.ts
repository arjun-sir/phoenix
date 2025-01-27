import express from "express";
import gadgetRoutes from "./routes/gadgets";
import authRoutes from "./routes/auth";
import { authenticateToken } from "./middlewares/auth";
import { apiRateLimiter } from "./middlewares/rateLimiter";
import { RequestHandler } from "express";

const app = express();

// Trust proxy headers (needed for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

app.use(express.json());

// Apply rate limiter to all gadgets routes
app.use("/gadgets", apiRateLimiter);

app.use("/auth", authRoutes);
app.use("/gadgets", authenticateToken as RequestHandler, gadgetRoutes);

export default app;

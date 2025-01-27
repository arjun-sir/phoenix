import express from "express";
import gadgetRoutes from "./routes/gadgets";
import authRoutes from "./routes/auth";
import { authenticateToken } from "./middlewares/auth";
import { RequestHandler } from "express";
const app = express();

// Trust proxy headers (needed for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/", authenticateToken as RequestHandler, gadgetRoutes);

export default app;

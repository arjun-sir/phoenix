import express from "express";
import gadgetRoutes from "./routes/gadgets";
import authRoutes from "./routes/auth";
import { authenticateToken } from "./middlewares/auth";
import { apiRateLimiter } from "./middlewares/rateLimiter";
import { RequestHandler } from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";

const app = express();

// Trust proxy headers (needed for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

app.use(express.json());

// Apply rate limiter to all gadgets routes
app.use("/gadgets", apiRateLimiter);

app.use("/auth", authRoutes);
app.use("/gadgets", authenticateToken as RequestHandler, gadgetRoutes);

const swaggerDocument = YAML.load(path.join(__dirname, "../swagger.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default app;

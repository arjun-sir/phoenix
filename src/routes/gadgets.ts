import express, { RequestHandler } from "express";
import { cacheMiddleware } from "../middlewares/cache";
import {
  getGadgets,
  createGadget,
  updateGadget,
  decommissionGadget,
  selfDestructGadget,
  CACHE_KEYS,
} from "../controllers/gadgets";

const router = express.Router();

router.get(
  "/",
  cacheMiddleware(() => CACHE_KEYS.GADGETS_LIST),
  getGadgets
);
router.post("/", createGadget as RequestHandler);
router.patch("/:id", updateGadget as RequestHandler);
router.delete("/:id", decommissionGadget as RequestHandler);
router.post("/:id/self-destruct", selfDestructGadget as RequestHandler);

export default router;

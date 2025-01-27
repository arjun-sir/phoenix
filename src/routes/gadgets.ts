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
  cacheMiddleware((req) => {
    const status = req.query.status as string;
    const userId = req.user!.id;
    return status
      ? CACHE_KEYS.STATUS_GADGETS(status, userId)
      : CACHE_KEYS.ALL_GADGETS(userId);
  }),
  getGadgets as RequestHandler
);
router.post("/", createGadget as RequestHandler);
router.patch("/:id", updateGadget as RequestHandler);
router.delete("/:id", decommissionGadget as RequestHandler);
router.post("/:id/self-destruct", selfDestructGadget as RequestHandler);

export default router;

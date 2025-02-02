import { Request, Response } from "express";
import { PrismaClient, GadgetStatus } from "@prisma/client";
import {
  saveToCache,
  invalidateCache,
  getCachedCode,
  saveCodeToRedis,
} from "../middlewares/cache";
import {
  indexGadget,
  searchGadgets,
  deleteGadgetFromIndex,
} from "../utils/elasticsearchClient";

const prisma = new PrismaClient();

const GADGET_PREFIXES = [
  "Nightingale",
  "Kraken",
  "Phoenix",
  "Shadow",
  "Ghost",
  "Phantom",
  "Dragon",
  "Falcon",
  "Raven",
  "Cobra",
];

export const CACHE_KEYS = {
  ALL_GADGETS: (userId: string) => `gadgets_all_${userId}`,
  STATUS_GADGETS: (status: string, userId: string) =>
    `gadgets_${status}_${userId}`,
  DESTRUCT_CODE: (gadgetId: string) => `destruct_code_${gadgetId}`,
};

export const getGadgets = async (req: Request, res: Response) => {
  const { status } = req.query;
  const userId = req.user!.id;

  try {
    if (
      status &&
      !Object.values(GadgetStatus).includes(status as GadgetStatus)
    ) {
      return res.status(400).json({
        error:
          "Invalid status. Must be one of: " +
          Object.values(GadgetStatus).join(", "),
      });
    }

    const gadgets = await prisma.gadget.findMany({
      where: {
        userId,
        ...(status
          ? { status: status as GadgetStatus }
          : { status: "Available" }),
      },
      orderBy: { createdAt: "desc" },
    });

    const gadgetsWithProb = gadgets.map((gadget) => ({
      ...gadget,
      missionSuccessProbability: `${Math.floor(Math.random() * 100) + 1}%`,
    }));

    if (status) {
      await saveToCache(
        CACHE_KEYS.STATUS_GADGETS(status as string, userId),
        gadgetsWithProb
      );
    } else {
      await saveToCache(CACHE_KEYS.ALL_GADGETS(userId), gadgetsWithProb);
    }

    res.json(gadgetsWithProb);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch gadgets" });
  }
};

export const createGadget = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const prefix =
      GADGET_PREFIXES[Math.floor(Math.random() * GADGET_PREFIXES.length)];
    const suffix = Math.floor(Math.random() * 1000);
    const codename = `The ${prefix}-${suffix}`;

    const newGadget = await prisma.gadget.create({
      data: {
        name: codename,
        status: "Available",
        userId,
      },
    });

    // Index the new gadget in Elasticsearch
    await indexGadget(newGadget);

    await Promise.all([
      invalidateCache(CACHE_KEYS.ALL_GADGETS(userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS("Available", userId)),
    ]);
    res.status(201).json(newGadget);
  } catch (error) {
    res.status(500).json({ error: "Failed to create gadget" });
  }
};

export const updateGadget = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, status } = req.body;
  const userId = req.user!.id;

  try {
    if (!Object.values(GadgetStatus).includes(status)) {
      return res.status(400).json({
        error:
          "Invalid status. Must be one of: " +
          Object.values(GadgetStatus).join(", "),
      });
    }

    const existingGadget = await prisma.gadget.findFirst({
      where: { id, userId },
    });

    if (!existingGadget) {
      return res.status(404).json({
        error: "Gadget not found or does not belong to you",
      });
    }

    const updatedGadget = await prisma.gadget.update({
      where: { id },
      data: {
        name: name || existingGadget.name,
        status: status || existingGadget.status,
        DecommissionedAt:
          status === "Decommissioned"
            ? existingGadget.DecommissionedAt
              ? existingGadget.DecommissionedAt
              : new Date()
            : existingGadget.DecommissionedAt,
      },
    });

    // Update the gadget in Elasticsearch
    await indexGadget(updatedGadget);

    await Promise.all([
      invalidateCache(CACHE_KEYS.ALL_GADGETS(userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS(existingGadget.status, userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS(status, userId)),
    ]);
    res.json(updatedGadget);
  } catch (error) {
    res.status(500).json({ error: "Failed to update gadget" });
  }
};

export const decommissionGadget = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const existingGadget = await prisma.gadget.findFirst({
      where: { id, userId },
    });

    if (!existingGadget) {
      return res.status(404).json({
        error: "Gadget not found or does not belong to you",
      });
    }

    if (existingGadget.status === "Decommissioned") {
      return res
        .status(400)
        .json({ error: "Gadget is already decommissioned" });
    }

    const decommissionedGadget = await prisma.gadget.update({
      where: { id },
      data: {
        status: "Decommissioned",
        DecommissionedAt: new Date(),
      },
    });

    // Update the gadget in Elasticsearch
    await indexGadget(decommissionedGadget);

    await Promise.all([
      invalidateCache(CACHE_KEYS.ALL_GADGETS(userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS(existingGadget.status, userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS("Decommissioned", userId)),
    ]);
    res.json(decommissionedGadget);
  } catch (error) {
    res.status(500).json({ error: "Failed to decommission gadget" });
  }
};

export const selfDestructGadget = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { confirmationCode } = req.body;
  const confirmationCodeNum = Number(confirmationCode);
  const userId = req.user!.id;

  if (!confirmationCode) {
    return res.status(400).json({ error: "Confirmation code is required" });
  }

  try {
    const existingGadget = await prisma.gadget.findFirst({
      where: { id, userId },
    });

    if (!existingGadget) {
      return res.status(404).json({
        error: "Gadget not found or does not belong to you",
      });
    }

    if (existingGadget.status === "Destroyed") {
      return res.status(400).json({ error: "Gadget is already destroyed" });
    }

    let validCode = await getCachedCode(CACHE_KEYS.DESTRUCT_CODE(id));

    if (!validCode) {
      validCode = Math.floor(Math.random() * 900000 + 100000).toString();
      await saveCodeToRedis(CACHE_KEYS.DESTRUCT_CODE(id), validCode);
    }

    if (confirmationCodeNum !== Number(validCode)) {
      return res.status(400).json({
        error: "Invalid confirmation code",
        validCode,
      });
    }

    const destroyedGadget = await prisma.gadget.update({
      where: { id },
      data: { status: "Destroyed" },
    });

    // Remove the gadget from Elasticsearch
    await deleteGadgetFromIndex(id);

    await Promise.all([
      invalidateCache(CACHE_KEYS.ALL_GADGETS(userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS(existingGadget.status, userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS("Destroyed", userId)),
      invalidateCache(CACHE_KEYS.DESTRUCT_CODE(id)),
    ]);

    res.json({
      message: "This gadget will self-destruct in 5 seconds... Not kidding!",
      gadget: destroyedGadget,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to destroy gadget" });
  }
};

export const searchGadgetsByTerm = async (req: Request, res: Response) => {
  const { query } = req.query;
  const userId = req.user!.id;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Search query is required" });
  }

  try {
    const results = await searchGadgets(query, userId);
    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to search gadgets" });
  }
};

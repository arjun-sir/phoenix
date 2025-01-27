import { Request, Response } from "express";
import { PrismaClient, GadgetStatus } from "@prisma/client";
import { saveToCache, invalidateCache } from "../middlewares/cache";

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
};

export const getGadgets = async (req: Request, res: Response) => {
  const { status } = req.query;
  const userId = req.user!.id;

  try {
    if (
      status &&
      !Object.values(GadgetStatus).includes(status as GadgetStatus)
    ) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const gadgets = await prisma.gadget.findMany({
      where: {
        userId,
        ...(status
          ? { status: status as GadgetStatus }
          : { status: "Available" }),
      },
      orderBy: {
        createdAt: "desc",
      },
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
    res.status(500).json({ error: (error as Error).message });
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
        userId: req.user!.id,
      },
    });

    await Promise.all([
      invalidateCache(CACHE_KEYS.ALL_GADGETS(userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS("Available", userId)),
    ]);
    res.status(201).json(newGadget);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const updateGadget = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user!.id;

  try {
    if (!Object.values(GadgetStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const existingGadget = await prisma.gadget.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingGadget) {
      return res.status(404).json({ error: "Gadget not found or does " });
    }

    const updatedGadget = await prisma.gadget.update({
      where: { id },
      data: {
        status: status || existingGadget.status,
      },
    });

    await Promise.all([
      invalidateCache(CACHE_KEYS.ALL_GADGETS(userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS(existingGadget.status, userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS(updatedGadget.status, userId)),
    ]);
    res.json(updatedGadget);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const decommissionGadget = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const existingGadget = await prisma.gadget.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingGadget) {
      return res
        .status(404)
        .json({ error: "Gadget not found or does not belong to user" });
    }

    const decommissionedGadget = await prisma.gadget.update({
      where: { id },
      data: {
        status: "Decommissioned",
        DecommissionedAt: new Date(),
      },
    });

    await Promise.all([
      invalidateCache(CACHE_KEYS.ALL_GADGETS(userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS(existingGadget.status, userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS("Decommissioned", userId)),
    ]);
    res.json(decommissionedGadget);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const selfDestructGadget = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { confirmationCode } = req.body;
  const userId = req.user!.id;

  if (!confirmationCode) {
    return res.status(400).json({ error: "Confirmation code is required" });
  }

  // Generate a random 1-digit code between 0 and 9
  const validCode = Math.floor(Math.random() * 10);

  if (confirmationCode != validCode) {
    return res.status(400).json({ error: "Invalid confirmation code" });
  }

  try {
    const existingGadget = await prisma.gadget.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingGadget) {
      return res
        .status(404)
        .json({ error: "Gadget not found or does not belong to user" });
    }

    if (existingGadget.status === "Destroyed") {
      return res.status(400).json({ error: "Gadget already destroyed" });
    }

    const destroyedGadget = await prisma.gadget.update({
      where: { id },
      data: { status: "Destroyed" },
    });

    await Promise.all([
      invalidateCache(CACHE_KEYS.ALL_GADGETS(userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS(existingGadget.status, userId)),
      invalidateCache(CACHE_KEYS.STATUS_GADGETS("Destroyed", userId)),
    ]);
    res.json({
      message: "This gadget will self-destruct in 5 seconds... Not kidding!",
      gadget: destroyedGadget,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

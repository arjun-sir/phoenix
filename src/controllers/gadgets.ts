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
  GADGETS_LIST: "gadgets_list",
  GADGET_DETAIL: (id: string) => `gadget_${id}`,
};

export const getGadgets = async (req: Request, res: Response) => {
  try {
    const gadgets = await prisma.gadget.findMany();
    const gadgetsWithProb = gadgets.map((gadget) => ({
      ...gadget,
      missionSuccessProbability: `${Math.floor(Math.random() * 100) + 1}%`,
    }));

    // Cache the list
    await saveToCache(CACHE_KEYS.GADGETS_LIST, gadgetsWithProb);

    // Cache individual items
    await Promise.all(
      gadgetsWithProb.map((gadget) =>
        saveToCache(CACHE_KEYS.GADGET_DETAIL(gadget.id), gadget)
      )
    );

    res.json(gadgetsWithProb);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const createGadget = async (req: Request, res: Response) => {
  try {
    // Generate random codename
    const prefix =
      GADGET_PREFIXES[Math.floor(Math.random() * GADGET_PREFIXES.length)];
    const suffix = Math.floor(Math.random() * 1000);
    const codename = `The ${prefix}-${suffix}`;

    const newGadget = await prisma.gadget.create({
      data: {
        name: codename,
        status: "Available",
        userId: req.user!.id, // From auth middleware
      },
    });

    await invalidateCache(CACHE_KEYS.GADGETS_LIST);
    res.status(201).json(newGadget);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const updateGadget = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, status } = req.body;
  const userId = req.user!.id;

  try {
    //check if status is valid
    if (!Object.values(GadgetStatus).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // First check if gadget exists and belongs to user
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
      where: {
        id,
      },
      data: {
        name: name || existingGadget.name,
        status: status || existingGadget.status,
      },
    });

    await invalidateCache(
      CACHE_KEYS.GADGETS_LIST,
      CACHE_KEYS.GADGET_DETAIL(id)
    );
    res.json(updatedGadget);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const decommissionGadget = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    // First check if gadget exists and belongs to user
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
        updatedAt: new Date(),
      },
    });

    await invalidateCache(
      CACHE_KEYS.GADGETS_LIST,
      CACHE_KEYS.GADGET_DETAIL(id)
    );
    res.json(decommissionedGadget);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const selfDestructGadget = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { confirmationCode } = req.body;
  const userId = req.user!.id;

  const validCode = Math.floor(Math.random() * 100000);

  if (confirmationCode != validCode) {
    return res.status(400).json({ error: "Invalid confirmation code" });
  }

  try {
    // First check if gadget exists and belongs to user
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

    const destroyedGadget = await prisma.gadget.update({
      where: { id },
      data: { status: "Destroyed" },
    });

    await invalidateCache(
      CACHE_KEYS.GADGETS_LIST,
      CACHE_KEYS.GADGET_DETAIL(id)
    );
    res.json({
      message: "This gadget will self-destruct in 5 seconds... Not kidding!",
      gadget: destroyedGadget,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

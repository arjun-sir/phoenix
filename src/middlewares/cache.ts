import { Request, Response, NextFunction } from "express";
import redisClient from "../utils/redisClient";

export const CACHE_KEYS = {};

export const cacheMiddleware = (keyGenerator: (req: Request) => string) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const cacheKey = keyGenerator(req);

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      res.status(200).json(JSON.parse(cachedData));
      return;
    }

    res.locals.cacheKey = cacheKey;
    next();
  };
};

export const saveToCache = async (key: string, data: any, ttl = 3600) => {
  await redisClient.set(key, JSON.stringify(data), { EX: ttl });
};

export const invalidateCache = async (...keys: string[]) => {
  await redisClient.del(keys);
};

// save code to redis
export const saveCodeToRedis = async (key: string, code: string) => {
  await redisClient.set(key, code, { EX: 300 });
};

export const getCachedCode = async (key: string) => {
  return await redisClient.get(key);
};

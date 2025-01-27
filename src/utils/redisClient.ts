import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("Max reconnection attempts reached");
        return new Error("Max reconnection attempts reached");
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.on("connect", () => console.log("Connected to Redis"));
redisClient.on("reconnecting", () => console.log("Reconnecting to Redis..."));

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
})();

export default redisClient;

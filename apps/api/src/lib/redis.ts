import { Redis } from "ioredis";
import type { ConnectionOptions } from "bullmq";
import { config } from "../config.js";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    _redis.on("error", (err) => {
      console.error("Redis error:", err.message);
    });
  }
  return _redis;
}

export async function closeRedis() {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}

export const redis = new Proxy({} as Redis, {
  get(_, prop) {
    return (getRedis() as any)[prop];
  },
});

// BullMQ workers require a dedicated connection with maxRetriesPerRequest: null.
// Returned as ConnectionOptions to satisfy BullMQ's bundled ioredis types
// (the workspace may resolve a different ioredis patch version than bullmq does).
export function createWorkerConnection(): ConnectionOptions {
  const conn = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  conn.on("error", (err) => {
    console.error("Redis worker connection error:", err.message);
  });
  return conn as unknown as ConnectionOptions;
}

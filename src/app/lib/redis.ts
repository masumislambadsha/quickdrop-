import { createClient, type RedisClientType } from "redis";

import config from "../config/index.js";

let client: RedisClientType | null = null;
let connected = false;

function getClient(): RedisClientType | null {
	if (!config.redis.url) {
		return null;
	}
	if (!client) {
		client = createClient({ url: config.redis.url });
		client.on("error", () => {
			connected = false;
		});
	}
	return client;
}

async function ensureConnected(): Promise<RedisClientType | null> {
	const c = getClient();
	if (!c) {
		return null;
	}
	if (!connected) {
		try {
			await c.connect();
			connected = true;
		} catch {
			connected = false;
			return null;
		}
	}
	return c;
}

export const redis = {
	async get(key: string): Promise<string | null> {
		const c = await ensureConnected();
		if (!c) {
			return null;
		}
		try {
			return await c.get(key);
		} catch {
			return null;
		}
	},
	async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
		const c = await ensureConnected();
		if (!c) {
			return;
		}
		try {
			if (ttlSeconds) {
				await c.set(key, value, { EX: ttlSeconds });
			} else {
				await c.set(key, value);
			}
		} catch {
			// noop
		}
	},
	async del(...keys: string[]): Promise<void> {
		const c = await ensureConnected();
		if (!c || keys.length === 0) {
			return;
		}
		try {
			await c.del(keys);
		} catch {
			// noop
		}
	},
	async delByPrefix(prefix: string): Promise<void> {
		const c = await ensureConnected();
		if (!c) {
			return;
		}
		try {
			const keys: string[] = [];
			for await (const batch of c.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
				keys.push(...batch);
			}
			if (keys.length > 0) {
				await c.del(keys);
			}
		} catch {
			// noop
		}
	},
	async flushDb(): Promise<void> {
		const c = await ensureConnected();
		if (!c) {
			return;
		}
		try {
			await c.flushDb();
		} catch {
			// noop
		}
	},
};
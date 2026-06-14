import { createClient } from "@libsql/client";
import { env } from "@revolver/env/server";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export * as orm from "drizzle-orm";
export * from "./schema";

export function createDb() {
	const client = createClient({
		url: env.DATABASE_URL,
	});

	return drizzle({ client, schema });
}

export const db = createDb();

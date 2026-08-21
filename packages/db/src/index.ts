import { createClient } from "@libsql/client";
import { env } from "@revolver/env/server";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
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

// Anchored to this file's location (not the caller's cwd) so it resolves correctly
// whether invoked from a workspace subdirectory in dev or from the Docker image root.
const migrationsFolder = `${import.meta.dir}/migrations`;

// Shared by apps/server (boot-time safety net for local dev) and apps/migrate (the
// Docker/production startup step) — single source of truth for applying schema changes,
// so both environments are guaranteed to stay in sync with each other.
//
// Applies any pending SQL migrations. Safe to call on every boot: Drizzle tracks applied
// migrations in a journal table, so this is a no-op once a database is current.
//
// Databases created with `drizzle-kit push` (the workflow older local dev databases were
// set up with, before local dev also adopted this migrate-based flow) have no *recorded*
// migrations — either no journal table at all, or one with zero rows (`migrate()` creates
// the table as a setup step even on a run that then fails, so a database that once hit this
// exact codepath can have an empty-but-present journal). Either way that's expected, not an
// error, so we skip migrate() entirely rather than have it fail loudly on every boot. `db:push`
// is what keeps those specific databases in sync; this function only does real work for
// databases with actual recorded migration history (fresh installs it bootstraps itself, or
// any database that's ever successfully completed a migrate() run before).
export async function runMigrations() {
	const hasAppTables = await db.all(
		sql`select 1 from sqlite_master where type = 'table' and name = 'config'`,
	);
	if (hasAppTables.length === 0) {
		await migrate(db, { migrationsFolder });
		return;
	}

	const journalRows = await db.all(
		sql`select 1 from sqlite_master where type = 'table' and name = '__drizzle_migrations'`,
	);
	const appliedCount =
		journalRows.length > 0
			? await db.all(sql`select 1 from __drizzle_migrations`)
			: [];
	if (appliedCount.length === 0) return;

	await migrate(db, { migrationsFolder });
}

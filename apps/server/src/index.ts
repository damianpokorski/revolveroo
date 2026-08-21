import { cors } from "@elysiajs/cors";
import staticPlugin from "@elysiajs/static";
import { runMigrations } from "@revolver/db";
import Elysia from "elysia";
import { router } from "./router";

// Extra safety net in front of apps/migrate (which already runs this in production/Docker
// before the server starts). Deliberately non-fatal: a database created with `db:push`
// has no migration history, so this will always fail there — that's expected for local
// dev, not a reason to refuse to boot. We log loudly instead of silently 500ing later.
try {
	await runMigrations();
} catch (err) {
	console.error(
		"Failed to apply database migrations automatically. If this database was set up " +
			"with `bun run db:push` (no migration history), run `bun run db:push` again to " +
			"sync it with the latest schema, then restart.",
	);
	console.error(err);
}

let fullstack = new Elysia({});

fullstack.use(
	router.use(
		cors({
			origin: true,
			methods: "*",
		}),
	),
);

// Conditionally load static assets from public dir if defined
const publicDir = process.env.PUBLIC_DIR;
if (publicDir) {
	console.log("Loading public dir");
	console.log(publicDir);
	fullstack = fullstack
		.use(staticPlugin({ assets: publicDir, prefix: "/" }))
		.get("/*", () =>
			Bun.file(`${publicDir}/index.html`),
		) as unknown as typeof fullstack;
}

const port = Number(process.env.PORT) || 3000;

fullstack.listen(port, () => console.log(`Server running on port ${port}`));

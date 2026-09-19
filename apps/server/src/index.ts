import { cors } from "@elysiajs/cors";
import staticPlugin from "@elysiajs/static";
import Elysia from "elysia";
import { TabsRepository } from "./db/TabsRepository";
import { router } from "./router";
import { runtimeState } from "./runtime/RuntimeState";
import { store } from "./store/YamlStore";

// Fatal on failure: unlike the old SQLite `db:push` setup, there's no "limp along
// without a loaded store" mode — if the data file can't be read or created, the
// server has nothing to serve.
await store.load();
store.startWatching();
runtimeState.startHealthProbeLoop(new TabsRepository());

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

import { cors } from "@elysiajs/cors";
import staticPlugin from "@elysiajs/static";
import Elysia from "elysia";
import { router } from "./router";

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

fullstack.listen(port, () =>
	console.log(`Server running on port ${port}`),
);

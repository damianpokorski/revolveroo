import { config, db, tabs } from "@revolver/db";
import { migrate } from "drizzle-orm/libsql/migrator";
import { v7 as uuidv7 } from "uuid";

console.log({
	path: process.env.MIGRATIONS_FOLDER,
	cwd: process.cwd(),
});
await migrate(db, {
	migrationsFolder: process.env.MIGRATIONS_FOLDER ?? "migrations",
});
console.log("Migrations complete");

const defaultTabs = [
	{
		title: "Dashboard",
		url: "http://ha.media.server/tablet-view/weather?kiosk",
		icon: "󰖕",
	},
	{
		title: "Heating",
		url: "http://ha.media.server/tablet-view/Heating?kiosk",
		icon: "󰎓",
	},
	{
		title: "Front Door camera",
		url: "http://ha.media.server/tablet-view/front-door?kiosk",
		icon: "󰞮",
	},
	{
		title: "What's on",
		url: "http://whatson.media.server/views/cards?autoscroll=0",
		icon: "󰟴",
	},
	{
		title: "Office lights",
		url: "http://ha.media.server/tablet-view/office-lights?kiosk",
		conditions: [{ type: "queryParams", queryParams: { room: "office" } }],
		icon: "󰛨",
	},
	{
		title: "Trello",
		url: "http://ha.media.server/tablet-view/trello?kiosk",
		hiddenFromLoop: true,
		icon: "",
	},
	{
		title: "Fitbit",
		url: "http://ha.media.server/tablet-view/fitbit?kiosk",
		hiddenFromLoop: true,
		icon: "󰖉",
	},
	{
		title: "Lights",
		url: "http://ha.media.server/tablet-view/lights?kiosk",
		hiddenFromLoop: true,
		icon: "󱉓",
	},
];

const tabCount = await db.$count(tabs);
if (tabCount === 0) {
	await db.insert(tabs).values(
		defaultTabs.map((tab, position) => ({
			id: uuidv7(),
			hiddenFromLoop: false,
			conditions: null,
			...tab,
			position,
		})),
	);
	console.log(`Seeded ${defaultTabs.length} tabs`);
}

const configCount = await db.$count(config);
if (configCount === 0) {
	await db.insert(config).values({ id: 1, playbackInterval: 5000 });
	console.log("Seeded default config");
}

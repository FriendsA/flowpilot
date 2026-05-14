import { Hono } from "hono";
import { ConfigJson } from "../../config";

const router = new Hono();

router.get("/", (c) =>
	c.render(<div id="app">Loading...</div>, { title: "Settings" }),
);

router.get("/api/config", (c) => {
	const config = new ConfigJson().getConfig();
	return c.json(config);
});

router.post("/api/config", async (c) => {
	const config = new ConfigJson();
	config.setConfig(await c.req.json());
	return c.json({ ok: true });
});

export const configRoutes = router;

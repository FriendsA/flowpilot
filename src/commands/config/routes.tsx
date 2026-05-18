import { Hono } from "hono";
import { ConfigJson } from "../../config";
import { t } from "../../i18n/web";

const router = new Hono();

router.get("/", (c) =>
	c.render(<div id="app">{t("web.loading")}</div>, {
		title: t("web.settingsTitle"),
	}),
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

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
	const data = await c.req.json();
	config.setConfig(data);
	const headers: Record<string, string> = {};
	if (data.locale === "zh-CN" || data.locale === "en") {
		headers["Set-Cookie"] = `locale=${data.locale}; Path=/; Max-Age=31536000`;
	}
	return c.json({ ok: true }, 200, headers);
});

export const configRoutes = router;

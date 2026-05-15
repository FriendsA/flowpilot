import { Hono } from "hono";
import { ConfigJson } from "../../config";
import { t } from "../../i18n/web";
import type { Config } from "../../types";

const REQUIRED_KEYS: (keyof Config)[] = [
	"jiraHost",
	"jiraName",
	"jiraPassword",
	"gitlabHost",
	"gitlabKey",
];

const router = new Hono();

router.get("/", async (c) => {
	const config = new ConfigJson().getConfig();
	const missing = REQUIRED_KEYS.filter((key) => !config[key]);
	if (missing.length > 0) {
		return c.redirect("/config");
	}
	return c.render(<div id="app">{t("web.loading")}</div>, { title: t("web.endTitle") });
});

export const endRoutes = router;
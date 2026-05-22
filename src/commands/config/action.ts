import * as clack from "@clack/prompts";
import pc from "picocolors";
import { ConfigJson } from "../../config";
import { t } from "../../i18n/cli";
import { openPage } from "../../server";

interface ConfigActionProps {
	open?: boolean;
	o?: boolean;
	"--": unknown[];
}

export const configAction = async (options: ConfigActionProps) => {
	if (options.open) {
		openPage("/config");
		return;
	}
	const configJson = new ConfigJson();
	const config = configJson.getConfig();

	clack.intro(pc.bgCyan(pc.black(" FlowPilot ")));

	const group = await clack.group(
		{
			jiraHost: () =>
				clack.text({
					message: `${pc.bold("Jira")} ${t("config.jiraHostLabel")} ${pc.dim(`(${t("config.jiraHostHint")})`)}`,
					placeholder: "https://jira.example.com",
					initialValue: config.jiraHost ?? "",
				}),
			jiraName: () =>
				clack.text({
					message: `${pc.bold("Jira")} ${t("config.jiraNameLabel")} ${pc.dim(`(${t("config.jiraNameHint")})`)}`,
					placeholder: "username",
					initialValue: config.jiraName ?? "",
				}),
			jiraPassword: () =>
				clack.text({
					message: `${pc.bold("Jira")} ${t("config.jiraPasswordLabel")} ${pc.dim(`(${t("config.jiraPasswordHint")})`)}`,
					placeholder: "••••••••",
					initialValue: config.jiraPassword ?? "",
				}),
			gitlabHost: () =>
				clack.text({
					message: `${pc.bold("GitLab")} ${t("config.gitlabHostLabel")} ${pc.dim(`(${t("config.gitlabHostHint")})`)}`,
					placeholder: "http://git.example.com",
					initialValue: config.gitlabHost ?? "",
				}),
			gitlabKey: () =>
				clack.text({
					message: `${pc.bold("GitLab")} ${t("config.gitlabTokenLabel")} ${pc.dim(`(${t("config.gitlabTokenHint")})`)}`,
					placeholder: "glpat-xxxxxxxxxxxxxxxxxxxx",
					initialValue: config.gitlabKey ?? "",
				}),
			jenkinsHost: () =>
				clack.text({
					message: `${pc.bold("Jenkins")} ${t("config.jenkinsHostLabel")} ${pc.dim(`(${t("config.jenkinsHostHint")})`)}`,
					placeholder: "https://jenkins.example.com",
					initialValue: config.jenkinsHost ?? "",
				}),
			jenkinsUser: () =>
				clack.text({
					message: `${pc.bold("Jenkins")} ${t("config.jenkinsUserLabel")}`,
					placeholder: "username",
					initialValue: config.jenkinsUser ?? "",
				}),
			jenkinsPassword: () =>
				clack.text({
					message: `${pc.bold("Jenkins")} ${t("config.jenkinsPasswordLabel")} ${pc.dim(`(${t("config.jenkinsPasswordHint")})`)}`,
					placeholder: "••••••••",
					initialValue: config.jenkinsPassword ?? "",
				}),
		},
		{
			onCancel: () => {
				clack.cancel(t("release.aborted"));
				process.exit(0);
			},
		},
	);

	if (clack.isCancel(group)) return;

	configJson.setConfig(group);
	clack.outro(pc.green("✔") + ` ${t("config.saved")}`);
};

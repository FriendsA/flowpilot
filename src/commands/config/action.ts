import prompts, { type PromptObject } from "prompts";
import pc from "picocolors";
import { ConfigJson } from "../../config";
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

	console.log(pc.bold(pc.cyan("⚙  FlowPilot 配置")));
	console.log(pc.dim("─────────────────────────────"));

	const questions: PromptObject[] = [
		{
			type: "text",
			name: "jiraHost",
			message: pc.bold("Jira") + " 地址 " + pc.dim("(带协议前缀，e.g. https://jira.example.com)"),
			initial: config.jiraHost ?? "",
		},
		{
			type: "text",
			name: "jiraName",
			message: pc.bold("Jira") + " 账号 " + pc.dim("(无 @后缀)"),
			initial: config.jiraName ?? "",
		},
		{
			type: "password",
			name: "jiraPassword",
			message: pc.bold("Jira") + " 密码 " + pc.dim("(仅存储在本地 ~/.flowpilotrc)"),
			initial: config.jiraPassword ?? "",
		},
		{
			type: "text",
			name: "gitlabHost",
			message: pc.bold("GitLab") + " 地址 " + pc.dim("(带协议前缀，e.g. http://git.example.com)"),
			initial: config.gitlabHost ?? "",
		},
		{
			type: "password",
			name: "gitlabKey",
			message: pc.bold("GitLab") + " Token " + pc.dim("(在 GitLab 设置页面生成)"),
			initial: config.gitlabKey ?? "",
		},
	];

	const answers = await prompts(questions);
	configJson.setConfig(answers);
	console.log(pc.green("✔") + " 配置已保存至 " + pc.dim("~/.flowpilotrc"));
};
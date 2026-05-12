import prompts, { type PromptObject } from "prompts";
import { ConfigJson } from "../../config";
import { openPage } from "../../server";

interface ConfigActionProps {
  open?: boolean;
  o?: boolean;
  "--": unknown[];
}

export const configAction = async (options: ConfigActionProps) => {
  console.log(options);
  if (options.open) {
    openPage("/config");
    return;
  }
  const configJson = new ConfigJson();
  const config = configJson.getConfig();

  const questions: PromptObject[] = [
    {
      type: "text",
      name: "jiraName",
      message: "jira 账号(无@datayes.com后缀)",
      initial: config.jiraName,
    },
    {
      type: "password",
      name: "jiraPassword",
      message: "jira 密码(密码只会存储在本地)",
      initial: config.jiraPassword,
    },
    {
      type: "password",
      name: "gitlabKey",
      message:
        "gitlab 的访问token, 可以在这里设置: http://git.datayes.com/profile/personal_access_tokens",
      initial: config.gitlabKey,
    },
  ];

  const answers = await prompts(questions);
  configJson.setConfig(answers);
};

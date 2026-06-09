import * as clack from "@clack/prompts";
import pc from "picocolors";
import { t } from "../../i18n/cli";
import { openPage } from "../../server";
import {
	extractProjectPath,
	getGitRemoteUrl,
	hasGitRemoteOrigin,
	isGitRepo,
} from "../../utils/git";

interface WatchActionProps {
	open?: boolean;
	o?: boolean;
	"--": unknown[];
}

export const watchAction = async (options: WatchActionProps) => {
	if (options.open) {
		let path = "/watch";
		try {
			if (isGitRepo() && hasGitRemoteOrigin()) {
				const remoteUrl = getGitRemoteUrl();
				const projectPath = extractProjectPath(remoteUrl);
				if (projectPath) {
					path = `/watch?project=${encodeURIComponent(projectPath)}`;
				}
			}
		} catch {
			/* ignore, open without context */
		}
		openPage(path);
		return;
	}

	clack.intro(pc.bgCyan(pc.black(" FlowPilot ")));
	clack.log.info(pc.dim(t("cli.watchCliNotReady")));
	clack.log.info(pc.cyan(t("cli.watchOpenHint")));
};

import { openPage } from "../../server";

interface ReleaseActionProps {
	open?: boolean;
	o?: boolean;
	"--": unknown[];
}

export const releaseAction = async (options: ReleaseActionProps) => {
	if (options.open) {
		openPage("/release");
		return;
	}
};

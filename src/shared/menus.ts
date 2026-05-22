import { meta as end } from "../commands/end/meta";
import { meta as mr } from "../commands/mr/meta";
import { meta as release } from "../commands/release/meta";

export type CommandMeta = {
	titleKey: string;
	href: string;
	categoryKey: string;
};

export const menus: CommandMeta[] = [release, mr, end];

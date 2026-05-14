import { meta as config } from "../commands/config/meta";
import { meta as release } from "../commands/release/meta";

export type CommandMeta = {
	title: string;
	icon: string;
	href: string;
	category: string;
};

export const menus: CommandMeta[] = [config, release];

import { meta as release } from "../commands/release/meta";

export type CommandMeta = {
	titleKey: string;
	icon: string;
	href: string;
	categoryKey: string;
};

export const menus: CommandMeta[] = [release];
export function parsePomXml(raw: string): {
	version: string | null;
	groupId: string | null;
	flowPilotName: string | null;
} {
	const stripped = raw.replace(/<parent>[\s\S]*?<\/parent>/, "");
	const pick = (src: string, tag: string): string | null =>
		src.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1] ?? null;

	// Extract flowPilotName from <properties><flowPilotName>...</flowPilotName></properties>
	const propertiesMatch = stripped.match(/<properties>([\s\S]*?)<\/properties>/)?.[1] ?? raw.match(/<properties>([\s\S]*?)<\/properties>/)?.[1] ?? "";
	const flowPilotName = propertiesMatch ? pick(propertiesMatch, "flowPilotName") : null;

	return {
		version: pick(stripped, "version") ?? pick(raw, "version"),
		groupId: pick(stripped, "groupId") ?? pick(raw, "groupId"),
		flowPilotName,
	};
}

export function cleanVersion(v: string | null): string {
	return (v ?? "").split("-")[0];
}

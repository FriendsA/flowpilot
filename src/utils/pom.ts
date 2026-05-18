export function parsePomXml(raw: string): {
	version: string | null;
	groupId: string | null;
	artifactId: string | null;
} {
	const stripped = raw.replace(/<parent>[\s\S]*?<\/parent>/, "");
	const pick = (src: string, tag: string): string | null =>
		src.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1] ?? null;

	return {
		version: pick(stripped, "version") ?? pick(raw, "version"),
		groupId: pick(stripped, "groupId") ?? pick(raw, "groupId"),
		artifactId: pick(stripped, "artifactId") ?? pick(raw, "artifactId"),
	};
}

export function cleanVersion(v: string | null): string {
	return (v ?? "").split("-")[0];
}

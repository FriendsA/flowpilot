export function parsePomXml(raw: string): {
	version: string | null;
	groupId: string | null;
	flowPilotName: string | null;
	jenkinsJobName: string | null;
} {
	const stripped = raw.replace(/<parent>[\s\S]*?<\/parent>/, "");
	const pick = (src: string, tag: string): string | null =>
		src.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))?.[1] ?? null;

	let flowPilotName: string | null = null;
	let jenkinsJobName: string | null = null;

	// Try <flowpilot> top-level element first (nested form)
	const flowpilotMatch =
		stripped.match(/<flowpilot>([\s\S]*?)<\/flowpilot>/)?.[1] ??
		raw.match(/<flowpilot>([\s\S]*?)<\/flowpilot>/)?.[1] ??
		null;

	if (flowpilotMatch) {
		flowPilotName = pick(flowpilotMatch, "releaseName");
		jenkinsJobName = pick(flowpilotMatch, "jenkinsJob");
	}

	// Also support dot notation: <flowpilot.releaseName>value</flowpilot.releaseName>
	if (!flowPilotName) {
		flowPilotName =
			pick(stripped, "flowpilot\\.releaseName") ??
			pick(raw, "flowpilot\\.releaseName");
	}
	if (!jenkinsJobName) {
		jenkinsJobName =
			pick(stripped, "flowpilot\\.jenkinsJob") ??
			pick(raw, "flowpilot\\.jenkinsJob");
	}

	// Fallback to <properties> (field names match flowpilot element)
	if (!flowPilotName || !jenkinsJobName) {
		const propertiesMatch =
			stripped.match(/<properties>([\s\S]*?)<\/properties>/)?.[1] ??
			raw.match(/<properties>([\s\S]*?)<\/properties>/)?.[1] ??
			"";
		if (propertiesMatch) {
			if (!flowPilotName) {
				flowPilotName = pick(propertiesMatch, "releaseName");
			}
			if (!jenkinsJobName) {
				jenkinsJobName = pick(propertiesMatch, "jenkinsJob");
			}
		}
	}

	return {
		version: pick(stripped, "version") ?? pick(raw, "version"),
		groupId: pick(stripped, "groupId") ?? pick(raw, "groupId"),
		flowPilotName,
		jenkinsJobName,
	};
}

export function cleanVersion(v: string | null): string {
	return (v ?? "").split("-")[0];
}

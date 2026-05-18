export function filterByRelevance<T extends { name: string; path?: string }>(
	items: T[],
	query: string,
	limit = 30,
): T[] {
	if (!query) return items.slice(0, limit);
	const q = query.toLowerCase();
	return items
		.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				(p.path ?? "").toLowerCase().includes(q),
		)
		.map((p) => {
			const name = p.name.toLowerCase();
			const path = (p.path ?? "").toLowerCase();
			let score: number;
			if (name === q) score = 0;
			else if (name.startsWith(q)) score = 1 + name.length - q.length;
			else if (path.startsWith(q)) score = 50;
			else
				score = Math.min(
					name.includes(q) ? 10 + name.indexOf(q) : 999,
					path.includes(q) ? 60 + path.indexOf(q) : 999,
				);
			return { p, score };
		})
		.sort((a, b) => a.score - b.score)
		.slice(0, limit)
		.map((e) => e.p);
}

const ROCKET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-1.56 6.31-3.87 8.93A22 22 0 0 1 15 12l-3 3z"/><path d="m9 12-4.5 4.5"/><path d="m14.5 17-4.5-4.5"/><path d="M8.5 2c2.06 3.13 4.5 6 4.5 6s1.5-2.87 4.5-6"/></svg>`;

export const meta = {
	titleKey: "web.releaseTitle",
	icon: ROCKET_SVG,
	href: "/release",
	categoryKey: "web.generalCategory",
} as const;
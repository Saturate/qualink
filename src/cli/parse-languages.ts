import type { Language } from "../types.js";

export function parseLanguages(value: unknown): Language[] | undefined {
	if (typeof value !== "string" || value.trim().length === 0) {
		return undefined;
	}
	const langs = value
		.split(",")
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	return langs.length > 0 ? langs : undefined;
}

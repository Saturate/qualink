export function assertNonEmpty(value: unknown, name: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Missing required value: ${name}`);
	}

	return value;
}

export function asOptionalString(value: unknown): string | null {
	if (typeof value !== "string" || value.trim().length === 0) {
		return null;
	}

	return value;
}

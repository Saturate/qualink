const UNITS = ["B", "kB", "MB", "GB"] as const;

export function formatBytes(bytes: number): string {
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1000 && unitIndex < UNITS.length - 1) {
		value /= 1000;
		unitIndex++;
	}

	const formatted = unitIndex === 0 ? value.toString() : value.toFixed(1).replace(/\.0$/, "");
	return `${formatted} ${UNITS[unitIndex]}`;
}

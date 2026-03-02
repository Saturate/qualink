export function ratioPct(covered: number, total: number): number {
	if (total <= 0) {
		return 0;
	}

	return Number(((covered / total) * 100).toFixed(2));
}

export function toPctFromUnitScore(score: number | undefined): number {
	if (typeof score !== "number" || Number.isNaN(score)) {
		return 0;
	}

	return Number((score * 100).toFixed(2));
}

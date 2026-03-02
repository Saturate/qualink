import { baseDocument } from "../normalize.js";
import type { CommonMetadata, LighthouseMetricDocument } from "../types.js";
import { isRecord } from "../utils/guards.js";
import { toPctFromUnitScore } from "../utils/metrics.js";

function readCategoryScore(categories: Record<string, unknown>, key: string): number {
	const category = categories[key];
	if (!isRecord(category)) {
		return 0;
	}

	const score = category.score;
	if (typeof score !== "number") {
		return 0;
	}

	return toPctFromUnitScore(score);
}

export function collectLighthouse(
	input: unknown,
	metadata: CommonMetadata,
	url: string,
): LighthouseMetricDocument[] {
	if (!isRecord(input)) {
		throw new Error("Lighthouse input must be an object");
	}

	const categoriesUnknown = input.categories;
	if (!isRecord(categoriesUnknown)) {
		throw new Error("Lighthouse report missing categories");
	}

	const doc: LighthouseMetricDocument = {
		...baseDocument({
			metricType: "lighthouse",
			tool: "lighthouse",
			languages: ["js"],
			metadata,
		}),
		url,
		performance: readCategoryScore(categoriesUnknown, "performance"),
		accessibility: readCategoryScore(categoriesUnknown, "accessibility"),
		best_practices: readCategoryScore(categoriesUnknown, "best-practices"),
		seo: readCategoryScore(categoriesUnknown, "seo"),
	};

	return [doc];
}

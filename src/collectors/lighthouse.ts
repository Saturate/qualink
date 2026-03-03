import { baseDocument } from "../normalize.js";
import type {
	CommonMetadata,
	LighthouseFilmstripFrame,
	LighthouseMetricDocument,
} from "../types.js";
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

function readAuditNumeric(audits: Record<string, unknown>, key: string): number | undefined {
	const audit = audits[key];
	if (!isRecord(audit)) {
		return undefined;
	}

	const value = audit.numericValue;
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}

	return value;
}

export interface LighthouseCollectorOptions {
	includeFilmstrip: boolean;
}

function extractFilmstrip(audits: Record<string, unknown>): LighthouseFilmstripFrame[] | undefined {
	const thumbnail = audits["screenshot-thumbnails"];
	if (!isRecord(thumbnail)) return undefined;

	const details = thumbnail.details;
	if (!isRecord(details)) return undefined;
	if (details.type !== "filmstrip") return undefined;

	const items = details.items;
	if (!Array.isArray(items)) return undefined;

	const frames: LighthouseFilmstripFrame[] = [];
	for (const item of items) {
		if (!isRecord(item)) continue;
		if (typeof item.timing !== "number" || !Number.isFinite(item.timing)) continue;
		if (typeof item.data !== "string") continue;
		frames.push({ timing: item.timing, data: item.data });
	}

	return frames.length > 0 ? frames : undefined;
}

export function collectLighthouse(
	input: unknown,
	metadata: CommonMetadata,
	url: string,
	options?: LighthouseCollectorOptions,
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

	const audits = input.audits;
	if (isRecord(audits)) {
		const fcp = readAuditNumeric(audits, "first-contentful-paint");
		const lcp = readAuditNumeric(audits, "largest-contentful-paint");
		const tbt = readAuditNumeric(audits, "total-blocking-time");
		const cls = readAuditNumeric(audits, "cumulative-layout-shift");
		const si = readAuditNumeric(audits, "speed-index");
		const tti = readAuditNumeric(audits, "interactive");
		const ttfb = readAuditNumeric(audits, "server-response-time");
		const totalByteWeight = readAuditNumeric(audits, "total-byte-weight");
		const domSize = readAuditNumeric(audits, "dom-size");

		if (fcp !== undefined) doc.fcp = fcp;
		if (lcp !== undefined) doc.lcp = lcp;
		if (tbt !== undefined) doc.tbt = tbt;
		if (cls !== undefined) doc.cls = cls;
		if (si !== undefined) doc.si = si;
		if (tti !== undefined) doc.tti = tti;
		if (ttfb !== undefined) doc.ttfb = ttfb;
		if (totalByteWeight !== undefined) doc.total_byte_weight = totalByteWeight;
		if (domSize !== undefined) doc.dom_size = domSize;

		const auditScores: Record<string, number> = {};
		const auditValues: Record<string, number> = {};

		for (const [id, raw] of Object.entries(audits)) {
			if (!isRecord(raw)) continue;

			if (typeof raw.score === "number" && Number.isFinite(raw.score)) {
				auditScores[id] = toPctFromUnitScore(raw.score);
			}

			if (typeof raw.numericValue === "number" && Number.isFinite(raw.numericValue)) {
				auditValues[id] = raw.numericValue;
			}
		}

		if (Object.keys(auditScores).length > 0) {
			doc.audit_scores = auditScores;
		}
		if (Object.keys(auditValues).length > 0) {
			doc.audit_values = auditValues;
		}

		if (options?.includeFilmstrip) {
			const filmstrip = extractFilmstrip(audits);
			if (filmstrip) doc.filmstrip = filmstrip;
		}
	}

	return [doc];
}

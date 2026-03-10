import { collectBiome } from "../../collectors/biome.js";
import { collectCoverageDotnet } from "../../collectors/coverage-dotnet.js";
import { collectCoverageJs } from "../../collectors/coverage-js.js";
import { collectEslint } from "../../collectors/eslint.js";
import { collectJunit } from "../../collectors/junit.js";
import { collectLighthouse } from "../../collectors/lighthouse.js";
import { collectSarif } from "../../collectors/sarif.js";
import type { CommonMetadata, MetricType, NormalizedDocument } from "../../types.js";
import { readJsonFile, readTextFile } from "../../utils/file.js";
import { isRecord } from "../../utils/guards.js";
import type { CollectorKey } from "./patterns.js";

export interface CollectorOutput {
	metricType: MetricType;
	documents: NormalizedDocument[];
}

/**
 * Extract URL from a Lighthouse report JSON for multi-collect mode.
 * Falls back to "unknown" if neither field is present.
 */
function extractLighthouseUrl(input: unknown): string {
	if (!isRecord(input)) return "unknown";
	if (typeof input.requestedUrl === "string" && input.requestedUrl.length > 0) {
		return input.requestedUrl;
	}
	if (typeof input.finalDisplayedUrl === "string" && input.finalDisplayedUrl.length > 0) {
		return input.finalDisplayedUrl;
	}
	return "unknown";
}

/**
 * Run the appropriate collector for a given file.
 * Uses sensible defaults for collector options (matching the CLI defaults).
 */
export async function runCollector(
	key: CollectorKey,
	filePath: string,
	metadata: CommonMetadata,
	urlOverride?: string,
): Promise<CollectorOutput> {
	switch (key) {
		case "eslint": {
			const input = await readJsonFile(filePath);
			const documents = collectEslint(input, metadata, {
				includeRules: true,
				topRules: 25,
				includeAllFiles: false,
				topFiles: 0,
			});
			return { metricType: "eslint", documents };
		}

		case "biome": {
			const input = await readJsonFile(filePath);
			const documents = collectBiome(input, metadata, {
				includeRules: true,
				topRules: 25,
				includeAllFiles: false,
				topFiles: 0,
			});
			return { metricType: "biome", documents };
		}

		case "coverage-js": {
			const input = await readJsonFile(filePath);
			const documents = collectCoverageJs(input, metadata);
			return { metricType: "coverage-js", documents };
		}

		case "coverage-dotnet": {
			const input = await readTextFile(filePath);
			const documents = collectCoverageDotnet(input, metadata);
			return { metricType: "coverage-dotnet", documents };
		}

		case "sarif": {
			const input = await readJsonFile(filePath);
			const documents = collectSarif(input, metadata, {
				includeRules: true,
				topRules: 25,
			});
			return { metricType: "sarif", documents };
		}

		case "lighthouse": {
			const input = await readJsonFile(filePath);
			const url = urlOverride ?? extractLighthouseUrl(input);
			const documents = collectLighthouse(input, metadata, url);
			return { metricType: "lighthouse", documents };
		}

		case "junit": {
			const input = await readTextFile(filePath);
			const documents = collectJunit(input, metadata);
			return { metricType: "junit", documents };
		}
	}
}

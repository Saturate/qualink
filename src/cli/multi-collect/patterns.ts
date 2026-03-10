import type { MetricType } from "../../types.js";

export type CollectorKey = Extract<
	MetricType,
	"eslint" | "biome" | "coverage-js" | "coverage-dotnet" | "sarif" | "lighthouse" | "junit"
>;

export const COLLECTOR_KEYS: readonly CollectorKey[] = [
	"eslint",
	"biome",
	"coverage-js",
	"coverage-dotnet",
	"sarif",
	"lighthouse",
	"junit",
] as const;

export interface FilePattern {
	/** Match against basename only */
	basename?: string;
	/** Match basename prefix (e.g. "lhr-") */
	prefix?: string;
	/** Match file extension(s) including the dot */
	extensions?: string[];
	/** Only match inside directories with this name */
	parentDir?: string;
}

export const COLLECTOR_PATTERNS: Record<CollectorKey, FilePattern[]> = {
	eslint: [{ basename: "eslint-report.json" }],
	biome: [{ basename: "biome-report.json" }],
	"coverage-js": [{ basename: "coverage-summary.json" }],
	"coverage-dotnet": [
		{ basename: "coverage.cobertura.xml" },
		{ basename: "cobertura-coverage.xml" },
	],
	sarif: [{ extensions: [".sarif", ".sarif.json"] }],
	lighthouse: [{ prefix: "lhr-", extensions: [".json"], parentDir: ".lighthouseci" }],
	junit: [{ basename: "junit.xml" }, { prefix: "TEST-", extensions: [".xml"] }],
};

export const IGNORED_DIRS = new Set(["node_modules", ".git"]);

export function isCollectorKey(value: string): value is CollectorKey {
	return (COLLECTOR_KEYS as readonly string[]).includes(value);
}

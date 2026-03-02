import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createSink } from "../sinks/index.js";
import type { CommonMetadata, Language, MetricType, NormalizedDocument } from "../types.js";
import { asOptionalString, assertNonEmpty } from "../utils/assert.js";
import { readJsonFile, readTextFile } from "../utils/file.js";

const DEFAULT_COLLECTOR_VERSION = "0.1.0";

export class CliError extends Error {
	public readonly exitCode: number;

	public constructor(message: string, exitCode: number) {
		super(message);
		this.exitCode = exitCode;
	}
}

export interface CommonArgs {
	[key: string]: unknown;
	input?: unknown;
	sink?: unknown;
	repo?: unknown;
	category?: unknown;
	tags?: unknown;
	branch?: unknown;
	commitSha?: unknown;
	pipelineRunId?: unknown;
	pipelineProvider?: unknown;
	environment?: unknown;
	package?: unknown;
	project?: unknown;
	collectorVersion?: unknown;
	elasticUrl?: unknown;
	elasticApiKey?: unknown;
	retryMax?: unknown;
	retryBackoffMs?: unknown;
	allowEmpty?: unknown;
}

function argValue(args: CommonArgs, key: string, altKey?: string): unknown {
	const primary = args[key];
	if (primary !== undefined) {
		return primary;
	}

	if (!altKey) {
		return undefined;
	}

	return args[altKey];
}

export function isDryRun(args: CommonArgs): boolean {
	return argValue(args, "dryRun", "dry-run") === true;
}

function envOrArg(argValue: unknown, envKey: string): string | undefined {
	if (typeof argValue === "string" && argValue.trim().length > 0) {
		return argValue;
	}

	const envValue = process.env[envKey];
	if (envValue && envValue.trim().length > 0) {
		return envValue;
	}

	return undefined;
}

function parseNumberInput(value: unknown, fallback: number): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return fallback;
}

function parseTags(value: unknown): string[] {
	if (typeof value !== "string" || value.trim().length === 0) {
		return [];
	}

	const tags = value
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);

	return [...new Set(tags)];
}

function runGit(args: string[]): string | undefined {
	try {
		const output = execFileSync("git", args, {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});

		const trimmed = output.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	} catch {
		return undefined;
	}
}

function parseRepoFromRemote(remoteUrl: string): string | undefined {
	if (remoteUrl.length === 0) {
		return undefined;
	}

	const normalized = remoteUrl.replace(/\.git$/, "");
	const slashIndex = normalized.lastIndexOf("/");
	const colonIndex = normalized.lastIndexOf(":");
	const splitIndex = Math.max(slashIndex, colonIndex);

	if (splitIndex < 0 || splitIndex === normalized.length - 1) {
		return undefined;
	}

	return normalized.slice(splitIndex + 1);
}

function detectRepo(args: CommonArgs): string {
	const explicit = envOrArg(argValue(args, "repo"), "QUALINK_REPO");
	if (explicit) {
		return explicit;
	}

	const ciRepo =
		process.env.BUILD_REPOSITORY_NAME ??
		process.env.GITHUB_REPOSITORY ??
		process.env.CI_PROJECT_PATH;
	if (ciRepo && ciRepo.trim().length > 0) {
		const parsed = parseRepoFromRemote(ciRepo);
		return parsed ?? ciRepo;
	}

	const origin = runGit(["remote", "get-url", "origin"]);
	if (origin) {
		const parsed = parseRepoFromRemote(origin);
		if (parsed) {
			return parsed;
		}
	}

	return basename(process.cwd());
}

function detectBranch(args: CommonArgs): string {
	return (
		envOrArg(argValue(args, "branch"), "QUALINK_BRANCH") ??
		process.env.BUILD_SOURCEBRANCHNAME ??
		process.env.GITHUB_REF_NAME ??
		process.env.CI_COMMIT_REF_NAME ??
		runGit(["rev-parse", "--abbrev-ref", "HEAD"]) ??
		"local"
	);
}

function detectCommitSha(args: CommonArgs): string {
	return (
		envOrArg(argValue(args, "commitSha", "commit-sha"), "QUALINK_COMMIT_SHA") ??
		process.env.BUILD_SOURCEVERSION ??
		process.env.GITHUB_SHA ??
		process.env.CI_COMMIT_SHA ??
		runGit(["rev-parse", "HEAD"]) ??
		"local"
	);
}

function detectPipelineRunId(args: CommonArgs): string {
	return (
		envOrArg(argValue(args, "pipelineRunId", "pipeline-run-id"), "QUALINK_PIPELINE_RUN_ID") ??
		process.env.BUILD_BUILDID ??
		process.env.GITHUB_RUN_ID ??
		process.env.CI_PIPELINE_ID ??
		`local-${Date.now().toString()}`
	);
}

function detectPipelineProvider(args: CommonArgs): string {
	const explicit = envOrArg(
		argValue(args, "pipelineProvider", "pipeline-provider"),
		"QUALINK_PIPELINE_PROVIDER",
	);
	if (explicit) {
		return explicit;
	}

	if (process.env.TF_BUILD === "True") {
		return "azure-devops";
	}

	if (process.env.GITHUB_ACTIONS === "true") {
		return "github-actions";
	}

	if (process.env.CI === "true") {
		return "ci";
	}

	return "local";
}

function readPackageJsonName(): string | undefined {
	try {
		const pkgPath = resolve("package.json");
		if (!existsSync(pkgPath)) {
			return undefined;
		}
		const raw = JSON.parse(readFileSync(pkgPath, "utf-8")) as unknown;
		if (typeof raw === "object" && raw !== null && "name" in raw && typeof raw.name === "string") {
			return raw.name;
		}
	} catch {
		// ignore
	}
	return undefined;
}

function isInsideWorkspacePackage(): boolean {
	const gitRoot = runGit(["rev-parse", "--show-toplevel"]);
	if (!gitRoot) {
		return false;
	}
	return resolve(".") !== resolve(gitRoot);
}

function detectPackageName(args: CommonArgs): string | undefined {
	const explicit = envOrArg(argValue(args, "package"), "QUALINK_PACKAGE");
	if (explicit) {
		return explicit;
	}

	const pnpmName = process.env.PNPM_PACKAGE_NAME;
	if (pnpmName && pnpmName.trim().length > 0) {
		return pnpmName;
	}

	// Auto-detect from ./package.json when running inside a workspace subdirectory
	if (isInsideWorkspacePackage()) {
		return readPackageJsonName();
	}

	return undefined;
}

function readCsprojName(): string | undefined {
	try {
		const files = readdirSync(".");
		const csproj = files.find((f) => f.endsWith(".csproj"));
		if (csproj) {
			return basename(csproj, ".csproj");
		}
	} catch {
		// ignore
	}
	return undefined;
}

function detectProjectName(args: CommonArgs): string | undefined {
	const explicit = envOrArg(argValue(args, "project"), "QUALINK_PROJECT");
	if (explicit) {
		return explicit;
	}

	// Auto-detect from .csproj when running inside a project subdirectory
	if (isInsideWorkspacePackage()) {
		return readCsprojName();
	}

	return undefined;
}

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

export function parseCommonMetadata(args: CommonArgs): CommonMetadata {
	const repo = detectRepo(args);
	const category = asOptionalString(envOrArg(argValue(args, "category"), "QUALINK_CATEGORY"));
	const rawTags = envOrArg(argValue(args, "tags"), "QUALINK_TAGS") ?? `repo:${repo}`;
	const tags = parseTags(rawTags);
	const branch = detectBranch(args);
	const commitSha = detectCommitSha(args);
	const pipelineRunId = detectPipelineRunId(args);
	const pipelineProvider = detectPipelineProvider(args);
	const environmentRaw = envOrArg(argValue(args, "environment"), "QUALINK_ENVIRONMENT") ?? "ci";
	const collectorVersion =
		envOrArg(
			argValue(args, "collectorVersion", "collector-version"),
			"QUALINK_COLLECTOR_VERSION",
		) ?? DEFAULT_COLLECTOR_VERSION;

	if (
		environmentRaw !== "dev" &&
		environmentRaw !== "test" &&
		environmentRaw !== "prod" &&
		environmentRaw !== "ci"
	) {
		throw new CliError(`Invalid environment '${environmentRaw}'. Expected dev|test|prod|ci`, 2);
	}

	return {
		repo,
		category,
		tags,
		branch,
		commitSha,
		pipelineRunId,
		pipelineProvider,
		environment: environmentRaw,
		packageName: asOptionalString(detectPackageName(args)),
		projectName: asOptionalString(detectProjectName(args)),
		collectorVersion,
	};
}

export async function loadJsonInput(args: CommonArgs): Promise<unknown> {
	const inputPath = assertNonEmpty(argValue(args, "input"), "input");
	return readJsonFile(inputPath);
}

export async function loadTextInput(args: CommonArgs): Promise<string> {
	const inputPath = assertNonEmpty(argValue(args, "input"), "input");
	return readTextFile(inputPath);
}

export const commonArgs = {
	input: { type: "string" as const, required: true as const },
	sink: { type: "string" as const, default: "elastic" },
	repo: { type: "string" as const },
	category: { type: "string" as const },
	tags: { type: "string" as const },
	branch: { type: "string" as const },
	"commit-sha": { type: "string" as const },
	"pipeline-run-id": { type: "string" as const },
	"pipeline-provider": { type: "string" as const },
	environment: { type: "string" as const, default: "ci" },
	package: { type: "string" as const },
	project: { type: "string" as const },
	"collector-version": { type: "string" as const },
	"elastic-url": { type: "string" as const },
	"elastic-api-key": { type: "string" as const },
	"retry-max": { type: "string" as const },
	"retry-backoff-ms": { type: "string" as const },
	"allow-empty": { type: "boolean" as const, default: false },
	"dry-run": { type: "boolean" as const, default: false },
} as const;

export async function sendToSink(
	metricType: MetricType,
	args: CommonArgs,
	documents: NormalizedDocument[],
): Promise<void> {
	if (documents.length === 0 && argValue(args, "allowEmpty", "allow-empty") !== true) {
		throw new CliError(
			`Collector produced no documents for '${metricType}'. Use --allow-empty to ignore`,
			2,
		);
	}

	if (isDryRun(args)) {
		process.stdout.write(
			`${JSON.stringify(
				{
					dry_run: true,
					metric_type: metricType,
					count: documents.length,
					documents,
				},
				null,
				2,
			)}\n`,
		);
		return;
	}

	const sinkKindRaw = (envOrArg(argValue(args, "sink"), "QUALINK_SINK") ?? "elastic").toLowerCase();
	if (sinkKindRaw !== "elastic" && sinkKindRaw !== "stdout") {
		throw new CliError(`Unsupported sink '${sinkKindRaw}'. Expected elastic|stdout`, 2);
	}
	const sinkKind: "elastic" | "stdout" = sinkKindRaw === "elastic" ? "elastic" : "stdout";

	const retryMax = parseNumberInput(argValue(args, "retryMax", "retry-max"), 2);
	const retryBackoffMs = parseNumberInput(
		argValue(args, "retryBackoffMs", "retry-backoff-ms"),
		500,
	);

	const elasticUrl = envOrArg(argValue(args, "elasticUrl", "elastic-url"), "ELASTIC_URL");
	const elasticApiKey = envOrArg(
		argValue(args, "elasticApiKey", "elastic-api-key"),
		"ELASTIC_API_KEY",
	);

	const sinkConfigBase = {
		kind: sinkKind,
		retryMax,
		retryBackoffMs,
	};

	const sinkConfig =
		sinkKind === "elastic"
			? {
					...sinkConfigBase,
					...(elasticUrl ? { elasticUrl } : {}),
					...(elasticApiKey ? { elasticApiKey } : {}),
				}
			: sinkConfigBase;

	const sink = createSink(sinkConfig);

	await sink.send({
		metricType,
		documents,
	});
}

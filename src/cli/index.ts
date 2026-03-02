import { defineCommand, runMain } from "citty";
import {
	biomeCommand,
	coverageDotnetCommand,
	coverageJsCommand,
	eslintCommand,
	lighthouseCommand,
	sarifCommand,
} from "./commands/index.js";
import { CliError } from "./shared.js";

const collectCommand = defineCommand({
	meta: {
		name: "collect",
		description: "Collect quality metrics from a specific collector",
	},
	subCommands: {
		biome: biomeCommand,
		eslint: eslintCommand,
		lighthouse: lighthouseCommand,
		"coverage-js": coverageJsCommand,
		sarif: sarifCommand,
		"coverage-dotnet": coverageDotnetCommand,
	},
});

const main = defineCommand({
	meta: {
		name: "qualink",
		version: "0.1.0",
		description: "Collect, normalize, and relay code quality metrics",
	},
	subCommands: {
		collect: collectCommand,
	},
});

runMain(main).catch((error: unknown) => {
	if (error instanceof CliError) {
		process.stderr.write(`qualink error: ${error.message}\n`);
		process.exit(error.exitCode);
	}

	if (error instanceof Error) {
		process.stderr.write(`qualink error: ${error.message}\n`);
		process.exit(2);
	}

	process.stderr.write("qualink error: unknown failure\n");
	process.exit(2);
});

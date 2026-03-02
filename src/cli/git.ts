import { execFileSync } from "node:child_process";

export function runGit(args: string[]): string | undefined {
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

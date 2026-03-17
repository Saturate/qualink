/**
 * CLI logging — writes to stderr to keep stdout clean for
 * machine-readable output (JSON, summaries). This is standard Unix
 * convention: stdout = data, stderr = diagnostics.
 */

export function log(message: string): void {
	process.stderr.write(`${message}\n`);
}

export function warn(message: string): void {
	process.stderr.write(`${message}\n`);
}

export function error(message: string): void {
	process.stderr.write(`${message}\n`);
}

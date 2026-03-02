export class CliError extends Error {
	public readonly exitCode: number;

	public constructor(message: string, exitCode: number) {
		super(message);
		this.exitCode = exitCode;
	}
}

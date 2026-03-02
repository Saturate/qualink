import { readFile } from "node:fs/promises";

export async function readJsonFile(filePath: string): Promise<unknown> {
	const raw = await readFile(filePath, "utf-8");
	return JSON.parse(raw) as unknown;
}

export async function readTextFile(filePath: string): Promise<string> {
	return readFile(filePath, "utf-8");
}

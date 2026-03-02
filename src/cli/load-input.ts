import { assertNonEmpty } from "../utils/assert.js";
import { readJsonFile, readTextFile } from "../utils/file.js";
import { argValue, type CommonArgs } from "./common-args.js";

export async function loadJsonInput(args: CommonArgs): Promise<unknown> {
	const inputPath = assertNonEmpty(argValue(args, "input"), "input");
	return readJsonFile(inputPath);
}

export async function loadTextInput(args: CommonArgs): Promise<string> {
	const inputPath = assertNonEmpty(argValue(args, "input"), "input");
	return readTextFile(inputPath);
}

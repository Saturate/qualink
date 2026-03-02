import { collectCoverageDotnet } from "../../collectors/coverage-dotnet.js";
import { createCollectorCommand } from "../command-factory.js";
import { loadTextInput } from "../shared.js";

export const coverageDotnetCommand = createCollectorCommand({
	name: "coverage-dotnet",
	description: "Collect .NET coverage metrics and relay them",
	async collect(args, metadata) {
		const input = await loadTextInput(args);
		const documents = collectCoverageDotnet(input, metadata);
		return { metricType: "coverage-dotnet", documents };
	},
});

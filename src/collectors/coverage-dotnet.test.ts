import { describe, expect, it } from "vitest";
import { makeMetadata } from "../test-helpers.js";
import { collectCoverageDotnet } from "./coverage-dotnet.js";

const coberturaXml = `<?xml version="1.0"?>
<coverage lines-valid="200" lines-covered="180" branches-valid="50" branches-covered="40">
  <packages/>
</coverage>`;

describe("collectCoverageDotnet", () => {
	it("parses Cobertura format", () => {
		const [doc] = collectCoverageDotnet(coberturaXml, makeMetadata());
		expect(doc?.lines_total).toBe(200);
		expect(doc?.lines_covered).toBe(180);
		expect(doc?.lines_pct).toBe(90);
		expect(doc?.branches_total).toBe(50);
		expect(doc?.branches_covered).toBe(40);
		expect(doc?.branches_pct).toBe(80);
		expect(doc?.coverage_format).toBe("cobertura");
	});

	it("calculates percentages correctly", () => {
		const xml = `<?xml version="1.0"?>
<coverage lines-valid="3" lines-covered="1" branches-valid="0" branches-covered="0"/>`;
		const [doc] = collectCoverageDotnet(xml, makeMetadata());
		expect(doc?.lines_pct).toBe(33.33);
		expect(doc?.branches_pct).toBe(0);
	});

	it("sets languages to csharp", () => {
		const [doc] = collectCoverageDotnet(coberturaXml, makeMetadata());
		expect(doc?.languages).toEqual(["csharp"]);
	});

	it("throws on invalid XML", () => {
		expect(() => collectCoverageDotnet("<not><valid>", makeMetadata())).toThrow();
	});

	it("throws on unrecognized format", () => {
		const xml = `<?xml version="1.0"?><something/>`;
		expect(() => collectCoverageDotnet(xml, makeMetadata())).toThrow(
			"Unsupported coverage XML format",
		);
	});

	it("parses OpenCover format", () => {
		const xml = `<?xml version="1.0"?>
<CoverageSession>
  <Summary numSequencePoints="100" visitedSequencePoints="80"
           numBranchPoints="40" visitedBranchPoints="30" />
</CoverageSession>`;
		const [doc] = collectCoverageDotnet(xml, makeMetadata());
		expect(doc?.coverage_format).toBe("opencover");
		expect(doc?.lines_total).toBe(100);
		expect(doc?.lines_covered).toBe(80);
		expect(doc?.branches_total).toBe(40);
		expect(doc?.branches_covered).toBe(30);
	});

	it("handles OpenCover with empty Summary", () => {
		const xml = `<?xml version="1.0"?>
<CoverageSession>
  <Summary />
</CoverageSession>`;
		const [doc] = collectCoverageDotnet(xml, makeMetadata());
		expect(doc?.coverage_format).toBe("opencover");
		expect(doc?.lines_total).toBe(0);
		expect(doc?.lines_covered).toBe(0);
	});

	it("handles string attribute values", () => {
		const xml = `<?xml version="1.0"?>
<coverage lines-valid="200" lines-covered="180" branches-valid="50" branches-covered="40">
  <packages/>
</coverage>`;
		const [doc] = collectCoverageDotnet(xml, makeMetadata());
		expect(doc?.lines_total).toBe(200);
	});
});

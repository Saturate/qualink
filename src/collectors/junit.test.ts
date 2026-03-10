import { describe, expect, it } from "vitest";
import { makeMetadata } from "../test-helpers.js";
import { collectJunit } from "./junit.js";

describe("collectJunit", () => {
	it("parses multi-suite with failures, errors, and skipped", () => {
		const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="suite1" tests="10" failures="2" errors="1" skipped="1" time="1.5">
    <testcase name="a"/>
  </testsuite>
  <testsuite name="suite2" tests="5" failures="0" errors="0" skipped="0" time="0.8">
    <testcase name="b"/>
  </testsuite>
</testsuites>`;

		const [doc] = collectJunit(xml, makeMetadata());
		expect(doc?.tests).toBe(15);
		expect(doc?.failures).toBe(2);
		expect(doc?.errors).toBe(1);
		expect(doc?.skipped).toBe(1);
		expect(doc?.passed).toBe(11);
		expect(doc?.duration_ms).toBe(2300);
		expect(doc?.suites).toBe(2);
		expect(doc?.metric_type).toBe("junit");
	});

	it("handles single <testsuite> root (no wrapper)", () => {
		const xml = `<?xml version="1.0"?>
<testsuite name="only" tests="3" failures="1" errors="0" skipped="0" time="0.123">
  <testcase name="a"/>
</testsuite>`;

		const [doc] = collectJunit(xml, makeMetadata());
		expect(doc?.tests).toBe(3);
		expect(doc?.failures).toBe(1);
		expect(doc?.passed).toBe(2);
		expect(doc?.suites).toBe(1);
		expect(doc?.duration_ms).toBe(123);
	});

	it("returns duration_ms null when time attribute is missing", () => {
		const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="notime" tests="2" failures="0" errors="0" skipped="0">
    <testcase name="a"/>
  </testsuite>
</testsuites>`;

		const [doc] = collectJunit(xml, makeMetadata());
		expect(doc?.duration_ms).toBeNull();
	});

	it("handles empty suite (0 tests)", () => {
		const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="empty" tests="0" failures="0" errors="0" skipped="0" time="0"/>
</testsuites>`;

		const [doc] = collectJunit(xml, makeMetadata());
		expect(doc?.tests).toBe(0);
		expect(doc?.passed).toBe(0);
		expect(doc?.failures).toBe(0);
		expect(doc?.suites).toBe(1);
		expect(doc?.duration_ms).toBe(0);
	});

	it("throws on unrecognized XML", () => {
		const xml = `<?xml version="1.0"?><something/>`;
		expect(() => collectJunit(xml, makeMetadata())).toThrow("Unrecognized JUnit XML format");
	});

	it("throws on unparseable input", () => {
		expect(() => collectJunit("not xml at all <<<", makeMetadata())).toThrow();
	});

	it("handles testsuites with no child suites", () => {
		const xml = `<?xml version="1.0"?>
<testsuites/>`;

		const [doc] = collectJunit(xml, makeMetadata());
		expect(doc?.tests).toBe(0);
		expect(doc?.suites).toBe(0);
		expect(doc?.passed).toBe(0);
	});
});

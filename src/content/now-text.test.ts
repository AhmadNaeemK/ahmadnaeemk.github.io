import { describe, expect, it } from "vitest";
import { parseNowText } from "./now-text";

describe("parseNowText", () => {
  it("splits on the first colon, so a value can hold colons", () => {
    expect(parseNowText("Watching: Dune: Part Two")).toEqual([
      { label: "Watching", value: "Dune: Part Two" },
    ]);
  });

  it("trims the space around the label and the value", () => {
    expect(parseNowText("  Playing  :   Sekiro  ")).toEqual([
      { label: "Playing", value: "Sekiro" },
    ]);
  });

  it("keeps the items in file order", () => {
    const items = parseNowText("Zebra: last letter\nApple: first letter");

    expect(items.map(({ label }) => label)).toEqual(["Zebra", "Apple"]);
  });

  it("ignores comments and blank lines", () => {
    const text =
      "# A comment: with a colon\n\n   \n  # Indented\nPlaying: Sekiro\n";

    expect(parseNowText(text)).toEqual([{ label: "Playing", value: "Sekiro" }]);
  });

  it("keeps a # inside a value, because only a whole line can be a comment", () => {
    expect(parseNowText("Listening: Track #1")).toEqual([
      { label: "Listening", value: "Track #1" },
    ]);
  });

  it("reads a file saved with Windows line endings", () => {
    expect(parseNowText("Playing: Sekiro\r\nBuilding: A site\r\n")).toEqual([
      { label: "Playing", value: "Sekiro" },
      { label: "Building", value: "A site" },
    ]);
  });

  it("reads a file saved with a byte order mark", () => {
    expect(parseNowText("﻿Playing: Sekiro")).toEqual([
      { label: "Playing", value: "Sekiro" },
    ]);
    expect(parseNowText("﻿# A comment\nPlaying: Sekiro")).toEqual([
      { label: "Playing", value: "Sekiro" },
    ]);
  });

  it.each([
    "https://x.com",
    "Back at 12:30",
    "See https://x.com",
    "Playing:",
    ": text",
    "https://x.com: great",
  ])("keeps %s as plain text, exactly as written", (line) => {
    expect(parseNowText(line)).toEqual([{ value: line }]);
  });

  it("keeps a colon with only spaces after it as plain text, trimmed", () => {
    expect(parseNowText("  Playing:   ")).toEqual([{ value: "Playing:" }]);
  });

  it("labels a line whose value is a link", () => {
    expect(parseNowText("Reading: https://x.com")).toEqual([
      { label: "Reading", value: "https://x.com" },
    ]);
  });

  it("allows a label of 30 characters", () => {
    const label = "x".repeat(30);

    expect(parseNowText(`${label}: text`)).toEqual([{ label, value: "text" }]);
  });

  it("keeps a line as plain text when the part before the colon is 31 characters", () => {
    const line = `${"x".repeat(31)}: text`;

    expect(parseNowText(line)).toEqual([{ value: line }]);
  });

  it("allows a line of 200 characters", () => {
    const line = "x".repeat(200);

    expect(parseNowText(line)).toEqual([{ value: line }]);
  });

  it("rejects a line of 201 characters, naming the line", () => {
    const text = `# A comment\nPlaying: Sekiro\n${"x".repeat(201)}\n`;

    expect(() => parseNowText(text)).toThrow(
      'Line 3 is 201 characters long; "Right now" lines can be at most 200.',
    );
  });
});

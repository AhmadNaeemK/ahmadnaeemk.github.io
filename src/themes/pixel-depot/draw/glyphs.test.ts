import { describe, expect, it } from "vitest";
import { glyphFor, textWidth, toBoardText } from "./glyphs";

/** Every glyph in the font's table: 26 letters, 10 digits and 21 marks. */
const FONT = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."0123456789",
  ..."'\"-.·:;,!?&/()+=#%@_ ",
];

const inked = (character: string) =>
  glyphFor(character).join("").replaceAll("0", "");

describe("toBoardText", () => {
  it("capitalises, so every letter is one the font can draw", () => {
    expect(toBoardText("Reading Dune")).toBe("READING DUNE");
  });

  it("strips accents instead of leaving a gap where the letter was", () => {
    expect(toBoardText("Café Müller, São Paulo")).toBe(
      "CAFE MULLER, SAO PAULO",
    );
  });

  it("flattens typographic marks to the plain ones the font has", () => {
    expect(toBoardText("‘a’ “b” c–d e—f g…")).toBe(`'A' "B" C-D E-F G...`);
  });

  it("leaves nothing in real-world copy that would draw as a blank", () => {
    const flattened = toBoardText("Ahmad’s “Rêve” — 2 trains… 100% & more?");
    const blanks = [...flattened].filter(
      (character) => character !== " " && inked(character) === "",
    );
    expect(blanks).toEqual([]);
  });
});

describe("glyphFor", () => {
  it("gives every character in the font seven rows of one width, in 0s and 1s", () => {
    for (const character of FONT) {
      const rows = glyphFor(character);
      expect(rows, character).toHaveLength(7);
      expect(new Set(rows.map((row) => row.length)).size, character).toBe(1);
      expect(rows.join(""), character).toMatch(/^[01]+$/);
    }
  });

  it("inks every character in the font but the space", () => {
    // A missing glyph falls back to a valid blank, so the rows alone cannot show it.
    const blanks = FONT.filter((character) => inked(character) === "");
    expect(blanks).toEqual([" "]);
  });

  it("draws a character the font lacks as a blank, in place of throwing", () => {
    for (const unknown of ["€", "猫", "🚂"]) {
      expect(glyphFor(unknown)).toEqual(glyphFor(" "));
      expect(inked(unknown)).toBe("");
    }
  });
});

describe("textWidth", () => {
  it("is nothing for no text", () => {
    expect(textWidth("")).toBe(0);
  });

  it("adds one pixel after every character", () => {
    expect(textWidth("A")).toBe(6);
    expect(textWidth("I")).toBe(4);
    expect(textWidth("AI")).toBe(10);
  });

  it("gives a character the font lacks a space's width, so text after it stays put", () => {
    expect(textWidth("A€B")).toBe(textWidth("A B"));
  });

  it("counts a character outside the basic plane once, not as two halves", () => {
    expect(textWidth("🚂")).toBe(textWidth(" "));
  });
});

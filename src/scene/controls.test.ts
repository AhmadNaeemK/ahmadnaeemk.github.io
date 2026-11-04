import { describe, expect, it } from "vitest";
import { toggleAppearance } from "./controls";

const RUNNING_FLAGS = { userStopped: false, textPaused: false };
const REDUCED_START_FLAGS = { userStopped: true, textPaused: false };
const STOPPED_FLAGS = { userStopped: true, textPaused: true };

const RUNNING = { state: "go", pressed: false, label: "Stop the train" };
const PAUSE_TEXT = { state: "stop", pressed: false, label: "Pause the text" };
const STOPPED = { state: "stop", pressed: true, label: "Start the train" };

describe("toggleAppearance", () => {
  it.each([
    ["running", RUNNING_FLAGS, RUNNING],
    ["the reduced-motion start", REDUCED_START_FLAGS, PAUSE_TEXT],
    ["stopped", STOPPED_FLAGS, STOPPED],
  ])("at wide widths, %s shows its row of the table", (_, flags, expected) => {
    expect(toggleAppearance(flags, false)).toEqual(expected);
  });

  it("offers to start the train on the reduced-motion start at compact widths, where no text moves", () => {
    expect(toggleAppearance(REDUCED_START_FLAGS, true)).toEqual(STOPPED);
  });

  it.each([
    ["running", RUNNING_FLAGS, RUNNING],
    ["stopped", STOPPED_FLAGS, STOPPED],
  ])("at compact widths, %s looks the same as wide", (_, flags, expected) => {
    expect(toggleAppearance(flags, true)).toEqual(expected);
  });
});

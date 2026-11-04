import { afterEach, describe, expect, it } from "vitest";
import { dateLabels, formatEnd, formatMonth, isChronological } from "./month";

describe("formatMonth", () => {
  it.each([
    ["2024-01", "Jan 2024"],
    ["2024-07", "Jul 2024"],
    ["2024-12", "Dec 2024"],
  ])("formats %s as %s", (month, label) => {
    expect(formatMonth(month)).toBe(label);
  });

  it.each([
    "2024-13",
    "2024-00",
    "2024-7",
    "24-07",
    "2024-07-01",
    "Jul 2024",
    "present",
    "",
  ])("throws an error quoting the bad value for %j", (badMonth) => {
    expect(() => formatMonth(badMonth)).toThrow(
      `Expected a month as "YYYY-MM", got "${badMonth}"`,
    );
  });
});

describe("formatEnd", () => {
  it('shows the word "present" as "Present"', () => {
    expect(formatEnd("present")).toBe("Present");
  });

  it("shows a month the same way as a start date", () => {
    expect(formatEnd("2024-07")).toBe("Jul 2024");
  });

  it('throws on a capitalised "Present", which only the lowercase word means ongoing', () => {
    expect(() => formatEnd("Present")).toThrow('got "Present"');
  });
});

describe("isChronological", () => {
  it.each([
    ["an end after the start", "2021-07", "2024-07"],
    ["an end in the same month", "2024-07", "2024-07"],
    ["an end in the next year with a lower month number", "2023-12", "2024-01"],
    ["an ongoing end", "2024-07", "present"],
  ])("accepts %s", (_case, start, end) => {
    expect(isChronological(start, end)).toBe(true);
  });

  it.each([
    ["an end earlier in the same year", "2024-07", "2024-06"],
    [
      "an end in an earlier year with a higher month number",
      "2024-01",
      "2023-12",
    ],
  ])("rejects %s", (_case, start, end) => {
    expect(isChronological(start, end)).toBe(false);
  });
});

describe("dateLabels", () => {
  it('joins an ongoing range as "Jul 2024 – Present"', () => {
    expect(dateLabels("2024-07", "present")).toEqual({
      startLabel: "Jul 2024",
      endLabel: "Present",
      dates: "Jul 2024 – Present",
    });
  });

  it("joins a finished range with both months", () => {
    expect(dateLabels("2021-07", "2024-07").dates).toBe("Jul 2021 – Jul 2024");
  });

  it("throws when the start is not a month", () => {
    expect(() => dateLabels("Jul 2024", "present")).toThrow('got "Jul 2024"');
  });
});

describe("timezone independence", () => {
  const originalZone = process.env.TZ;

  // Node re-reads the zone when TZ is assigned, as long as tests run in a process
  // rather than a worker thread. The first test fails if that ever stops holding.
  function useZone(zone: string) {
    process.env.TZ = zone;
  }

  function monthThroughDate(month: string) {
    return new Date(`${month}-01`).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }

  afterEach(() => {
    if (originalZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalZone;
    }
  });

  it("uses zones that would move a month parsed through Date, so the checks below can fail", () => {
    useZone("Pacific/Honolulu");
    expect(monthThroughDate("2024-01")).toBe("Dec 2023");

    useZone("UTC");
    expect(monthThroughDate("2024-01")).toBe("Jan 2024");
  });

  it.each([
    "Pacific/Honolulu", // UTC-10: midnight UTC on the 1st is still the previous month
    "UTC",
    "Asia/Karachi",
    "Pacific/Kiritimati", // UTC+14: local midnight on the 1st is the previous month in UTC
  ])("shows year-boundary months unchanged in %s", (zone) => {
    useZone(zone);

    expect(dateLabels("2024-01", "2024-12")).toEqual({
      startLabel: "Jan 2024",
      endLabel: "Dec 2024",
      dates: "Jan 2024 – Dec 2024",
    });
  });
});

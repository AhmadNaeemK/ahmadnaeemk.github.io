import { describe, expect, it } from "vitest";
import {
  sectionKeyFromHash,
  sectionKeyInView,
  type ScrollMeasure,
} from "./theme";
import { SECTION_KEYS, sectionId, THEME_NAMES } from "./contract";

const VIEWPORT = 800;
const PAGE_HEIGHT = 5000;

/** Sections laid out 500 px apart, the first of them at `firstTop`. */
function sectionsFrom(
  firstTop: number,
  scrollMarginTop = 0,
): ScrollMeasure["sections"] {
  return SECTION_KEYS.map((key, index) => ({
    key,
    top: firstTop + index * 500,
    scrollMarginTop,
  }));
}

function measure(overrides: Partial<ScrollMeasure>): ScrollMeasure {
  return {
    scrollY: 300,
    viewportHeight: VIEWPORT,
    scrollHeight: PAGE_HEIGHT,
    sections: sectionsFrom(0),
    ...overrides,
  };
}

describe("sectionKeyInView", () => {
  it("answers the last section that has reached the viewport top", () => {
    // top at -500, about at 0, work at 500: work has not arrived yet.
    expect(sectionKeyInView(measure({ sections: sectionsFrom(-500) }))).toBe(
      "about",
    );
  });

  it("answers top when no section has reached the viewport top", () => {
    expect(
      sectionKeyInView(measure({ scrollY: 0, sections: sectionsFrom(60) })),
    ).toBe("top");
  });

  it("answers top for a page with no section found", () => {
    expect(sectionKeyInView(measure({ sections: [] }))).toBe("top");
  });

  it("counts a section parked below a sticky header by its scroll margin", () => {
    // Without the margin, about at 64 reads as not arrived, and every switch would
    // walk the visitor back one section.
    const sections = sectionsFrom(-436, 64);
    expect(sectionKeyInView(measure({ sections }))).toBe("about");
  });

  it("does not count a section further down than its scroll margin", () => {
    const sections = sectionsFrom(-434, 64);
    expect(sectionKeyInView(measure({ sections }))).toBe("top");
  });

  it("absorbs a scroll that lands up to 1 px short of the section", () => {
    expect(sectionKeyInView(measure({ sections: sectionsFrom(-499) }))).toBe(
      "about",
    );
  });

  it("does not stretch that tolerance beyond 1 px", () => {
    expect(sectionKeyInView(measure({ sections: sectionsFrom(-498.5) }))).toBe(
      "top",
    );
  });

  describe("at the bottom of the page", () => {
    // A short contact section that can never reach the viewport top: skills is the
    // last section the top rule could find.
    const shortContact: ScrollMeasure["sections"] = [
      { key: "skills", top: -200, scrollMarginTop: 0 },
      { key: "contact", top: 500, scrollMarginTop: 0 },
    ];

    it("answers contact, which may never reach the viewport top", () => {
      expect(
        sectionKeyInView(
          measure({
            scrollY: PAGE_HEIGHT - VIEWPORT,
            sections: shortContact,
          }),
        ),
      ).toBe("contact");
    });

    it("allows the 1 px a scroll can land short of the bottom", () => {
      expect(
        sectionKeyInView(
          measure({
            scrollY: PAGE_HEIGHT - VIEWPORT - 1,
            sections: shortContact,
          }),
        ),
      ).toBe("contact");
    });

    it("does not answer contact 2 px short of the bottom", () => {
      expect(
        sectionKeyInView(
          measure({
            scrollY: PAGE_HEIGHT - VIEWPORT - 2,
            sections: shortContact,
          }),
        ),
      ).toBe("skills");
    });

    it("does not answer contact for a page too short to scroll", () => {
      // scrollY 0 is "at the bottom" of such a page, but the visitor has not moved.
      expect(
        sectionKeyInView(
          measure({
            scrollY: 0,
            scrollHeight: VIEWPORT,
            sections: sectionsFrom(60),
          }),
        ),
      ).toBe("top");
    });
  });
});

describe("sectionKeyFromHash", () => {
  it.each(
    THEME_NAMES.flatMap((theme) =>
      SECTION_KEYS.map((key) => ({ key, hash: `#${sectionId(theme, key)}` })),
    ),
  )("reads $key from $hash", ({ hash, key }) => {
    expect(sectionKeyFromHash(hash)).toBe(key);
  });

  it.each(THEME_NAMES)(
    "reads no section from the theme hash of %s",
    (theme) => {
      expect(sectionKeyFromHash(`#${theme}`)).toBeNull();
    },
  );

  it.each([
    "",
    "#",
    "#z-about",
    "#a-",
    "#a-constructor",
    "#a-__proto__",
    "#about",
    "a-about",
    "#A-ABOUT",
    "#a-about ",
    "#constructor",
    "#__proto__",
    "#toString",
    "#hasOwnProperty",
    "constructor",
    "__proto__",
    "toString",
  ])("reads no section from the hostile hash %j", (hash) => {
    expect(sectionKeyFromHash(hash)).toBeNull();
  });
});

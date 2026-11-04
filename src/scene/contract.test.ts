import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COLOR_SCHEME_ATTRIBUTE,
  DEFAULT_THEME,
  effectiveColorScheme,
  isThemeName,
  NAV_SECTIONS,
  resolveThemeName,
  SECTION_KEYS,
  sectionId,
  showingTheme,
  THEME_ATTRIBUTE,
  THEME_BY_HASH,
  themeFromHash,
  THEME_NAMES,
  themeHash,
} from "./contract";

/** Values that can reach the helpers from an attribute, storage or a hash. */
const NOT_THEME_NAMES: readonly (readonly [label: string, value: unknown])[] = [
  ["a missing attribute", null],
  ["a missing value", undefined],
  ["an empty string", ""],
  ["a removed theme name", "rail-classic"],
  ["a prototype concept id", "a"],
  ["the wrong case", "Diorama"],
  ["surrounding whitespace", " diorama "],
  ["hash text, which goes through themeFromHash", "#diorama"],
  ["a property every object inherits", "constructor"],
  ["the prototype key", "__proto__"],
  ["a number", 42],
  ["an array holding a real name", ["diorama"]],
  ["an object that stringifies to a real name", { toString: () => "diorama" }],
  ["an object with no prototype", Object.create(null)],
];

describe("isThemeName", () => {
  it.each(THEME_NAMES)("accepts %s", (name) => {
    expect(isThemeName(name)).toBe(true);
  });

  it.each(NOT_THEME_NAMES)("rejects %s", (_label, value) => {
    expect(isThemeName(value)).toBe(false);
  });
});

describe("resolveThemeName", () => {
  it.each(THEME_NAMES)("keeps the valid name %s", (name) => {
    expect(resolveThemeName(name)).toBe(name);
  });

  it.each(NOT_THEME_NAMES)(
    "falls back to Interchange, without throwing, for %s",
    (_label, value) => {
      expect(resolveThemeName(value)).toBe("interchange");
    },
  );
});

describe("themeHash", () => {
  it.each([
    ["interchange", "#interchange"],
    ["diorama", "#diorama"],
    ["pixel-depot", "#pixel-depot"],
  ] as const)("links %s as %s", (name, hash) => {
    expect(themeHash(name)).toBe(hash);
  });
});

describe("themeFromHash", () => {
  it.each([
    ["#interchange", "interchange"],
    ["#diorama", "diorama"],
    ["#pixel-depot", "pixel-depot"],
  ] as const)("reads the theme hash %s as %s", (hash, theme) => {
    expect(themeFromHash(hash)).toBe(theme);
  });

  it.each([
    ["#a-top", "interchange"],
    ["#b-about", "diorama"],
    ["#c-contact", "pixel-depot"],
  ] as const)("reads the section hash %s as %s", (hash, theme) => {
    expect(themeFromHash(hash)).toBe(theme);
  });

  it.each(THEME_NAMES)("round-trips every hash that links to %s", (theme) => {
    const hashes = [
      themeHash(theme),
      ...SECTION_KEYS.map((key) => `#${sectionId(theme, key)}`),
    ];

    for (const hash of hashes) {
      expect(themeFromHash(hash)).toBe(theme);
    }
  });

  it.each([
    "",
    "#",
    "diorama",
    "b-about",
    "#b-nope",
    "#d-about",
    "#diorama-about",
    "#DIORAMA",
    "#top",
    "#b-",
    "#constructor",
    "#__proto__",
  ])("returns null for %j, which names no theme", (hash) => {
    expect(themeFromHash(hash)).toBeNull();
  });
});

describe("THEME_BY_HASH", () => {
  it("holds every theme hash and section hash, and nothing else", () => {
    const expectedHashes = THEME_NAMES.flatMap((theme) => [
      themeHash(theme),
      ...SECTION_KEYS.map((key) => `#${sectionId(theme, key)}`),
    ]);

    expect(Object.keys(THEME_BY_HASH).sort()).toEqual(expectedHashes.sort());
  });

  it("agrees with themeFromHash on every entry", () => {
    for (const [hash, theme] of Object.entries(THEME_BY_HASH)) {
      expect(themeFromHash(hash)).toBe(theme);
    }
  });

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
    "does not let themeFromHash return the inherited property %s",
    (name) => {
      expect(themeFromHash(name)).toBeNull();
    },
  );

  // The head script indexes the table directly with `location.hash`, which is
  // empty or starts with `#`, so it must never reach an inherited property.
  it.each(["", "#", "#constructor", "#__proto__", "#toString", "#b-nope"])(
    "has nothing for the location.hash value %j",
    (hash) => {
      expect(THEME_BY_HASH[hash]).toBeUndefined();
    },
  );
});

describe("sectionId", () => {
  it.each([
    [
      "interchange",
      ["a-top", "a-about", "a-work", "a-projects", "a-skills", "a-contact"],
    ],
    [
      "diorama",
      ["b-top", "b-about", "b-work", "b-projects", "b-skills", "b-contact"],
    ],
    [
      "pixel-depot",
      ["c-top", "c-about", "c-work", "c-projects", "c-skills", "c-contact"],
    ],
  ] as const)("gives %s its six ids, in page order", (theme, ids) => {
    expect(SECTION_KEYS.map((key) => sectionId(theme, key))).toEqual(ids);
  });

  it("never repeats an id, because all three themes share one page", () => {
    const allIds = THEME_NAMES.flatMap((theme) =>
      SECTION_KEYS.map((key) => sectionId(theme, key)),
    );

    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("NAV_SECTIONS", () => {
  it("links every section except top, in page order", () => {
    expect(NAV_SECTIONS.map(({ key }) => key)).toEqual(
      SECTION_KEYS.filter((key) => key !== "top"),
    );
  });
});

describe("the reads of <html>", () => {
  /** What can sit in an attribute: anything a script or a stale page wrote there. */
  const HOSTILE_ATTRIBUTES = [
    "",
    "constructor",
    "__proto__",
    "toString",
    "DARK",
    " dark ",
    "a-about",
  ];

  function stubHtml(
    attributes: Record<string, string>,
    systemIsDark = false,
  ): void {
    vi.stubGlobal("document", {
      documentElement: {
        getAttribute: (name: string) =>
          Object.hasOwn(attributes, name) ? attributes[name] : null,
      },
    });
    vi.stubGlobal("matchMedia", () => ({ matches: systemIsDark }));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("showingTheme", () => {
    it.each(THEME_NAMES)("reads %s", (theme) => {
      stubHtml({ [THEME_ATTRIBUTE]: theme });
      expect(showingTheme()).toBe(theme);
    });

    it("is the default theme with the attribute missing", () => {
      stubHtml({});
      expect(showingTheme()).toBe(DEFAULT_THEME);
    });

    it.each(HOSTILE_ATTRIBUTES)("is the default theme for %j", (value) => {
      stubHtml({ [THEME_ATTRIBUTE]: value });
      expect(showingTheme()).toBe(DEFAULT_THEME);
    });
  });

  describe("effectiveColorScheme", () => {
    it.each([
      { picked: "light", systemIsDark: true },
      { picked: "dark", systemIsDark: false },
      { picked: "light", systemIsDark: false },
      { picked: "dark", systemIsDark: true },
    ] as const)(
      "is the pick, $picked, with the system dark: $systemIsDark",
      ({ picked, systemIsDark }) => {
        stubHtml({ [COLOR_SCHEME_ATTRIBUTE]: picked }, systemIsDark);
        expect(effectiveColorScheme()).toBe(picked);
      },
    );

    it.each([
      { systemIsDark: true, expected: "dark" },
      { systemIsDark: false, expected: "light" },
    ])(
      "follows the system with no pick: dark $systemIsDark gives $expected",
      ({ systemIsDark, expected }) => {
        stubHtml({}, systemIsDark);
        expect(effectiveColorScheme()).toBe(expected);
      },
    );

    it.each(HOSTILE_ATTRIBUTES)(
      "treats %j as no pick, and follows the system",
      (value) => {
        stubHtml({ [COLOR_SCHEME_ATTRIBUTE]: value }, true);
        expect(effectiveColorScheme()).toBe("dark");
        stubHtml({ [COLOR_SCHEME_ATTRIBUTE]: value }, false);
        expect(effectiveColorScheme()).toBe("light");
      },
    );
  });
});

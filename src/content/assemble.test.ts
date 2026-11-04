import { describe, expect, it } from "vitest";
import { assembleSiteContent, type RawCollections } from "./assemble";

type CollectionName = keyof RawCollections;
type ProfileData = RawCollections["profile"][number]["data"];
type ImageData = ProfileData["portraitPixels"];

const ORDERED_COLLECTIONS = [
  "experience",
  "education",
  "projects",
  "skills",
] as const;

const image = (overrides: Partial<ImageData> = {}): ImageData => ({
  src: "/_astro/image.hash.jpg",
  width: 480,
  height: 600,
  format: "jpg",
  ...overrides,
});

const pixelImage = (): ImageData =>
  image({
    src: "/_astro/portrait-px.hash.png",
    width: 48,
    height: 60,
    format: "png",
  });

const profileEntry = (id = "ahmad") => ({
  id,
  data: {
    name: "Ahmad Naeem",
    handle: "ahmad",
    role: "Senior Software Engineer",
    focus: "Full-stack",
    location: "Lahore",
    email: "ahmad@example.com",
    linkedin: "https://www.linkedin.com/in/example",
    linkedinLabel: "linkedin.com/in/example",
    github: "https://github.com/example",
    githubLabel: "github.com/example",
    cv: "/cv.pdf",
    intro: "I build products.",
    about: ["A paragraph."],
    favouriteGame: "Sekiro",
    projectsLede: "Products I built.",
    contactLead: "Email me first.",
    contactNote: "Email is fastest.",
    facts: [{ value: "5+", label: "years" }],
    portrait: image(),
    portraitAlt: "Ahmad smiling",
    contactPhoto: image(),
    portraitPixels: pixelImage(),
  },
});

const experienceEntry = (id: string, order: number) => ({
  id,
  data: {
    order,
    title: "Engineer",
    org: "Arbisoft",
    start: "2024-07",
    end: "present",
    points: ["Shipped apps"],
  },
});

const educationEntry = (id: string, order: number) => ({
  id,
  data: {
    order,
    degree: "BE",
    school: "NUST",
    place: "Islamabad",
    start: "2017-09",
    end: "2021-07",
  },
});

const projectEntry = (id: string, order: number) => ({
  id,
  data: {
    order,
    name: "Gumdrop",
    monogram: "G",
    color: "tomato" as const,
    logo: image(),
    blurb: "Scheduling",
    role: "Engineer",
    start: "2025-06",
    end: "present",
    points: ["Billing"],
    tech: ["Next.js"],
  },
});

const skillEntry = (id: string, order: number) => ({
  id,
  data: { order, group: "Languages", items: ["TypeScript"] },
});

const nowEntry = (id = "current") => ({
  id,
  data: {
    items: [
      { label: "Playing", value: "Sekiro" },
      { label: "Building", value: "a portfolio" },
    ],
  },
});

const ORDERED_ENTRY_FACTORIES = {
  experience: experienceEntry,
  education: educationEntry,
  projects: projectEntry,
  skills: skillEntry,
};

const rawCollections = (
  overrides: Partial<RawCollections> = {},
): RawCollections => ({
  profile: [profileEntry()],
  experience: [experienceEntry("job", 1)],
  education: [educationEntry("degree", 1)],
  projects: [projectEntry("gumdrop", 1)],
  skills: [skillEntry("languages", 1)],
  now: [nowEntry()],
  ...overrides,
});

describe("assembleSiteContent", () => {
  describe("contact links", () => {
    it("gives every theme the same links, each with its own address and label", () => {
      const { contactLinks } = assembleSiteContent(rawCollections());

      expect(contactLinks).toEqual([
        {
          name: "LinkedIn",
          href: "https://www.linkedin.com/in/example",
          label: "linkedin.com/in/example",
        },
        {
          name: "GitHub",
          href: "https://github.com/example",
          label: "github.com/example",
        },
      ]);
    });
  });

  describe("the shape themes read", () => {
    it("adds an id and date labels to each experience entry, keeping its fields", () => {
      const { experience } = assembleSiteContent(rawCollections());

      expect(experience).toEqual([
        {
          id: "job",
          order: 1,
          title: "Engineer",
          org: "Arbisoft",
          start: "2024-07",
          end: "present",
          points: ["Shipped apps"],
          startLabel: "Jul 2024",
          endLabel: "Present",
          dates: "Jul 2024 – Present",
        },
      ]);
    });

    it("gives education entries date labels from their own dates", () => {
      const { education } = assembleSiteContent(rawCollections());

      expect(education[0]).toMatchObject({
        id: "degree",
        school: "NUST",
        dates: "Sep 2017 – Jul 2021",
      });
    });

    it("gives projects date labels and keeps their logo image", () => {
      const { projects } = assembleSiteContent(rawCollections());

      expect(projects[0]).toMatchObject({
        id: "gumdrop",
        dates: "Jun 2025 – Present",
        logo: image(),
      });
    });

    it("adds an id to skill groups", () => {
      const { skills } = assembleSiteContent(rawCollections());

      expect(skills).toEqual([
        {
          id: "languages",
          order: 1,
          group: "Languages",
          items: ["TypeScript"],
        },
      ]);
    });

    it('returns "Right now" as a plain list of items, in file order', () => {
      const { now } = assembleSiteContent(rawCollections());

      expect(now).toEqual([
        { label: "Playing", value: "Sekiro" },
        { label: "Building", value: "a portfolio" },
      ]);
    });

    it("returns the profile as one object with its photos intact", () => {
      const { profile } = assembleSiteContent(rawCollections());

      expect(profile).toMatchObject({
        name: "Ahmad Naeem",
        portrait: image(),
        contactPhoto: image(),
      });
    });
  });

  describe("pixel portrait", () => {
    it.each(["jpg", "webp", "avif"] as const)(
      "rejects %s, naming the format, because it would not keep exact pixels",
      (format) => {
        const profile = profileEntry();
        profile.data.portraitPixels = image({ format });

        expect(() =>
          assembleSiteContent(rawCollections({ profile: [profile] })),
        ).toThrow(
          `portraitPixels must be a PNG so it stays lossless, got "${format}".`,
        );
      },
    );

    it("hands themes only url, width and height, dropping the metadata an image pipeline would use", () => {
      const profile = profileEntry();
      const astroMetadata = {
        ...pixelImage(),
        fsPath: "/repo/src/content/assets/photos/portrait-px.png",
        ASTRO_ASSET: "/repo/src/content/assets/photos/portrait-px.png",
      };
      profile.data.portraitPixels = astroMetadata;

      const content = assembleSiteContent(
        rawCollections({ profile: [profile] }),
      );

      expect(content.profile.portraitPixels).toStrictEqual({
        url: "/_astro/portrait-px.hash.png",
        width: 48,
        height: 60,
      });
    });
  });

  describe("empty collections", () => {
    it.each<CollectionName>([
      "profile",
      "experience",
      "education",
      "projects",
      "skills",
      "now",
    ])("fails on an empty %s, pointing at the file to edit", (collection) => {
      expect(() =>
        assembleSiteContent(rawCollections({ [collection]: [] })),
      ).toThrow(
        `Content collection "${collection}" is empty. Add an entry to src/content/${collection}.yaml.`,
      );
    });
  });

  describe("display order", () => {
    it.each(ORDERED_COLLECTIONS)(
      "sorts %s numerically by order, whatever order they arrive in",
      (collection) => {
        const entry = ORDERED_ENTRY_FACTORIES[collection];
        const content = assembleSiteContent(
          rawCollections({
            [collection]: [
              entry("tenth", 10),
              entry("first", 1),
              entry("second", 2),
            ],
          }),
        );

        expect(content[collection].map(({ id }) => id)).toEqual([
          "first",
          "second",
          "tenth",
        ]);
      },
    );

    it.each(ORDERED_COLLECTIONS)(
      "fails when two %s entries share an order, naming both",
      (collection) => {
        const entry = ORDERED_ENTRY_FACTORIES[collection];
        const entries = [
          entry("alpha", 1),
          entry("beta", 2),
          entry("gamma", 2),
        ];

        expect(() =>
          assembleSiteContent(rawCollections({ [collection]: entries })),
        ).toThrow(
          `Content collection "${collection}": "beta" and "gamma" both have order 2.`,
        );
      },
    );
  });

  describe("single-entry collections", () => {
    it("fails on a second profile, saying how many it found", () => {
      const profile = [profileEntry("ahmad"), profileEntry("copy")];

      expect(() => assembleSiteContent(rawCollections({ profile }))).toThrow(
        'Content collection "profile" must have exactly one entry, found 2.',
      );
    });

    it('fails on a second "Right now" entry, saying how many it found', () => {
      const now = [nowEntry("current"), nowEntry("old"), nowEntry("older")];

      expect(() => assembleSiteContent(rawCollections({ now }))).toThrow(
        'Content collection "now" must have exactly one entry, found 3.',
      );
    });
  });
});

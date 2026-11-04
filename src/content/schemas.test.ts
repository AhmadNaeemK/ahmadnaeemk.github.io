import type { ImageFunction } from "astro:content";
import { z } from "astro/zod";
import { describe, expect, it } from "vitest";
import {
  createProfileSchema,
  createProjectSchema,
  educationSchema,
  experienceSchema,
  nowSchema,
  skillGroupSchema,
} from "./schemas";

const MONTH_MESSAGE = 'must be a month as "YYYY-MM", like 2024-07';
const END_MESSAGE = 'must be a month as "YYYY-MM" or the word "present"';
const EMPTY_MESSAGE = "must not be empty";
const EMPTY_LIST_MESSAGE = "needs at least one item";
const IMAGE_PATH_MESSAGE =
  'must be a relative path to a local image, like "./assets/logos/gumdrop.png"';
const HTTPS_MESSAGE = "must be an https URL";

// Only here so the schemas can be built. In Astro 7.4.5 the real helper is a sync
// transform that returns a placeholder resolved later, for any string, so this
// fake proves nothing about image handling. What these tests can prove is the
// schema's own path check, and `npm run build` covers the rest.
const fakeImage = (() =>
  z.string().transform((path) => ({
    src: path,
    width: 64,
    height: 64,
    format: "png",
  }))) as unknown as ImageFunction;

const profileSchema = createProfileSchema(fakeImage);
const projectSchema = createProjectSchema(fakeImage);

type RawEntry = Record<string, unknown>;

const validExperience = (): RawEntry => ({
  order: 1,
  title: "Senior Software Engineer",
  org: "Arbisoft",
  start: "2024-07",
  end: "present",
  points: ["Shipped four apps"],
});

const validEducation = (): RawEntry => ({
  order: 1,
  degree: "BE Software Engineering",
  school: "NUST",
  place: "Islamabad",
  start: "2017-09",
  end: "2021-07",
});

const validProject = (): RawEntry => ({
  order: 1,
  name: "Gumdrop",
  monogram: "G",
  color: "tomato",
  logo: "./assets/logos/gumdrop.png",
  blurb: "Meeting scheduling",
  role: "Full-stack engineer",
  start: "2025-06",
  end: "present",
  points: ["Stripe billing"],
  tech: ["Next.js"],
});

const validSkillGroup = (): RawEntry => ({
  order: 1,
  group: "Languages",
  items: ["TypeScript"],
});

const validNow = (): RawEntry => ({
  items: [{ label: "Playing", value: "Spider-Man" }],
});

const validProfile = (): RawEntry => ({
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
  portrait: "./assets/photos/portrait.jpg",
  portraitAlt: "Ahmad smiling",
  contactPhoto: "./assets/photos/contact.jpg",
  portraitPixels: "./assets/photos/portrait-px.png",
});

const ALL_SCHEMAS = [
  { name: "profile", schema: profileSchema, valid: validProfile },
  { name: "experience", schema: experienceSchema, valid: validExperience },
  { name: "education", schema: educationSchema, valid: validEducation },
  { name: "project", schema: projectSchema, valid: validProject },
  { name: "skill group", schema: skillGroupSchema, valid: validSkillGroup },
  { name: "now", schema: nowSchema, valid: validNow },
];

const DATED_SCHEMAS = ALL_SCHEMAS.filter(({ name }) =>
  ["experience", "education", "project"].includes(name),
);

const ORDERED_SCHEMAS = ALL_SCHEMAS.filter(({ name }) =>
  ["experience", "education", "project", "skill group"].includes(name),
);

/** The problems an editor would read: which field, and what is wrong with it. */
async function problemsIn(schema: z.ZodType, input: unknown) {
  const parsed = await schema.safeParseAsync(input);
  return parsed.success
    ? []
    : parsed.error.issues.map(({ path, message }) => ({
        field: path.join("."),
        message,
      }));
}

function without(entry: RawEntry, field: string): RawEntry {
  const remaining = { ...entry };
  delete remaining[field];
  return remaining;
}

const BAD_DATES = [
  { written: "2024-13", value: "2024-13" },
  { written: "2024-07-01 in quotes", value: "2024-07-01" },
  { written: "Jul 2024", value: "Jul 2024" },
  {
    written: "an unquoted 2024-07-01, which YAML parses to a Date",
    value: new Date("2024-07-01"),
  },
  { written: "an unquoted 2024, which YAML parses to a number", value: 2024 },
];

const IMAGE_FIELDS = [
  { field: "logo", schema: projectSchema, valid: validProject },
  { field: "portrait", schema: profileSchema, valid: validProfile },
  { field: "contactPhoto", schema: profileSchema, valid: validProfile },
  { field: "portraitPixels", schema: profileSchema, valid: validProfile },
];

describe.each(ALL_SCHEMAS)("$name schema", ({ schema, valid }) => {
  it("accepts a complete entry", async () => {
    expect(await problemsIn(schema, valid())).toEqual([]);
  });

  it("names any required field that is left out", async () => {
    const entry = valid();
    for (const field of Object.keys(entry)) {
      const problems = await problemsIn(schema, without(entry, field));
      expect(problems.map((problem) => problem.field)).toContain(field);
    }
  });

  it("rejects a misspelt field and names it, rather than dropping the content", async () => {
    const problems = await problemsIn(schema, { ...valid(), titel: "Typo" });

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('"titel"');
  });
});

describe.each(DATED_SCHEMAS)("$name dates", ({ schema, valid }) => {
  it.each(BAD_DATES)(
    "rejects a start written as $written, saying how to write it",
    async ({ value }) => {
      expect(
        await problemsIn(schema, { ...valid(), start: value }),
      ).toContainEqual({ field: "start", message: MONTH_MESSAGE });
    },
  );

  it.each(BAD_DATES)(
    "rejects an end written as $written, saying how to write it",
    async ({ value }) => {
      expect(
        await problemsIn(schema, { ...valid(), end: value }),
      ).toContainEqual({ field: "end", message: END_MESSAGE });
    },
  );

  it('rejects a capitalised "Present" as an end', async () => {
    expect(await problemsIn(schema, { ...valid(), end: "Present" })).toEqual([
      { field: "end", message: END_MESSAGE },
    ]);
  });

  it('rejects "present" as a start, because only an end can be ongoing', async () => {
    expect(
      await problemsIn(schema, { ...valid(), start: "present" }),
    ).toContainEqual({ field: "start", message: MONTH_MESSAGE });
  });

  it("reports only the format problem when a date is malformed", async () => {
    const entry = { ...valid(), start: "Jul 2017", end: "2021-07" };

    expect(await problemsIn(schema, entry)).toEqual([
      { field: "start", message: MONTH_MESSAGE },
    ]);
  });

  it("rejects an end before the start, pointing at the end", async () => {
    const entry = { ...valid(), start: "2024-07", end: "2024-06" };

    expect(await problemsIn(schema, entry)).toEqual([
      { field: "end", message: "end must not be before start" },
    ]);
  });

  it("accepts an entry that starts and ends in the same month", async () => {
    const entry = { ...valid(), start: "2024-07", end: "2024-07" };

    expect(await problemsIn(schema, entry)).toEqual([]);
  });
});

describe.each(ORDERED_SCHEMAS)("$name order", ({ schema, valid }) => {
  it.each([
    { written: "zero", value: 0, message: "must be 1 or more" },
    { written: "negative", value: -1, message: "must be 1 or more" },
    { written: "a fraction", value: 1.5, message: "must be a whole number" },
    {
      written: "a quoted number",
      value: "1",
      message: "must be a whole number",
    },
  ])("rejects an order that is $written", async ({ value, message }) => {
    expect(await problemsIn(schema, { ...valid(), order: value })).toEqual([
      { field: "order", message },
    ]);
  });
});

describe("text fields", () => {
  it.each([
    { written: "empty", value: "" },
    { written: "only spaces", value: "   " },
  ])("rejects text that is $written", async ({ value }) => {
    expect(
      await problemsIn(experienceSchema, {
        ...validExperience(),
        title: value,
      }),
    ).toEqual([{ field: "title", message: EMPTY_MESSAGE }]);
  });

  it.each([
    {
      name: "experience points",
      schema: experienceSchema,
      valid: validExperience,
      field: "points",
    },
    {
      name: "project points",
      schema: projectSchema,
      valid: validProject,
      field: "points",
    },
    {
      name: "project tech",
      schema: projectSchema,
      valid: validProject,
      field: "tech",
    },
    {
      name: "skill items",
      schema: skillGroupSchema,
      valid: validSkillGroup,
      field: "items",
    },
    {
      name: "profile about",
      schema: profileSchema,
      valid: validProfile,
      field: "about",
    },
    {
      name: "profile facts",
      schema: profileSchema,
      valid: validProfile,
      field: "facts",
    },
  ])("rejects empty $name", async ({ schema, valid, field }) => {
    expect(await problemsIn(schema, { ...valid(), [field]: [] })).toEqual([
      { field, message: EMPTY_LIST_MESSAGE },
    ]);
  });
});

describe("project schema", () => {
  it("rejects a project without a logo, naming the field", async () => {
    const problems = await problemsIn(
      projectSchema,
      without(validProject(), "logo"),
    );

    expect(problems.map((problem) => problem.field)).toEqual(["logo"]);
  });

  it("rejects a colour no theme has a variant for", async () => {
    const problems = await problemsIn(projectSchema, {
      ...validProject(),
      color: "red",
    });

    expect(problems.map((problem) => problem.field)).toEqual(["color"]);
  });
});

describe.each(IMAGE_FIELDS)("$field path", ({ field, schema, valid }) => {
  it.each([
    { written: "empty", value: "" },
    { written: "only spaces", value: "  " },
    { written: "a remote URL", value: "https://example.com/gumdrop.png" },
    { written: "not an image", value: "./assets/logos/gumdrop.pdf" },
    {
      written: "not an image despite a .png in its name",
      value: "./assets/logos/gumdrop.png.txt",
    },
    { written: "missing its extension", value: "./assets/logos/gumdrop" },
    { written: "root-relative", value: "/assets/logos/gumdrop.png" },
    { written: "a bare filename", value: "gumdrop.png" },
  ])(
    "rejects a path that is $written, saying how to write it",
    async ({ value }) => {
      expect(await problemsIn(schema, { ...valid(), [field]: value })).toEqual([
        { field, message: IMAGE_PATH_MESSAGE },
      ]);
    },
  );

  it.each([
    { written: "goes up a folder", value: "../assets/logos/gumdrop.png" },
    {
      written: "has an uppercase extension",
      value: "./assets/logos/gumdrop.PNG",
    },
  ])("accepts a path that $written", async ({ value }) => {
    expect(await problemsIn(schema, { ...valid(), [field]: value })).toEqual(
      [],
    );
  });
});

describe("profile schema", () => {
  it("rejects a malformed email", async () => {
    const problems = await problemsIn(profileSchema, {
      ...validProfile(),
      email: "ahmad-at-example.com",
    });

    expect(problems.map((problem) => problem.field)).toEqual(["email"]);
  });

  describe.each(["linkedin", "github"])("%s link", (field) => {
    it.each([
      { written: "no scheme", value: "example.com/ahmad" },
      { written: "a javascript: scheme", value: "javascript:alert(1)" },
      { written: "an http: scheme", value: "http://example.com/ahmad" },
    ])("rejects $written", async ({ value }) => {
      expect(
        await problemsIn(profileSchema, { ...validProfile(), [field]: value }),
      ).toEqual([{ field, message: HTTPS_MESSAGE }]);
    });
  });

  it.each(["cv.pdf", "/docs/cv.pdf", "/cv.docx"])(
    "rejects %s as a CV path, because the download URL must be a root PDF",
    async (cv) => {
      expect(
        await problemsIn(profileSchema, { ...validProfile(), cv }),
      ).toEqual([
        { field: "cv", message: 'must be a root path like "/cv.pdf"' },
      ]);
    },
  );

  it("rejects a misspelt field inside a fact", async () => {
    const problems = await problemsIn(profileSchema, {
      ...validProfile(),
      facts: [{ value: "5+", lable: "years" }],
    });

    expect(problems.map((problem) => problem.field)).toContain("facts.0");
  });
});

describe('"Right now" schema', () => {
  it("rejects an empty list, saying it needs an item", async () => {
    expect(await problemsIn(nowSchema, { items: [] })).toEqual([
      { field: "items", message: '"Right now" needs at least one item' },
    ]);
  });

  it("accepts a single item", async () => {
    const singleItem = { items: [{ label: "Playing", value: "Sekiro" }] };

    expect(await problemsIn(nowSchema, singleItem)).toEqual([]);
  });

  it("rejects an item with an empty value, naming its position", async () => {
    const items = [{ label: "Playing", value: "" }];

    expect(await problemsIn(nowSchema, { items })).toEqual([
      { field: "items.0.value", message: EMPTY_MESSAGE },
    ]);
  });
});

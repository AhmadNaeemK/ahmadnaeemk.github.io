import type { ImageFunction } from "astro:content";
import { z } from "astro/zod";
import { isChronological, isMonth, PRESENT } from "./month";

/** The colour names every theme's stylesheet has a variant for. */
export const PROJECT_COLORS = [
  "tomato",
  "plum",
  "marigold",
  "teal",
  "cobalt",
] as const;

const MONTH_MESSAGE = 'must be a month as "YYYY-MM", like 2024-07';
const END_MESSAGE = `must be a month as "YYYY-MM" or the word "${PRESENT}"`;
const CHRONOLOGY_MESSAGE = "end must not be before start";

const text = z.string().trim().min(1, "must not be empty");
const nonEmptyList = <Item extends z.ZodType>(item: Item) =>
  z.array(item).min(1, "needs at least one item");
const textList = nonEmptyList(text);
const httpsUrl = z.url({ protocol: /^https$/, error: "must be an https URL" });

// `abort` stops the range's chronology check from also judging a malformed date.
const month = z
  .string({ error: MONTH_MESSAGE })
  .refine(isMonth, { error: MONTH_MESSAGE, abort: true });

const monthOrPresent = z
  .string({ error: END_MESSAGE })
  .refine((candidate) => candidate === PRESENT || isMonth(candidate), {
    error: END_MESSAGE,
    abort: true,
  });

const dateRangeFields = { start: month, end: monthOrPresent };

// `getCollection()` does not keep file order, so each listed entry states its position.
const order = z
  .int({ error: "must be a whole number" })
  .positive("must be 1 or more");

function hasChronologicalDates(range: { start: string; end: string }): boolean {
  return isChronological(range.start, range.end);
}

const chronologyCheck = { error: CHRONOLOGY_MESSAGE, path: ["end"] };

// Matches VALID_INPUT_FORMATS in astro/dist/assets/consts.js.
const LOCAL_IMAGE_PATH =
  /^\.{1,2}\/.+\.(apng|avif|gif|jpe?g|png|svg|tiff|webp)$/i;
const IMAGE_PATH_MESSAGE =
  'must be a relative path to a local image, like "./assets/logos/gumdrop.png"';

// Astro's helper lets an empty, remote or non-image path through and leaves a
// placeholder that is not an image, so the path is checked first. The cast is
// needed because the helper's type describes its output and hides that its input
// is a string.
const requiredImage = (image: ImageFunction) =>
  z
    .string()
    .trim()
    .regex(LOCAL_IMAGE_PATH, IMAGE_PATH_MESSAGE)
    .pipe(
      image() as unknown as z.ZodType<
        z.output<ReturnType<ImageFunction>>,
        string
      >,
    );

// `image()` is Astro's schema helper, passed in so these stay importable without
// the `astro:content` runtime. Unknown keys are rejected, so a misspelt field
// fails the build instead of quietly dropping content.

export const createProfileSchema = (image: ImageFunction) =>
  z.strictObject({
    name: text,
    handle: text,
    role: text,
    focus: text,
    location: text,
    email: z.email(),
    linkedin: httpsUrl,
    linkedinLabel: text,
    github: httpsUrl,
    githubLabel: text,
    cv: z
      .string()
      .regex(/^\/[^/]+\.pdf$/, 'must be a root path like "/cv.pdf"'),
    intro: text,
    about: textList,
    favouriteGame: text,
    projectsLede: text,
    contactLead: text,
    contactNote: text,
    facts: nonEmptyList(z.strictObject({ value: text, label: text })),
    portrait: requiredImage(image),
    portraitAlt: text,
    contactPhoto: requiredImage(image),
    portraitPixels: requiredImage(image),
  });

export const experienceSchema = z
  .strictObject({
    order,
    title: text,
    org: text,
    ...dateRangeFields,
    points: textList,
  })
  .refine(hasChronologicalDates, chronologyCheck);

export const educationSchema = z
  .strictObject({
    order,
    degree: text,
    school: text,
    place: text,
    ...dateRangeFields,
  })
  .refine(hasChronologicalDates, chronologyCheck);

export const createProjectSchema = (image: ImageFunction) =>
  z
    .strictObject({
      order,
      name: text,
      monogram: text,
      color: z.enum(PROJECT_COLORS),
      logo: requiredImage(image),
      blurb: text,
      role: text,
      ...dateRangeFields,
      points: textList,
      tech: textList,
    })
    .refine(hasChronologicalDates, chronologyCheck);

export const skillGroupSchema = z.strictObject({
  order,
  group: text,
  items: textList,
});

export const nowSchema = z.strictObject({
  items: z
    .array(z.strictObject({ label: text, value: text }))
    .min(1, '"Right now" needs at least one item'),
});

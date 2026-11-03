import { existsSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ImageFunction } from "astro:content";
import type { LoaderContext } from "astro/loaders";
import { z } from "astro/zod";
import { describe, expect, it } from "vitest";
import { assembleSiteContent, type RawCollections } from "./assemble";
import {
  createProfileSchema,
  createProjectSchema,
  educationSchema,
  experienceSchema,
  nowSchema,
  skillGroupSchema,
} from "./schemas";
import { strictFile } from "./strict-file-loader";

// Runs the YAML actually in this folder through the real loader and schemas, so a
// bad content edit fails `npm test` too. It deliberately pins no content values,
// which change freely. In Astro 7.4.5 the real image helper is a sync transform
// that returns a placeholder resolved later, so this stand-in proves nothing about
// Astro's image handling. It checks only that the file exists, and takes the
// format from its extension. `npm run build` covers the real thing.

const PROJECT_ROOT = new URL("../../", import.meta.url);
const CONTENT_FOLDER = new URL("./", import.meta.url);

const imageFileExists = (() =>
  z.string().transform((path, context) => {
    if (!existsSync(new URL(path, CONTENT_FOLDER))) {
      context.addIssue({
        code: "custom",
        message: `Image ${path} does not exist`,
      });
      return z.NEVER;
    }
    return {
      src: path,
      width: 1,
      height: 1,
      format: extname(path).slice(1),
    };
  })) as unknown as ImageFunction;

const COLLECTION_SCHEMAS: Record<keyof RawCollections, z.ZodType> = {
  profile: createProfileSchema(imageFileExists),
  experience: experienceSchema,
  education: educationSchema,
  projects: createProjectSchema(imageFileExists),
  skills: skillGroupSchema,
  now: nowSchema,
};

async function loadCollection(collection: keyof RawCollections) {
  const entries: { id: string; data: unknown }[] = [];
  const noOp = () => {};
  const context = {
    collection,
    config: { root: PROJECT_ROOT },
    logger: { debug: noOp, info: noOp, warn: noOp, error: noOp },
    parseData: async ({ id, data }: { id: string; data: unknown }) => {
      const parsed = await COLLECTION_SCHEMAS[collection].safeParseAsync(data);
      if (!parsed.success) {
        const problems = parsed.error.issues.map(
          ({ path, message }) => `${path.join(".")}: ${message}`,
        );
        throw new Error(`${collection}/${id}: ${problems.join("; ")}`);
      }
      return parsed.data;
    },
    store: {
      clear: noOp,
      set: ({ id, data }: { id: string; data: unknown }) => {
        entries.push({ id, data });
      },
    },
  };
  await strictFile(`src/content/${collection}.yaml`).load(
    context as unknown as LoaderContext,
  );
  return entries;
}

async function loadRealContent() {
  const [profile, experience, education, projects, skills, now] =
    await Promise.all([
      loadCollection("profile"),
      loadCollection("experience"),
      loadCollection("education"),
      loadCollection("projects"),
      loadCollection("skills"),
      loadCollection("now"),
    ]);
  return assembleSiteContent({
    profile,
    experience,
    education,
    projects,
    skills,
    now,
  } as RawCollections);
}

describe("the content files in src/content", () => {
  it("satisfy every schema and assemble into site content", async () => {
    await expect(loadRealContent()).resolves.toBeDefined();
  });

  it("link to a CV PDF that ships in public/, which a build would not notice (E24)", async () => {
    const { profile } = await loadRealContent();
    const cvFile = new URL(`public${profile.cv}`, PROJECT_ROOT);

    expect(existsSync(cvFile), `${fileURLToPath(cvFile)} is missing`).toBe(
      true,
    );
  });
});

import type { Page } from "@playwright/test";
import { formatEnd, formatMonth } from "../../../src/content/month";
import { strictFile } from "../../../src/content/strict-file-loader";
import {
  sectionId,
  THEME_HOOKS,
  THEME_ROOT_ATTRIBUTE,
  type SectionKey,
} from "../../../src/scene/contract";
import { expect, test } from "../scene/helpers";
import { DESKTOP, DIORAMA, openDiorama, PHONE } from "./support";

const PROJECT_ROOT = new URL("../../../", import.meta.url);

interface Ordered {
  readonly order: number;
}
interface Dated {
  readonly start: string;
  readonly end: string;
}
interface Job extends Ordered, Dated {
  readonly title: string;
  readonly org: string;
  readonly points: readonly string[];
}
interface Course extends Ordered, Dated {
  readonly degree: string;
  readonly school: string;
  readonly place: string;
}
interface Project extends Ordered, Dated {
  readonly name: string;
  readonly blurb: string;
  readonly role: string;
  readonly points: readonly string[];
  readonly tech: readonly string[];
}
interface SkillGroup extends Ordered {
  readonly group: string;
  readonly items: readonly string[];
}
interface Profile {
  readonly name: string;
  readonly role: string;
  readonly focus: string;
  readonly location: string;
  readonly intro: string;
  readonly about: readonly string[];
  readonly email: string;
  readonly linkedin: string;
  readonly linkedinLabel: string;
  readonly github: string;
  readonly githubLabel: string;
  readonly cv: string;
  readonly portraitAlt: string;
}

/**
 * Reads a collection's YAML through the project's own loader, without its schemas:
 * those are `content-files.test.ts`'s job. So these specs need no edit when the
 * content changes, and a value dropped from the page still fails them.
 */
async function loadEntries<Data>(collection: string): Promise<Data[]> {
  const entries: Data[] = [];
  const noOp = () => {};
  const context = {
    collection,
    config: { root: PROJECT_ROOT },
    logger: { debug: noOp, info: noOp, warn: noOp, error: noOp },
    parseData: async ({ data }: { data: Data }) => data,
    store: {
      clear: noOp,
      set: ({ data }: { data: Data }) => {
        entries.push(data);
      },
    },
  };
  await strictFile(`src/content/${collection}.yaml`).load(
    context as unknown as Parameters<ReturnType<typeof strictFile>["load"]>[0],
  );
  return entries;
}

const inOrder = <Data extends Ordered>(entries: Data[]) =>
  entries.sort((a, b) => a.order - b.order);

/** Compares words as read: CSS may upper-case them, and markup may break lines. */
const normalise = (text: string) =>
  text.replace(/\s+/g, " ").trim().toLowerCase();

/** What a sighted visitor can read in a section. */
const sectionText = async (page: Page, key: SectionKey) =>
  normalise(
    await page
      .locator(`#${sectionId(DIORAMA, key)}`)
      .evaluate((section: HTMLElement) => section.innerText),
  );

function expectToReadAll(text: string, expected: readonly string[]): void {
  expect(
    expected.filter((words) => !text.includes(normalise(words))),
    "content missing from the page",
  ).toEqual([]);
}

function expectInThisOrder(text: string, expected: readonly string[]): void {
  let from = 0;
  for (const words of expected) {
    const at = text.indexOf(normalise(words), from);
    expect(at, `"${words}" out of order`).toBeGreaterThanOrEqual(0);
    from = at + normalise(words).length;
  }
}

const dateLabels = ({ start, end }: Dated) => [
  formatMonth(start),
  formatEnd(end),
];

const content = {
  profile: () => loadEntries<Profile>("profile").then(([only]) => only),
  jobs: () => loadEntries<Job>("experience").then(inOrder),
  courses: () => loadEntries<Course>("education").then(inOrder),
  projects: () => loadEntries<Project>("projects").then(inOrder),
  skills: () => loadEntries<SkillGroup>("skills").then(inOrder),
};

// Both layouts, since the phone's stacks and hides things the desktop's does not.
for (const [name, viewport] of [
  ["desktop", DESKTOP],
  ["phone", PHONE],
] as const) {
  test.describe(`the real content, on a ${name}`, () => {
    test.use({ viewport });

    test("every job and course is on the Work board, in order", async ({
      page,
    }) => {
      const jobs = await content.jobs();
      const courses = await content.courses();
      expect(jobs.length).toBeGreaterThan(0);
      expect(courses.length).toBeGreaterThan(0);
      await openDiorama(page);
      const work = await sectionText(page, "work");

      for (const job of jobs) {
        expectToReadAll(work, [
          job.title,
          job.org,
          ...job.points,
          ...dateLabels(job),
        ]);
      }
      for (const course of courses) {
        expectToReadAll(work, [
          course.degree,
          course.school,
          course.place,
          ...dateLabels(course),
        ]);
      }
      expectInThisOrder(work, [
        ...jobs.map(({ title }) => title),
        ...courses.map(({ degree }) => degree),
      ]);
    });

    test("every project is there, in order, with its logo named", async ({
      page,
    }) => {
      const projects = await content.projects();
      expect(projects.length).toBeGreaterThan(0);
      await openDiorama(page);
      const text = await sectionText(page, "projects");

      for (const project of projects) {
        expectToReadAll(text, [
          project.name,
          project.blurb,
          project.role,
          ...project.points,
          ...project.tech,
          ...dateLabels(project),
        ]);
        await expect(
          page
            .locator(`#${sectionId(DIORAMA, "projects")}`)
            .getByRole("img", { name: `${project.name} logo`, exact: true }),
        ).toHaveCount(1);
      }
      expectInThisOrder(
        text,
        projects.map(({ name: projectName }) => projectName),
      );
    });

    test("every skill is there, under its group", async ({ page }) => {
      const skills = await content.skills();
      expect(skills.length).toBeGreaterThan(0);
      await openDiorama(page);
      const text = await sectionText(page, "skills");

      for (const { group, items } of skills) {
        expectToReadAll(text, [group, ...items]);
      }
      expectInThisOrder(
        text,
        skills.flatMap(({ group, items }) => [group, ...items]),
      );
    });

    test("the contact section gives the real email and links, and the CV downloads", async ({
      page,
    }) => {
      const profile = await content.profile();
      await openDiorama(page);
      const contact = page.locator(`#${sectionId(DIORAMA, "contact")}`);

      expectToReadAll(await sectionText(page, "contact"), [profile.email]);
      await expect(
        contact.getByRole("link", { name: profile.linkedinLabel }),
      ).toHaveAttribute("href", profile.linkedin);
      await expect(
        contact.getByRole("link", { name: profile.githubLabel }),
      ).toHaveAttribute("href", profile.github);

      const cvLinks = page.locator(
        `[${THEME_ROOT_ATTRIBUTE}="${DIORAMA}"] ${THEME_HOOKS.cvLink}`,
      );
      expect(await cvLinks.count()).toBeGreaterThan(0);
      for (const link of await cvLinks.all()) {
        await expect(link).toHaveAttribute("href", profile.cv);
      }
      expect((await page.request.get(profile.cv)).ok()).toBe(true);
    });

    test("the introduction and About read from the profile", async ({
      page,
    }) => {
      const profile = await content.profile();
      await openDiorama(page);

      const hero = normalise(
        await page
          .locator(`[${THEME_ROOT_ATTRIBUTE}="${DIORAMA}"] ${THEME_HOOKS.hero}`)
          .evaluate((element: HTMLElement) => element.innerText),
      );
      expectToReadAll(hero, [
        profile.name,
        profile.role,
        profile.focus,
        profile.location,
        profile.intro,
      ]);
      expectToReadAll(await sectionText(page, "about"), [...profile.about]);
      await expect(
        page
          .locator(`#${sectionId(DIORAMA, "about")}`)
          .getByRole("img", { name: profile.portraitAlt, exact: true }),
      ).toHaveCount(1);
    });
  });
}

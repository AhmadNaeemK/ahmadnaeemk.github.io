import { type Locator } from "@playwright/test";
import { RIGHT_NOW_PARTS, sectionId } from "../../../src/scene/contract";
import { expect, hero, openScenePage, root, test } from "../scene/helpers";
import {
  content,
  DESKTOP,
  lastBoardTexts,
  logCanvasTexts,
  PHONE,
  THEME,
} from "./support";

/** What a reader sees, so text hidden by CSS does not count. */
const expectReads = (section: Locator, text: string) =>
  expect(section).toContainText(text, { useInnerText: true, ignoreCase: true });

for (const [device, viewport] of [
  ["desktop", DESKTOP],
  ["phone", PHONE],
] as const) {
  test.describe(`on a ${device}`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await openScenePage(page);
    });

    const section = (
      page: Parameters<typeof root>[0],
      key: Parameters<typeof sectionId>[1],
    ) => page.locator(`[id="${sectionId(THEME, key)}"]`);

    test("the intro and About read the real profile", async ({ page }) => {
      const { profile } = await content;
      const intro = hero(page, THEME);
      await expect(intro.getByRole("heading", { level: 1 })).toHaveText(
        profile.name,
      );
      for (const text of [
        profile.role,
        profile.focus,
        profile.intro,
        profile.location,
      ]) {
        await expectReads(intro, text);
      }
      for (const paragraph of profile.about) {
        await expectReads(section(page, "about"), paragraph);
      }
    });

    test("Work lists every job and then every school, in order, with all their details", async ({
      page,
    }) => {
      const { experience, education } = await content;
      const work = section(page, "work");

      await expect(work.locator("h3")).toHaveCount(
        experience.length + education.length,
      );
      await expect(work.locator("h3")).toContainText([
        ...experience.map(({ title }) => title),
        ...education.map(({ degree }) => degree),
      ]);
      for (const job of experience) {
        for (const text of [
          job.org,
          job.startLabel,
          job.endLabel,
          ...job.points,
        ]) {
          await expectReads(work, text);
        }
      }
      for (const school of education) {
        for (const text of [
          school.school,
          school.place,
          school.startLabel,
          school.endLabel,
        ]) {
          await expectReads(work, text);
        }
      }
    });

    test("Projects shows every project, in order, with all its details", async ({
      page,
    }) => {
      const { projects } = await content;
      const projectsSection = section(page, "projects");
      const cards = projectsSection.getByRole("article");

      await expect(cards).toHaveCount(projects.length);
      await expect(cards.locator("h3")).toHaveText(
        projects.map(({ name }) => name),
      );
      for (const [index, project] of projects.entries()) {
        for (const text of [
          project.blurb,
          project.role,
          project.startLabel,
          project.endLabel,
          ...project.points,
          ...project.tech,
        ]) {
          await expectReads(cards.nth(index), text);
        }
      }
    });

    test("Skills shows every group and skill", async ({ page }) => {
      const { skills } = await content;
      const skillsSection = section(page, "skills");

      await expect(skillsSection.locator("h3")).toHaveText(
        skills.map(({ group }) => group),
      );
      for (const { items } of skills) {
        for (const skill of items) await expectReads(skillsSection, skill);
      }
    });

    test("Contact offers the real address and profiles, and the CV link is the real file", async ({
      page,
    }) => {
      const { profile } = await content;
      const contact = section(page, "contact");

      await expectReads(contact, profile.email);
      await expect(
        contact.getByRole("link", { name: "LinkedIn", exact: true }),
      ).toHaveAttribute("href", profile.linkedin);
      await expect(
        contact.getByRole("link", { name: "GitHub", exact: true }),
      ).toHaveAttribute("href", profile.github);
      await expectReads(contact, profile.linkedinLabel);
      await expectReads(contact, profile.githubLabel);
      await expect(
        hero(page, THEME).getByRole("link", { name: "Download CV" }),
      ).toHaveAttribute("href", profile.cv);
    });

    test('"Right now" carries the items in now.yaml, in order', async ({
      page,
    }) => {
      const { now } = await content;
      const line = hero(page, THEME).locator(".now");
      await expect(line.locator(RIGHT_NOW_PARTS.label)).toHaveText(
        now.map(({ label }) => label),
      );
      await expect(line.locator(RIGHT_NOW_PARTS.value)).toHaveText(
        now.map(({ value }) => value),
      );
    });
  });
}

test.describe("at full width", () => {
  test.use({ viewport: DESKTOP });

  test("the billboard rolls the same items as now.yaml", async ({ page }) => {
    await logCanvasTexts(page);
    await openScenePage(page);
    const { now } = await content;

    await expect
      .poll(async () => (await lastBoardTexts(page)).length)
      .toBeGreaterThan(0);
    const drawn = (await lastBoardTexts(page)).map(({ text }) => text.trim());
    for (const { label, value } of now) {
      expect(drawn).toContain(label);
      expect(drawn).toContain(value);
    }
  });
});

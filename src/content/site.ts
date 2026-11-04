import { getCollection } from "astro:content";
import { assembleSiteContent, type SiteContent } from "./assemble";

/** All site content, validated and ready to render. The one entry point for pages and themes. */
export async function getSiteContent(): Promise<SiteContent> {
  const [profile, experience, education, projects, skills, now] =
    await Promise.all([
      getCollection("profile"),
      getCollection("experience"),
      getCollection("education"),
      getCollection("projects"),
      getCollection("skills"),
      getCollection("now"),
    ]);
  return assembleSiteContent({
    profile,
    experience,
    education,
    projects,
    skills,
    now,
  });
}

import type { z } from "astro/zod";
import { dateLabels, type DateLabels } from "./month";
import type {
  createProfileSchema,
  createProjectSchema,
  educationSchema,
  experienceSchema,
  nowSchema,
  skillGroupSchema,
} from "./schemas";

interface Entry<Data> {
  id: string;
  data: Data;
}

type ProfileData = z.output<ReturnType<typeof createProfileSchema>>;
type ProjectData = z.output<ReturnType<typeof createProjectSchema>>;
type ExperienceData = z.output<typeof experienceSchema>;
type EducationData = z.output<typeof educationSchema>;
type SkillGroupData = z.output<typeof skillGroupSchema>;
type NowData = z.output<typeof nowSchema>;
type NowItem = NowData["items"][number];

export interface RawCollections {
  profile: Entry<ProfileData>[];
  experience: Entry<ExperienceData>[];
  education: Entry<EducationData>[];
  projects: Entry<ProjectData>[];
  skills: Entry<SkillGroupData>[];
  now: Entry<NowData>[];
}

/**
 * An image served byte for byte. It deliberately is not an `ImageMetadata`, so
 * handing one to `<Image>`, which would resize and re-encode it, is a type error.
 */
export interface ExactPixelImage {
  url: string;
  width: number;
  height: number;
}

type Dated<Data> = Data & DateLabels & { id: string };

export interface ContactLink {
  name: string;
  href: string;
  label: string;
}

export interface SiteContent {
  profile: Omit<ProfileData, "portraitPixels"> & {
    portraitPixels: ExactPixelImage;
  };
  contactLinks: ContactLink[];
  experience: Dated<ExperienceData>[];
  education: Dated<EducationData>[];
  projects: Dated<ProjectData>[];
  skills: (SkillGroupData & { id: string })[];
  now: NowItem[];
}

/** Fails the build when a collection has no entries, which a schema cannot see. */
function requireEntries<Data>(
  collection: string,
  entries: Entry<Data>[],
): Entry<Data>[] {
  if (entries.length === 0) {
    throw new Error(
      `Content collection "${collection}" is empty. Add an entry to src/content/${collection}.yaml.`,
    );
  }
  return entries;
}

/** Sorts by each entry's `order`. Two entries sharing a position has no right answer, so it fails. */
function inDisplayOrder<Data extends { order: number }>(
  collection: string,
  entries: Entry<Data>[],
): Entry<Data>[] {
  const sorted = requireEntries(collection, entries).toSorted(
    (a, b) => a.data.order - b.data.order,
  );
  sorted.forEach((entry, index) => {
    const next = sorted[index + 1];
    if (next && entry.data.order === next.data.order) {
      throw new Error(
        `Content collection "${collection}": "${entry.id}" and "${next.id}" both have order ${entry.data.order}.`,
      );
    }
  });
  return sorted;
}

function requireSingleEntry<Data>(
  collection: string,
  entries: Entry<Data>[],
): Data {
  const [first, ...others] = requireEntries(collection, entries);
  if (others.length > 0) {
    throw new Error(
      `Content collection "${collection}" must have exactly one entry, found ${entries.length}.`,
    );
  }
  return first.data;
}

function toExactPixelImage(
  image: ProfileData["portraitPixels"],
): ExactPixelImage {
  if (image.format !== "png") {
    throw new Error(
      `portraitPixels must be a PNG so it stays lossless, got "${image.format}".`,
    );
  }
  return { url: image.src, width: image.width, height: image.height };
}

function withDates<Data extends { start: string; end: string }>({
  id,
  data,
}: Entry<Data>): Dated<Data> {
  return { id, ...data, ...dateLabels(data.start, data.end) };
}

export function assembleSiteContent(raw: RawCollections): SiteContent {
  const profile = requireSingleEntry("profile", raw.profile);
  return {
    profile: {
      ...profile,
      portraitPixels: toExactPixelImage(profile.portraitPixels),
    },
    contactLinks: [
      {
        name: "LinkedIn",
        href: profile.linkedin,
        label: profile.linkedinLabel,
      },
      { name: "GitHub", href: profile.github, label: profile.githubLabel },
    ],
    experience: inDisplayOrder("experience", raw.experience).map(withDates),
    education: inDisplayOrder("education", raw.education).map(withDates),
    projects: inDisplayOrder("projects", raw.projects).map(withDates),
    skills: inDisplayOrder("skills", raw.skills).map(({ id, data }) => ({
      id,
      ...data,
    })),
    now: requireSingleEntry("now", raw.now).items,
  };
}

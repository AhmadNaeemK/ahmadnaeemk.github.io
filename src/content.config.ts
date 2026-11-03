import { defineCollection } from "astro:content";
import {
  createProfileSchema,
  createProjectSchema,
  educationSchema,
  experienceSchema,
  nowSchema,
  skillGroupSchema,
} from "./content/schemas";
import { strictFile } from "./content/strict-file-loader";

export const collections = {
  profile: defineCollection({
    loader: strictFile("src/content/profile.yaml"),
    schema: ({ image }) => createProfileSchema(image),
  }),
  experience: defineCollection({
    loader: strictFile("src/content/experience.yaml"),
    schema: experienceSchema,
  }),
  education: defineCollection({
    loader: strictFile("src/content/education.yaml"),
    schema: educationSchema,
  }),
  projects: defineCollection({
    loader: strictFile("src/content/projects.yaml"),
    schema: ({ image }) => createProjectSchema(image),
  }),
  skills: defineCollection({
    loader: strictFile("src/content/skills.yaml"),
    schema: skillGroupSchema,
  }),
  now: defineCollection({
    loader: strictFile("src/content/now.yaml"),
    schema: nowSchema,
  }),
};

/**
 * The fixed entry points of each theme, part of the contract. Dynamic imports
 * keep each scene in its own chunk, fetched when its theme is first shown.
 */
import type { SceneModule, ThemeMeta, ThemeName } from "../scene/contract";
import { meta as diorama } from "./diorama/meta";
import { meta as interchange } from "./interchange/meta";
import { meta as pixelDepot } from "./pixel-depot/meta";

export const THEME_META: Readonly<Record<ThemeName, ThemeMeta>> = {
  interchange,
  diorama,
  "pixel-depot": pixelDepot,
};

export const SCENE_LOADERS: Readonly<
  Record<ThemeName, () => Promise<SceneModule>>
> = {
  interchange: () => import("./interchange/scene"),
  diorama: () => import("./diorama/scene"),
  "pixel-depot": () => import("./pixel-depot/scene"),
};

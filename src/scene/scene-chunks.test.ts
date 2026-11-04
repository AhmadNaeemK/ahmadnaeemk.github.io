import { describe, expect, it } from "vitest";
import { pageChunkGroup } from "../../scene-chunks.mjs";

const ENTRY = "/src/pages/entry.ts";
const SCENE_A = "/src/themes/a/scene.ts";
const SCENE_B = "/src/themes/b/scene.ts";
const REGISTRY = "/src/themes/registry.ts";

interface FakeModule {
  readonly importers?: readonly string[];
  readonly dynamicImporters?: readonly string[];
  readonly isEntry?: boolean;
}

const chunkFor = (id: string, graph: Readonly<Record<string, FakeModule>>) =>
  pageChunkGroup.name(id, {
    getModuleInfo: (moduleId: string) => {
      const found = graph[moduleId];
      return (
        found && {
          importers: found.importers ?? [],
          dynamicImporters: found.dynamicImporters ?? [],
          isEntry: found.isEntry ?? false,
        }
      );
    },
  });

const SCENES: Readonly<Record<string, FakeModule>> = {
  [ENTRY]: { isEntry: true },
  [REGISTRY]: { importers: [ENTRY] },
  [SCENE_A]: { dynamicImporters: [REGISTRY] },
  [SCENE_B]: { dynamicImporters: [REGISTRY] },
};

describe("pageChunkGroup", () => {
  it("keeps an entry script out, so importing the page chunk starts nothing", () => {
    expect(chunkFor(ENTRY, SCENES)).toBeNull();
  });

  it("keeps a scene and its private helpers in the scene's own chunk", () => {
    const graph = {
      ...SCENES,
      "/src/themes/a/helper.ts": { importers: [SCENE_A] },
      "/src/themes/a/deeper.ts": { importers: ["/src/themes/a/helper.ts"] },
    };

    expect(chunkFor(SCENE_A, graph)).toBeNull();
    expect(chunkFor("/src/themes/a/helper.ts", graph)).toBeNull();
    expect(chunkFor("/src/themes/a/deeper.ts", graph)).toBeNull();
  });

  it("moves code two scenes share to the page chunk", () => {
    const graph = {
      ...SCENES,
      "/src/rail/shared.ts": { importers: [SCENE_A, SCENE_B] },
    };

    expect(chunkFor("/src/rail/shared.ts", graph)).toBe("page");
  });

  it("moves code a scene shares with the page to the page chunk", () => {
    const graph = {
      ...SCENES,
      "/src/rail/index.ts": { importers: [SCENE_A, ENTRY] },
    };

    expect(chunkFor("/src/rail/index.ts", graph)).toBe("page");
  });

  it("moves what the entry imports, including the scene imports, to the page chunk", () => {
    expect(chunkFor(REGISTRY, SCENES)).toBe("page");
  });

  it("settles modules that import each other by who reaches them", () => {
    const privateCycle = {
      ...SCENES,
      "/one.ts": { importers: [SCENE_A, "/two.ts"] },
      "/two.ts": { importers: ["/one.ts"] },
    };
    const sharedCycle = {
      ...SCENES,
      "/one.ts": { importers: [SCENE_A, "/two.ts"] },
      "/two.ts": { importers: ["/one.ts", SCENE_B] },
    };

    expect(chunkFor("/one.ts", privateCycle)).toBeNull();
    expect(chunkFor("/one.ts", sharedCycle)).toBe("page");
  });
});

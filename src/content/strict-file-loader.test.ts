import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { LoaderContext } from "astro/loaders";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { strictFile } from "./strict-file-loader";

// Astro's real `file()` loader runs here against real files. Only the context it
// is handed is fake, so these fail if Astro stops reporting these problems through
// `logger.error`, which is what `strictFile` turns into a failed build.

type ChangeListener = (changedPath: string) => Promise<void>;

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "strict-file-loader-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function fakeLoaderContext() {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const stored = new Map<string, unknown>();
  const context = {
    collection: "now",
    config: { root: pathToFileURL(`${directory}/`) },
    logger,
    parseData: async ({ data }: { data: unknown }) => data,
    store: {
      clear: () => stored.clear(),
      set: ({ id, data }: { id: string; data: unknown }) =>
        stored.set(id, data),
    },
  };
  return { context: context as unknown as LoaderContext, logger, stored };
}

function fakeDevServerContext() {
  const changeListeners: ChangeListener[] = [];
  const fake = fakeLoaderContext();
  const watcher = {
    add: vi.fn(),
    on: (_event: string, listener: ChangeListener) => {
      changeListeners.push(listener);
    },
  };
  return {
    ...fake,
    context: { ...fake.context, watcher } as unknown as LoaderContext,
    changeListeners,
  };
}

const VALID_YAML = "current:\n  label: Playing\n";
const MALFORMED_YAML = "current:\n  label: [Playing\n";
const TWO_ENTRIES_WITHOUT_AN_ID = `
- label: No id
- id: kept
  label: Has an id
- label: Also no id
`;

// Astro's and the parser's wording are their own, so these match only what an
// editor needs: the collection, the file and, for broken YAML, the line and column.
function namingCollectionAndFile(fileName: string) {
  return new RegExp(`^now: [^]*${fileName.replace(".", "\\.")}`);
}

function namingLineAndColumn(fileName: string) {
  const collectionAndFile = namingCollectionAndFile(fileName).source;
  return new RegExp(`${collectionAndFile}[^]*line \\d+, column \\d+`);
}

describe("strictFile in a build (no watcher)", () => {
  it("rejects when the file is missing, naming the collection and file", async () => {
    const { context } = fakeLoaderContext();

    await expect(strictFile("missing.yaml").load(context)).rejects.toThrow(
      namingCollectionAndFile("missing.yaml"),
    );
  });

  it("rejects when the YAML does not parse, giving the file, the reason and the line", async () => {
    await writeFile(join(directory, "broken.yaml"), MALFORMED_YAML);
    const { context } = fakeLoaderContext();

    await expect(strictFile("broken.yaml").load(context)).rejects.toThrow(
      namingLineAndColumn("broken.yaml"),
    );
  });

  it("reports every logged problem in one failure, rather than only the first", async () => {
    await writeFile(join(directory, "list.yaml"), TWO_ENTRIES_WITHOUT_AN_ID);
    const { context } = fakeLoaderContext();

    const failure: Error = await strictFile("list.yaml")
      .load(context)
      .then(
        () => new Error("expected the load to reject"),
        (error) => error,
      );

    expect(failure.message.match(/list\.yaml/g)).toHaveLength(2);
  });

  it("rejects when a copied entry keeps its key, rather than one silently replacing the other", async () => {
    await writeFile(
      join(directory, "copied.yaml"),
      `${VALID_YAML}${VALID_YAML}`,
    );
    const { context } = fakeLoaderContext();

    await expect(strictFile("copied.yaml").load(context)).rejects.toThrow(
      namingLineAndColumn("copied.yaml"),
    );
  });

  it("rejects when the file is empty", async () => {
    await writeFile(join(directory, "empty.yaml"), "");
    const { context } = fakeLoaderContext();

    await expect(strictFile("empty.yaml").load(context)).rejects.toThrow(
      namingCollectionAndFile("empty.yaml"),
    );
  });

  it("stores each entry of a valid file under its key", async () => {
    await writeFile(join(directory, "valid.yaml"), VALID_YAML);
    const { context, stored } = fakeLoaderContext();

    await strictFile("valid.yaml").load(context);

    expect(Object.fromEntries(stored)).toEqual({
      current: { label: "Playing" },
    });
  });
});

describe("strictFile on the dev server (with a watcher)", () => {
  it("only logs a missing file, so the server stays up", async () => {
    const { context, logger } = fakeDevServerContext();

    await expect(
      strictFile("missing.yaml").load(context),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("missing.yaml"),
    );
  });

  it("only logs YAML that does not parse at startup", async () => {
    await writeFile(join(directory, "broken.yaml"), MALFORMED_YAML);
    const { context, logger } = fakeDevServerContext();

    await expect(
      strictFile("broken.yaml").load(context),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("broken.yaml"),
    );
  });

  it("only logs a half-saved edit, keeping the last good content", async () => {
    const filePath = join(directory, "now.yaml");
    await writeFile(filePath, VALID_YAML);
    const { context, logger, stored, changeListeners } = fakeDevServerContext();
    await strictFile("now.yaml").load(context);

    await writeFile(filePath, MALFORMED_YAML);
    await changeListeners[0](filePath);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("now.yaml"),
    );
    expect(Object.fromEntries(stored)).toEqual({
      current: { label: "Playing" },
    });
  });
});

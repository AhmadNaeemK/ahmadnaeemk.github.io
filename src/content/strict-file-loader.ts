import { file, type Loader, type LoaderContext } from "astro/loaders";

/**
 * Astro's `file()` loader only logs when a file is missing or its YAML does not
 * parse, and the build then carries on without that content. This makes those
 * logs fatal in builds. The dev server has a watcher and stays forgiving, because
 * throwing from a watcher callback would take it down on every half-saved edit.
 */
export function strictFile(fileName: string): Loader {
  const loader = file(fileName);
  return {
    name: "strict-file-loader",
    load: async (context) => {
      if (context.watcher) {
        return loader.load(context);
      }
      const problems: string[] = [];
      await loader.load({
        ...context,
        logger: collectProblems(context.logger, problems),
      });
      if (problems.length > 0) {
        throw new Error(`${context.collection}: ${problems.join("\n")}`);
      }
    },
  };
}

/**
 * Astro logs a YAML failure's reason and line through `debug`, straight after its
 * `error`, so anything logged after the first error counts as part of the problem.
 */
function collectProblems(
  logger: LoaderContext["logger"],
  problems: string[],
): LoaderContext["logger"] {
  return Object.create(logger, {
    error: {
      value: (message: string) => {
        problems.push(message);
      },
    },
    debug: {
      value: (message: string) => {
        if (problems.length > 0) {
          problems.push(message);
        }
        logger.debug(message);
      },
    },
  });
}

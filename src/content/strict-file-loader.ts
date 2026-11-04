import { file, type Loader, type LoaderContext } from "astro/loaders";

type FileParser = NonNullable<
  NonNullable<Parameters<typeof file>[1]>["parser"]
>;

/**
 * Astro's `file()` loader only logs when a file is missing or does not parse, and
 * the build then carries on without that content. This makes those logs fatal in
 * builds. The dev server has a watcher and stays forgiving, because throwing from
 * a watcher callback would take it down on every half-saved edit.
 *
 * `parser` reads formats Astro does not know, in place of its YAML parsing. What it
 * throws is reported like a YAML failure.
 */
export function strictFile(fileName: string, parser?: FileParser): Loader {
  const loader = file(fileName, { parser });
  return {
    name: "strict-file-loader",
    load: async (context) => {
      if (context.watcher) {
        return loader.load({
          ...context,
          logger: showingProblemReasons(context.logger),
        });
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
 * The dev server hides `debug`, which would leave a failed parse saying only that
 * the file could not be read, without the reason or line.
 */
function showingProblemReasons(
  logger: LoaderContext["logger"],
): LoaderContext["logger"] {
  let reasonIsNext = false;
  return Object.create(logger, {
    error: {
      value: (message: string) => {
        logger.error(message);
        reasonIsNext = true;
      },
    },
    debug: {
      value: (message: string) => {
        if (reasonIsNext) {
          logger.error(message);
        } else {
          logger.debug(message);
        }
        reasonIsNext = false;
      },
    },
  });
}

/**
 * Astro logs a parse failure's reason and line through `debug`, straight after its
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

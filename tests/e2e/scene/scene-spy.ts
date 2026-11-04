/** The spy put on every page under test, on browser prototypes only. */
import type { Page } from "@playwright/test";
import {
  SCENE_STATE_ATTRIBUTE,
  THEME_ROOT_ATTRIBUTE,
  type SceneContext,
} from "../../../src/scene/contract";

const SCENE_METHODS = [
  "resize",
  "draw",
  "hitTrain",
  "applyColorScheme",
  "onFontsReady",
] as const;
type SceneMethod = (typeof SCENE_METHODS)[number];
export type SceneCallName = SceneMethod | "createScene";

interface SceneSpy {
  rawFrame: typeof requestAnimationFrame;
  /** Scene draws so far by theme: canvas calls in one task count as one draw. */
  draws: Record<string, number>;
  widthWrites: Record<string, number>;
  /** Width writes at the end of the task that last set `running`. */
  widthWritesAtShow: Record<string, number>;
  /** Canvas calls and width writes in order, so a draw before a resize shows. */
  canvasEvents: Record<string, ("draw" | "resize")[]>;
  stateLog: { theme: string; state: string | null }[];
  drawsByFrame: Map<number, number>;
  rafRequestsByFrame: Map<number, number>;
  lastRafId: number;
  throwOnCanvasCalls: string | null;
  throwOnWidthWrites: string | null;
  /** Rewritten bundle only, see `openWithCheckedStep`. */
  stepFault: boolean;
  stepsByFrame: Map<number, number>;
  sceneCalls: { theme: string; method: SceneCallName }[];
  /** What the runtime last asked `hitTrain`, with the chunk rewrite only. */
  lastHitTrainArgs: unknown[] | null;
  /** Chunk rewrite only, see `instrumentScenes`. */
  sceneFault: { theme: string; method: SceneCallName } | null;
  /** Chunk rewrite only: compares the world before and after each scene call. */
  watchWorld: boolean;
  worldChecks: number;
  worldChanges: { theme: string; method: SceneCallName }[];
  contexts: Record<string, SceneContext>;
  wrapCreateScene(
    create: (context: SceneContext) => Record<SceneMethod, unknown>,
  ): (context: SceneContext) => unknown;
  checkStep<T>(world: T): T;
}

declare global {
  interface Window {
    __sceneSpy: SceneSpy;
  }
}

function installSceneSpy(hooks: {
  rootAttribute: string;
  stateAttribute: string;
  methods: readonly SceneMethod[];
}): void {
  const { rootAttribute, stateAttribute, methods } = hooks;
  const themeOf = (element: Element | null) =>
    element?.closest(`[${rootAttribute}]`)?.getAttribute(rootAttribute) ?? null;
  const frameNow = () => Number(document.timeline.currentTime);
  const bump = (counts: Map<number, number>) => {
    const frame = frameNow();
    counts.set(frame, (counts.get(frame) ?? 0) + 1);
  };

  const rawFrame = window.requestAnimationFrame.bind(window);
  const spy: SceneSpy = {
    rawFrame,
    draws: {},
    widthWrites: {},
    widthWritesAtShow: {},
    canvasEvents: {},
    stateLog: [],
    drawsByFrame: new Map(),
    rafRequestsByFrame: new Map(),
    lastRafId: 0,
    throwOnCanvasCalls: null,
    throwOnWidthWrites: null,
    stepFault: false,
    stepsByFrame: new Map(),
    sceneCalls: [],
    lastHitTrainArgs: null,
    sceneFault: null,
    watchWorld: false,
    worldChecks: 0,
    worldChanges: [],
    contexts: {},
    wrapCreateScene: (create) => (context) => {
      const theme = themeOf(context.canvas) ?? "";
      const enter = (method: SceneCallName) => {
        spy.sceneCalls.push({ theme, method });
        const fault = spy.sceneFault;
        if (fault?.theme === theme && fault.method === method) {
          throw new Error(`Injected fault in ${method}`);
        }
      };
      spy.contexts[theme] = context;
      enter("createScene");
      const scene = create(context);
      // The view is shallow, so `world.cars.length = 0` gets past it. Not around
      // `hitTrain`, which a hover sweep calls thousands of times.
      const worldSnapshot = () => {
        const { cars, people, puffs, livery, liveryId } = context.world;
        return JSON.stringify({ cars, people, puffs, livery, liveryId });
      };
      return Object.fromEntries(
        methods.map((method) => [
          method,
          (...args: unknown[]) => {
            enter(method);
            if (method === "hitTrain") spy.lastHitTrainArgs = args;
            const call = () =>
              (scene[method] as (...a: unknown[]) => unknown)(...args);
            if (!spy.watchWorld || method === "hitTrain") return call();
            const before = worldSnapshot();
            const result = call();
            spy.worldChecks += 1;
            if (worldSnapshot() !== before) {
              spy.worldChanges.push({ theme, method });
            }
            return result;
          },
        ]),
      );
    },
    checkStep(world) {
      bump(spy.stepsByFrame);
      if (spy.stepFault) throw new Error("Injected engine fault");
      return world;
    },
  };
  window.__sceneSpy = spy;

  window.requestAnimationFrame = (callback) => {
    bump(spy.rafRequestsByFrame);
    spy.lastRafId = rawFrame(callback);
    return spy.lastRafId;
  };

  let batchOpen = false;
  const context2d = CanvasRenderingContext2D.prototype as unknown as Record<
    string,
    (...args: unknown[]) => unknown
  >;
  for (const method of [
    "clearRect",
    "fillRect",
    "fill",
    "stroke",
    "drawImage",
    "fillText",
    "strokeRect",
    "strokeText",
    // The only way a scene that builds its frame by hand paints the canvas.
    "putImageData",
  ]) {
    const original = context2d[method];
    context2d[method] = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      const canvas = this.canvas as HTMLCanvasElement;
      const theme = themeOf(canvas);
      if (theme) {
        if (spy.throwOnCanvasCalls === theme) {
          throw new Error("Injected fault in a canvas call");
        }
        if (!batchOpen) {
          batchOpen = true;
          queueMicrotask(() => {
            batchOpen = false;
          });
          spy.draws[theme] = (spy.draws[theme] ?? 0) + 1;
          (spy.canvasEvents[theme] ??= []).push("draw");
          bump(spy.drawsByFrame);
        }
      }
      return original.apply(this, args);
    };
  }

  const widthProperty = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    "width",
  ) as PropertyDescriptor;
  Object.defineProperty(HTMLCanvasElement.prototype, "width", {
    ...widthProperty,
    set(this: HTMLCanvasElement, value: number) {
      const theme = themeOf(this);
      if (theme) {
        if (spy.throwOnWidthWrites === theme) {
          throw new Error("Injected fault in a width write");
        }
        spy.widthWrites[theme] = (spy.widthWrites[theme] ?? 0) + 1;
        (spy.canvasEvents[theme] ??= []).push("resize");
      }
      widthProperty.set?.call(this, value);
    },
  });

  // Runs after the task that wrote the attribute, so it sees all of a show.
  new MutationObserver((records) => {
    for (const record of records) {
      const root = record.target as Element;
      const theme = root.getAttribute(rootAttribute) ?? "";
      const state = root.getAttribute(stateAttribute);
      spy.stateLog.push({ theme, state });
      if (state === "running") {
        spy.widthWritesAtShow[theme] = spy.widthWrites[theme] ?? 0;
      }
    }
  }).observe(document, {
    subtree: true,
    attributes: true,
    attributeFilter: [stateAttribute],
  });
}

export async function addSceneSpy(page: Page): Promise<void> {
  await page.addInitScript(installSceneSpy, {
    rootAttribute: THEME_ROOT_ATTRIBUTE,
    stateAttribute: SCENE_STATE_ATTRIBUTE,
    methods: SCENE_METHODS,
  });
}

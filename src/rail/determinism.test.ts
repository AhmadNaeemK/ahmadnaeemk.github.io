import { describe, expect, it } from "vitest";
import { type World } from "./index";
import { startWorld, stateOf, step } from "./testkit";

const CHECKPOINT_FRAMES = 400;
const CHECKPOINTS = 4;

/** The same presses and clock each time, with every kind of control in them. */
function pressAt(world: World, checkpoint: number): void {
  const presses = [
    () => world.toggleStop(true),
    () => world.setSpeed(3),
    () => world.setLivery("steam"),
    () => world.toggleStop(false),
  ];
  presses[checkpoint % presses.length]();
}

function statesOfARide(
  world: World,
  stepAlongside: () => void = () => {},
): ReturnType<typeof stateOf>[] {
  const states = [stateOf(world)];
  for (let checkpoint = 0; checkpoint < CHECKPOINTS; checkpoint += 1) {
    pressAt(world, checkpoint);
    for (let frame = 0; frame < CHECKPOINT_FRAMES; frame += 1) {
      step(world, 1);
      stepAlongside();
    }
    states.push(stateOf(world));
  }
  return states;
}

describe("a seed and a clock", () => {
  it("give an identical world every time", () => {
    expect(statesOfARide(startWorld())).toEqual(statesOfARide(startWorld()));
  });

  it("give the same world whatever a second one is doing alongside it", () => {
    const expected = statesOfARide(startWorld());
    const second = startWorld({ seed: 99, livery: "steam" });
    second.setSpeed(3);

    const actual = statesOfARide(startWorld(), () => {
      step(second, 2);
    });

    expect(actual).toEqual(expected);
  });

  it("give the same world after a second one was created part way through", () => {
    const expected = statesOfARide(startWorld());
    const world = startWorld();
    const states = [stateOf(world)];
    for (let checkpoint = 0; checkpoint < CHECKPOINTS; checkpoint += 1) {
      startWorld({ seed: checkpoint + 100 });
      pressAt(world, checkpoint);
      step(world, CHECKPOINT_FRAMES);
      states.push(stateOf(world));
    }

    expect(states).toEqual(expected);
  });

  it.each([12, 23, 31, 0, -5])("give a different world for seed %i", (seed) => {
    const world = startWorld();
    const other = startWorld({ seed });

    expect(stateOf(other)).not.toEqual(stateOf(world));
    step(world, CHECKPOINT_FRAMES);
    step(other, CHECKPOINT_FRAMES);
    expect(stateOf(other)).not.toEqual(stateOf(world));
  });
});

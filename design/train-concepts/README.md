# Train portfolio: design concepts

Three playable concepts for the new ahmadnaeem.dev hero and page, all driven by one shared simulation.

- `shared/engine.js`: the "ahmad" track geometry, the route (bridge from the top of the h to the top of the d, tunnels at every other letter end), train motion with station stops, passengers and the five train liveries. Renderers only read its state.
- `shared/content.py`: CV content as data, used by every concept.
- `concepts/a`: Interchange, a top-down transit map.
- `concepts/b`: Diorama, a 2.5D model railway with day and night.
- `concepts/c`: Pixel Depot, a top-down pixel-art town with game-menu sections.

Build: `python3 build.py` (needs Jinja2) writes `dist/<concept>/index.html`.
Screenshots: `node shot.js a` and `node zoom.js a steam dark 1500,7000` (needs Playwright).

These are design prototypes. The production build (Astro, tests, GitHub Actions) comes after a concept is chosen.

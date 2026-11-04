# Site content

Each YAML file here, and `now.txt`, is one content collection, defined in `src/content.config.ts`. Editing content means editing one file. A mistake fails `npm run build` with a message naming the entry and field.

| File              | Holds                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `profile.yaml`    | Name, links, about text, facts, the short lines themes show about Ahmad, and photo paths |
| `experience.yaml` | Jobs                                                                                     |
| `education.yaml`  | Degrees                                                                                  |
| `projects.yaml`   | Projects, each with a required logo                                                      |
| `skills.yaml`     | Skill groups                                                                             |
| `now.txt`         | The "Right now" items, at least one                                                      |

Each entry's `order` field sets its display position, because collections do not keep file order. Pages and themes read everything through `getSiteContent()` in `site.ts`.

## "Right now" items

`now.txt` holds one item per line, in the order they appear. Write anything: `Building this portfolio`, or a link. To show a small label before the text, write `Playing: Sekiro`, with a space after the colon and at most 30 characters before it. Each line can be up to 200 characters. Blank lines and lines starting with `#` are ignored. Pixel Depot's board only draws English letters, digits and common punctuation. Links show as plain text and can't be clicked on the boards.

After a change reaches `main`, the site rebuilds. If a line is too long, or the file has no items, the run fails with a red X, its log says why, and the live site keeps the old text until it is fixed.

## Facts and theme copy

Anything true of Ahmad lives here, so correcting it means editing one file: `favouriteGame`, `projectsLede`, and the two wordings of how to reach him, `contactLead` (Interchange) and `contactNote` (Diorama and Pixel Depot). What belongs to a theme's own voice stays in that theme: UI hints, section names, Pixel Depot's "The town is asleep" note and Diorama's plate.

## Dates

Write months as `2024-07`, and an ongoing end date as `present`. They stay strings and display as "Jul 2024", so no timezone can change them.

## The CV PDF needs a manual update

`public/Ahmad_Naeem_CV.pdf` is not generated from these files, so the two can disagree. When a job, project or date changes here, update and replace the PDF in the same change. Keep the filename: `/Ahmad_Naeem_CV.pdf` is the stable download URL. A `cv` path that points at no file, or a missing PDF, fails `npm test`, not `npm run build`, because the build does not check `public/`.

## Images

Logos and photos live in `assets/`. `logos/source` from the prototypes is deliberately not here, because anything in `assets/` that an entry references ships with the site.

`portraitPixels` must keep its exact pixels, because it renders with `image-rendering: pixelated`. `getSiteContent()` returns it as a plain `{ url, width, height }`, so use it in a plain `<img>`. Never pass the file through `<Image>` or another resize or lossy step.

## Open inputs

- `now.txt` holds placeholder text until Ahmad supplies the real items.
- `portrait.jpg` (480×600) and `contact.jpg` (320×320) are the prototype sizes. Replace them when the originals arrive, because the image pipeline cannot upscale.

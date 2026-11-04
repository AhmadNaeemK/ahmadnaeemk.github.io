/**
 * The helpers every theme's markup hooks into, bound once for all three. The CV
 * link has nothing to bind: it is a plain download link.
 */
import { THEME_HOOKS, THEME_ROOT_ATTRIBUTE } from "../scene/contract";

const COPY_FEEDBACK_MS = 1800;

function selectContents(element: Element): void {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function bindCopyButton(button: HTMLElement): void {
  const label = button.querySelector(THEME_HOOKS.copyLabel) ?? button;
  // Read once: a second press during the feedback would otherwise keep "Copied".
  const restingLabel = label.textContent;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? "");
      label.textContent = "Copied";
    } catch {
      // No clipboard access: leave the text selected, ready to copy by hand.
      const target = button
        .closest(`[${THEME_ROOT_ATTRIBUTE}]`)
        ?.querySelector(THEME_HOOKS.copyTarget);
      if (target) selectContents(target);
      label.textContent = "Selected, now copy it";
    }
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      label.textContent = restingLabel;
    }, COPY_FEEDBACK_MS);
  });
}

export function startPageHelpers(): void {
  document
    .querySelectorAll<HTMLElement>(THEME_HOOKS.copy)
    .forEach(bindCopyButton);

  const year = String(new Date().getFullYear());
  for (const element of document.querySelectorAll(THEME_HOOKS.year)) {
    element.textContent = year;
  }
}

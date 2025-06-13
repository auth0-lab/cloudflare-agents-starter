import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks which sides of a DOM element are partially hidden due to overflow: hidden
 * on any of its ancestor elements.
 *
 * @param el - The HTMLElement to check.
 * @returns An object containing an array of the sides that are partially hidden.
 * Possible values are "top", "right", "bottom", and "left".
 *
 * @example
 * const result = getHiddenSides(document.getElementById("my-element"));
 * // result: { partiallyHidden: ["top", "right"] }
 */
export function getHiddenSides(
  el: HTMLElement | null
): Array<"top" | "right" | "bottom" | "left"> {
  if (!el || !el.parentElement) return [];

  const hiddenSides = new Set<"top" | "right" | "bottom" | "left">();
  const rect = el.getBoundingClientRect();
  let parent: HTMLElement | null = el.parentElement;

  while (parent) {
    const style = getComputedStyle(parent);
    const hasHiddenOverflow =
      style.overflow === "hidden" ||
      style.overflowX === "hidden" ||
      style.overflowY === "hidden";

    if (hasHiddenOverflow) {
      const parentRect = parent.getBoundingClientRect();

      if (rect.top < parentRect.top) hiddenSides.add("top");
      if (rect.left < parentRect.left) hiddenSides.add("left");
      if (rect.bottom > parentRect.bottom) hiddenSides.add("bottom");
      if (rect.right > parentRect.right) hiddenSides.add("right");
    }

    parent = parent.parentElement;
  }

  return Array.from(hiddenSides);
}

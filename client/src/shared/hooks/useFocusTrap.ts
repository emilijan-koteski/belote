import { useEffect, useRef } from "react";

/**
 * Traps focus within a container element and restores focus to the
 * previously focused element when the container unmounts.
 */
export function useFocusTrap<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const focusable = container!.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    // Focus first focusable element
    const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      // Restore previous focus
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, []);

  return containerRef;
}

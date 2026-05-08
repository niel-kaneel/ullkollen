import { useEffect } from "react";

/**
 * Visar webbläsarens "är du säker?"-dialog om användaren försöker stänga
 * fliken eller navigera bort medan `dirty` är true.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

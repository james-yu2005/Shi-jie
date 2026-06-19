/** True when the primary input supports hover (mouse/trackpad), not touch-only. */
export function prefersFinePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

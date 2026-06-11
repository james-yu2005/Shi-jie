/** makemeahanzi animated stroke-order SVG (unicode code point in filename). */
export function strokeAnimatedUrl(char: string): string | null {
  const cp = char.codePointAt(0);
  if (!cp) return null;
  return `https://cdn.jsdelivr.net/gh/skishore/makemeahanzi@master/svgs/${cp}.svg`;
}

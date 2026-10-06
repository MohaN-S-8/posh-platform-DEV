import { useBrandingStore } from "../store/brandingStore";

const colors = ["#5b3b94", "#16735c", "#ad365d", "#246aa1", "#966014"];
export function LoadingBrand() {
  const name = useBrandingStore((state) => state.portalName);
  const letters = typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(name), (item) => item.segment)
    : Array.from(name);
  return <div className="loading-brand-letters" role="img" aria-label={name}>
    {letters.map((letter, index) => /\s/u.test(letter)
      ? <span key={index} className="loading-brand-space" aria-hidden="true" />
      : <span key={index} className="loading-brand-letter" aria-hidden="true" style={{ backgroundColor: colors[index % colors.length], animationDelay: `${(index % 12) * 65}ms` }}>{letter}</span>)}
  </div>;
}

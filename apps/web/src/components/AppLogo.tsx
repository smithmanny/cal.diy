/** An app's logo next to its name, so it's decorative (empty alt). */
export function AppLogo({ src, className = "size-8 rounded" }: { src: string; className?: string }) {
  // biome-ignore lint/performance/noImgElement: small static logos; there is no image optimizer to route them through
  return <img src={src} alt="" className={className} />;
}

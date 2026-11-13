import { english } from "./english";
import type { ReactNode } from "react";

// Reserve the larger translation's footprint without exposing duplicate text
// to assistive technology. Visible copy and user-entered content stay intact.
const variants = new Map<string, Set<string>>();
for (const [vi, en] of Object.entries(english)) {
  if (vi.includes("{") || en.includes("{")) continue;
  const group = variants.get(en.trim()) ?? new Set([en]);
  group.add(vi);
  variants.set(en.trim(), group);
  variants.set(vi.trim(), group);
}

export function StableText({
  children,
  after,
}: {
  children: string;
  after?: ReactNode;
}) {
  const alternatives = variants.get(children.trim());
  if (!alternatives || alternatives.size < 2)
    return (
      <>
        {children}
        {after}
      </>
    );
  return (
    <span className="stable-text">
      <span className="stable-text-visible">
        {children}
        {after}
      </span>
      {[...alternatives]
        .filter((text) => text !== children)
        .map((text) => (
          <span key={text} aria-hidden="true" className="stable-text-reserve">
            {text}
            {after}
          </span>
        ))}
    </span>
  );
}

import type { SVGProps } from "react";

export function ExploreBoldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" {...props}>
      <circle cx="10" cy="10" r="8" strokeWidth="2.4" />
      <path
        d="m13.5 6.5-1.7 5.3-5.3 1.7 1.7-5.3 5.3-1.7Z"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

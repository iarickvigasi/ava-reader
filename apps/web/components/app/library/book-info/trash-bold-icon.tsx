import type { SVGProps } from "react";

export function TrashBoldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" {...props}>
      <path d="M2.25 4.5h15.5" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M7.5 4.5V2.5h5v2" strokeWidth="2.5" strokeLinejoin="round" />
      <path
        d="M4.25 8.75v7.75h11.5V8.75"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.15 11v3" strokeWidth="2" strokeLinecap="round" />
      <path d="M11.85 11v3" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

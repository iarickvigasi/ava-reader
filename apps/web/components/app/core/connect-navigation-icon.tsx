import type { SVGProps } from "react";

export function ConnectNavigationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m7.75 11 8.5-5m-8.5 7 8.5 5" />
      <circle cx="5.75" cy="12" r="2.25" />
      <circle cx="18.25" cy="4.75" r="2.25" />
      <circle cx="18.25" cy="19.25" r="2.25" />
    </svg>
  );
}

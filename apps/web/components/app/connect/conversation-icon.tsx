import type { SVGProps } from "react";

export function ConversationIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M11 3h2a9 9 0 0 1 0 18H6a4 4 0 0 1-4-4v-5a9 9 0 0 1 9-9Z" />
      <path d="M8 10h8m-8 4h4" />
    </svg>
  );
}

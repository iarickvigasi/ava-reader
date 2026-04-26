import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function LightbulbIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M9 17.5h6"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M10 20.5h4"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M7.2 12.5a5.5 5.5 0 1 1 9.6 0c-.7 1.1-1.3 1.8-1.6 2.5-.2.4-.2.9-.2 1.4v1.1H9v-1.1c0-.5 0-1-.2-1.4-.3-.7-.9-1.4-1.6-2.5Z"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EtymologyIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3 5.5h6c1.1 0 2 .9 2 2V19c0-1.1-.9-2-2-2H3v-11.5Z"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M21 5.5h-6c-1.1 0-2 .9-2 2V19c0-1.1.9-2 2-2h6v-11.5Z"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 9h3.2"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M5.5 12h3.2"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M15.3 9h3.2"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M15.3 12h3.2"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

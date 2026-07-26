import type { SVGProps } from "react";

export function MinusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 12h12" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 6v12" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 12h12" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path
        d="m6 9 6 6 6-6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SpeakerSmallIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M4 9v6h3l5 4V5L7 9H4Z"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SpeakerLargeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M4 9v6h3l5 4V5L7 9H4Z"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M16 8.5a5 5 0 0 1 0 7"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M18.5 6a8 8 0 0 1 0 12"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

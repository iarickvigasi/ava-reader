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

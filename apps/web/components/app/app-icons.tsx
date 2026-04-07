import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function HomeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M3 10.5 12 3l9 7.5" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M5.5 9.5V20h13V9.5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExploreIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="m15.5 8.5-3 7-4.5 2 2-4.5 7-3Z"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="8" strokeWidth="1.8" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M19 16.5 20 19l2.5 1-2.5 1L19 23l-1-2.5L15.5 19l2.5-1L19 16.5Z" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M5 20V10" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 20V5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 20v-7" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 20h16" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <circle cx="12" cy="12" r="4" strokeWidth="1.8" />
      <path d="M12 2.75v2.5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 18.75v2.5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21.25 12h-2.5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5.25 12h-2.5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m18.54 5.46-1.77 1.77" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m7.23 16.77-1.77 1.77" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m18.54 18.54-1.77-1.77" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m7.23 7.23-1.77-1.77" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M18.2 14.8A7.75 7.75 0 0 1 9.2 5.8a8.25 8.25 0 1 0 9 9Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M12 15V5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m8 9 4-4 4 4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M5 12h13" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m13 7 5 5-5 5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function QuoteMarkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M8 8c-2 1.7-3 3.8-3 6h4l-1 4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 8c-2 1.7-3 3.8-3 6h4l-1 4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M7 4h10v16l-5-3-5 3V4Z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="m5 12.5 4.2 4.2L19 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M4 8h3l1.5-2h7L17 8h3v10H4V8Z" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3" strokeWidth="1.8" />
    </svg>
  );
}

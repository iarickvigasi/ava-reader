export function BrandSigilDivider() {
  return (
    <div className="flex items-center gap-4 text-ink">
      <div className="h-px w-12 bg-line" />
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 4.25C7.72 4.25 4.25 7.5 4.25 11.5C4.25 15.5 7.48 18.75 11.47 18.75C14.75 18.75 17.35 16.48 17.35 13.56C17.35 11.05 15.42 9.09 13.01 9.09C10.97 9.09 9.34 10.6 9.34 12.47C9.34 14.02 10.55 15.23 12.11 15.23C13.36 15.23 14.36 14.31 14.36 13.15C14.36 12.29 13.76 11.6 12.9 11.45"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="h-px w-12 bg-line" />
    </div>
  );
}

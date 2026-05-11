import type { SVGProps } from "react";

export function MagnifierIcon({
  size = 16,
  className,
  ...props
}: { size?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, "size">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

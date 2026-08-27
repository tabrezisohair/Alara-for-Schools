import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Svg>
  );
}
export function IconCreate(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}
export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </Svg>
  );
}
export function IconCampaigns(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h3l8-5v10l-8-5H4z" />
      <path d="M18 9.5v5" />
    </Svg>
  );
}
export function IconLibrary(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M9 9h6M9 13h4" />
    </Svg>
  );
}
export function IconPerformance(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 19V10M12 19V5M19 19v-7" />
    </Svg>
  );
}
export function IconBrain(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4.5a3 3 0 0 0-3 3v.4A3 3 0 0 0 4 10.5 3 3 0 0 0 6.5 14v3A2.5 2.5 0 0 0 9 19.5h6a2.5 2.5 0 0 0 2.5-2.5v-3A3 3 0 0 0 20 10.5a3 3 0 0 0-2-2.6V7.5a3 3 0 0 0-3-3h-.4A3 3 0 0 0 12 3a3 3 0 0 0-2.6 1.5Z" />
    </Svg>
  );
}
export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
    </Svg>
  );
}
export function IconBell(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 16h12l-1.2-2.1A6 6 0 0 1 16 10V9a4 4 0 1 0-8 0v1a6 6 0 0 1-1.8 3.9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </Svg>
  );
}
export function IconHelp(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 3.5 2.1c-.7.4-1.1.9-1.1 1.7V14" />
      <path d="M12 17h.01" />
    </Svg>
  );
}
export function IconMore(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
    </Svg>
  );
}
export function IconChevron(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}
export function IconParty(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 14 4 20l6-3 7-11 3 2-7 11" />
      <path d="M14 5h.01M17 8h.01M20 4h.01" />
    </Svg>
  );
}
export function IconMegaphone(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11v2a2 2 0 0 0 2 2h1l6 4V5L7 9H6a2 2 0 0 0-2 2Z" />
      <path d="M15 9.5a3.5 3.5 0 0 1 0 5" />
    </Svg>
  );
}
export function IconTrophy(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
      <path d="M8 6H5.5A2.5 2.5 0 0 0 8 9.5M16 6h2.5A2.5 2.5 0 0 1 16 9.5" />
      <path d="M10 14h4v3H10zM8 20h8" />
    </Svg>
  );
}
export function IconCap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 10 12 6l9 4-9 4-9-4Z" />
      <path d="M7 12v4c2 1.5 8 1.5 10 0v-4" />
    </Svg>
  );
}
export function IconSchool(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V9l8-4 8 4v11" />
      <path d="M9 20v-6h6v6" />
    </Svg>
  );
}
export function IconPhotos(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m8 16 3-3 3 3 3-4 3 4" />
    </Svg>
  );
}
export function IconSpark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 13.5 9.5 19 11 13.5 12.5 12 18 10.5 12.5 5 11 10.5 9.5z" />
    </Svg>
  );
}
export function IconUsers(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 19a5 5 0 0 1 10 0" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 19a4 4 0 0 1 4-3.2" />
    </Svg>
  );
}
export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 19 6v6c0 5-3.2 8.2-7 9.5C8.2 20.2 5 17 5 12V6z" />
    </Svg>
  );
}

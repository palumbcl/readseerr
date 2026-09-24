/**
 * Icônes au trait (style Heroicons outline, comme Seerr), dimensionnées par le CSS
 * ou via `size`. Toutes héritent de la couleur du texte.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const SparklesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.8 15.9 9 18.75l-.8-2.85a4.5 4.5 0 0 0-3.1-3.1L2.25 12l2.85-.8a4.5 4.5 0 0 0 3.1-3.1L9 5.25l.8 2.85a4.5 4.5 0 0 0 3.1 3.1l2.85.8-2.85.8a4.5 4.5 0 0 0-3.1 3.1Z" />
    <path d="M18.26 8.72 18 9.75l-.26-1.03a3.38 3.38 0 0 0-2.46-2.46L14.25 6l1.03-.26a3.38 3.38 0 0 0 2.46-2.46L18 2.25l.26 1.03a3.38 3.38 0 0 0 2.46 2.46l1.03.26-1.03.26a3.38 3.38 0 0 0-2.46 2.46Z" />
    <path d="M16.9 20.56 16.5 21.75l-.4-1.19a2.25 2.25 0 0 0-1.42-1.42l-1.18-.39 1.18-.4a2.25 2.25 0 0 0 1.42-1.41l.4-1.19.39 1.19a2.25 2.25 0 0 0 1.42 1.42l1.19.39-1.19.4a2.25 2.25 0 0 0-1.42 1.41Z" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const ExclamationIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 9v3.75m-9.3 3.38c-.87 1.5.22 3.37 1.95 3.37h14.7c1.73 0 2.82-1.87 1.95-3.37L13.95 3.38c-.87-1.5-3.03-1.5-3.9 0L2.7 16.13Z" />
    <path d="M12 15.75h.01" />
  </Icon>
);

export const CogIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.6 3.94c.09-.54.56-.94 1.11-.94h2.6c.55 0 1.02.4 1.11.94l.21 1.28c.07.42.37.77.76.97.09.04.17.09.26.14.38.22.84.29 1.25.13l1.22-.46a1.13 1.13 0 0 1 1.37.49l1.3 2.25c.27.47.16 1.08-.26 1.43l-1 .83c-.33.27-.5.69-.49 1.11v.29c-.01.43.16.84.49 1.11l1 .83c.42.35.53.95.26 1.43l-1.3 2.25a1.13 1.13 0 0 1-1.37.49l-1.22-.46c-.41-.15-.87-.08-1.25.14l-.26.14c-.39.2-.69.55-.76.98l-.21 1.28c-.09.54-.56.94-1.11.94h-2.6c-.55 0-1.02-.4-1.11-.94l-.21-1.28c-.07-.43-.37-.78-.76-.98a6.5 6.5 0 0 1-.26-.14c-.38-.22-.84-.29-1.25-.14l-1.22.46a1.13 1.13 0 0 1-1.37-.49l-1.3-2.25a1.13 1.13 0 0 1 .26-1.43l1-.83c.33-.27.5-.68.49-1.11v-.29c.01-.42-.16-.84-.49-1.11l-1-.83a1.13 1.13 0 0 1-.26-1.43l1.3-2.25a1.13 1.13 0 0 1 1.37-.49l1.22.46c.41.16.87.09 1.25-.13l.26-.14c.39-.2.69-.55.76-.97l.21-1.28Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.1a7.5 7.5 0 0 1 15 0A17.9 17.9 0 0 1 12 21.75c-2.68 0-5.22-.58-7.5-1.65Z" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15" />
    <path d="m18.75 15 3-3m0 0-3-3m3 3H9" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.8-3.8" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);

export const ArrowCircleRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m12.75 15 3-3-3-3M15.75 12H8.25" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4.5 12.75 6 6 9-13.5" />
  </Icon>
);

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 18 18 6M6 6l12 12" />
  </Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </Icon>
);

export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.12 5.1c.08.2.27.33.48.35l5.5.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 0 0-.18.55l1.28 5.37a.56.56 0 0 1-.84.61l-4.71-2.87a.56.56 0 0 0-.58 0L7 20.51a.56.56 0 0 1-.84-.6l1.28-5.38a.56.56 0 0 0-.18-.55l-4.2-3.6a.56.56 0 0 1 .32-.99l5.5-.44a.56.56 0 0 0 .48-.35l2.12-5.1Z" />
  </Icon>
);

export const BookOpenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 6.04A8.97 8.97 0 0 0 6 3.75c-1.05 0-2.06.18-3 .51v14.25A8.99 8.99 0 0 1 6 18c2.3 0 4.4.87 6 2.29m0-14.25a8.97 8.97 0 0 1 6-2.29c1.05 0 2.06.18 3 .51v14.25A8.99 8.99 0 0 0 18 18a8.97 8.97 0 0 0-6 2.29m0-14.25v14.25" />
  </Icon>
);

export const PhotoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m2.25 15.75 5.16-5.16a2.25 2.25 0 0 1 3.18 0l5.16 5.16m-1.5-1.5 1.41-1.41a2.25 2.25 0 0 1 3.18 0l2.91 2.91M3.75 21h16.5A1.5 1.5 0 0 0 21.75 19.5v-15A1.5 1.5 0 0 0 20.25 3H3.75A1.5 1.5 0 0 0 2.25 4.5v15A1.5 1.5 0 0 0 3.75 21Z" />
    <path d="M13.5 7.5h.01" />
  </Icon>
);

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.63 12a.38.38 0 1 1-.75 0 .38.38 0 0 1 .75 0Zm3.75 0a.38.38 0 1 1-.75 0 .38.38 0 0 1 .75 0Zm3.75 0a.38.38 0 1 1-.75 0 .38.38 0 0 1 .75 0Z" />
    <path d="M2.25 12.76c0 1.6 1.12 2.99 2.7 3.23 1.09.16 2.19.28 3.3.37V21l4.08-4.08c.2-.2.47-.32.76-.33a48.7 48.7 0 0 0 5.83-.62c1.6-.23 2.71-1.62 2.71-3.22V6.74c0-1.6-1.12-2.99-2.7-3.22A48.4 48.4 0 0 0 12 3c-2.39 0-4.73.17-7.02.52-1.58.23-2.7 1.62-2.7 3.22v6.02Z" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </Icon>
);

export const InboxIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.01 1.24l.27.53a2.25 2.25 0 0 0 2.01 1.24h3.2a2.25 2.25 0 0 0 2.01-1.24l.27-.53a2.25 2.25 0 0 1 2.01-1.24h3.86M2.25 13.5V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.5M2.25 13.5 4.66 5.7a2.25 2.25 0 0 1 2.15-1.58h10.38c.99 0 1.86.64 2.15 1.58l2.4 7.8" />
  </Icon>
);

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m16.86 4.49 1.69-1.69a1.88 1.88 0 1 1 2.65 2.65L10.58 16.07a4.5 4.5 0 0 1-1.9 1.13L6 18l.8-2.68a4.5 4.5 0 0 1 1.13-1.9l8.93-8.93Z" />
  </Icon>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </Icon>
);

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </Icon>
);

export const TagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.57 3H5.25A2.25 2.25 0 0 0 3 5.25v4.32c0 .6.24 1.17.66 1.6l9.58 9.58c.7.7 1.78.87 2.61.33a18.1 18.1 0 0 0 5.22-5.22c.54-.83.37-1.9-.33-2.61L11.16 3.66A2.25 2.25 0 0 0 9.57 3Z" />
    <path d="M6 6h.01" />
  </Icon>
);

import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg strokeWidth="2.6" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg strokeWidth="2.4" {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function MinusIcon(props: IconProps) {
  return (
    <Svg strokeWidth="2.4" {...props}>
      <path d="M5 12h14" />
    </Svg>
  )
}

export function DocIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Svg>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <Svg strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </Svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <Svg strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg strokeWidth="2" {...props}>
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" />
    </Svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg strokeWidth="2.4" {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  )
}

export function EditIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
    </Svg>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.4" />
    </Svg>
  )
}

export function ShareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </Svg>
  )
}

export function PercentIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 5 5 19" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </Svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </Svg>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg strokeWidth="2.4" {...props}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg strokeWidth="2.4" {...props}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  )
}

export function UserPlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </Svg>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

export function ChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 16v-5M12 16V7M17 16v-8" />
    </Svg>
  )
}

export function WalletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15V7H5a2 2 0 0 0-2 2z" />
      <path d="M16 13h.01" />
    </Svg>
  )
}

export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" />
    </Svg>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg strokeWidth="2.4" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  )
}

export function ChatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.4-.6L3 21l1.7-4.9A8.3 8.3 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
    </Svg>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </Svg>
  )
}

export function ArchiveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </Svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Svg>
  )
}

export function UnlockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.5-2" />
    </Svg>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  )
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </Svg>
  )
}

interface IconProps {
  className?: string;
}

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dash-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9B82FF" />
          <stop offset="1" stopColor="#6C3FC5" />
        </linearGradient>
        <linearGradient id="dash-shine" x1="24" y1="4" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.3" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="7" width="40" height="40" rx="13" fill="#4C2A8A" opacity="0.15" />
      <rect x="4" y="4" width="40" height="40" rx="13" fill="url(#dash-bg)" />
      <rect x="4" y="4" width="40" height="20" rx="13" fill="url(#dash-shine)" />
      <rect x="14" y="14" width="8" height="8" rx="2.5" fill="white" fillOpacity="0.95" />
      <rect x="26" y="14" width="8" height="10" rx="2.5" fill="white" fillOpacity="0.85" />
      <rect x="14" y="26" width="8" height="10" rx="2.5" fill="white" fillOpacity="0.85" />
      <rect x="26" y="28" width="8" height="8" rx="2.5" fill="white" fillOpacity="0.95" />
    </svg>
  );
}

export function EmployeesIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="emp-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#6C3FC5" />
        </linearGradient>
        <linearGradient id="emp-shine" x1="24" y1="4" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.3" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="7" width="40" height="40" rx="13" fill="#4C2A8A" opacity="0.15" />
      <rect x="4" y="4" width="40" height="40" rx="13" fill="url(#emp-bg)" />
      <rect x="4" y="4" width="40" height="20" rx="13" fill="url(#emp-shine)" />
      <circle cx="26" cy="18" r="5.5" fill="white" fillOpacity="0.95" />
      <path d="M17 35c0-5 4-9 9-9s9 4 9 9" fill="white" fillOpacity="0.9" />
      <circle cx="17" cy="20" r="3.5" fill="white" fillOpacity="0.5" />
      <path d="M11 33c0-3.5 2.8-6.5 6-6.5" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function AttendanceIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="att-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B78EF" />
          <stop offset="1" stopColor="#5B35B5" />
        </linearGradient>
        <linearGradient id="att-shine" x1="24" y1="4" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.3" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="7" width="40" height="40" rx="13" fill="#3D1F7A" opacity="0.15" />
      <rect x="4" y="4" width="40" height="40" rx="13" fill="url(#att-bg)" />
      <rect x="4" y="4" width="40" height="20" rx="13" fill="url(#att-shine)" />
      <circle cx="24" cy="25" r="11" fill="none" stroke="white" strokeOpacity="0.9" strokeWidth="2.5" />
      <circle cx="24" cy="25" r="1.5" fill="white" fillOpacity="0.95" />
      <line x1="24" y1="25" x2="24" y2="17" stroke="white" strokeOpacity="0.95" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="25" x2="30" y2="28" stroke="white" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="14" r="1" fill="white" fillOpacity="0.6" />
      <circle cx="35" cy="25" r="1" fill="white" fillOpacity="0.6" />
      <circle cx="13" cy="25" r="1" fill="white" fillOpacity="0.6" />
      <circle cx="24" cy="36" r="1" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

export function LeavesIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leave-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B08FFF" />
          <stop offset="1" stopColor="#7C4FD5" />
        </linearGradient>
        <linearGradient id="leave-shine" x1="24" y1="4" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.3" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="7" width="40" height="40" rx="13" fill="#4C2A8A" opacity="0.15" />
      <rect x="4" y="4" width="40" height="40" rx="13" fill="url(#leave-bg)" />
      <rect x="4" y="4" width="40" height="20" rx="13" fill="url(#leave-shine)" />
      <rect x="13" y="16" width="22" height="20" rx="3" fill="white" fillOpacity="0.9" />
      <rect x="13" y="16" width="22" height="6" rx="3" fill="white" fillOpacity="0.95" />
      <rect x="18" y="13" width="2.5" height="6" rx="1.25" fill="white" fillOpacity="0.95" />
      <rect x="27.5" y="13" width="2.5" height="6" rx="1.25" fill="white" fillOpacity="0.95" />
      <path d="M20 29l2.5 2.5L27.5 27" stroke="#7C4FD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PayrollIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pay-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9070DF" />
          <stop offset="1" stopColor="#5830B0" />
        </linearGradient>
        <linearGradient id="pay-shine" x1="24" y1="4" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.3" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="7" width="40" height="40" rx="13" fill="#3D1F7A" opacity="0.15" />
      <rect x="4" y="4" width="40" height="40" rx="13" fill="url(#pay-bg)" />
      <rect x="4" y="4" width="40" height="20" rx="13" fill="url(#pay-shine)" />
      <rect x="11" y="18" width="26" height="16" rx="3" fill="white" fillOpacity="0.9" />
      <rect x="11" y="15" width="22" height="14" rx="3" fill="white" fillOpacity="0.6" />
      <circle cx="24" cy="26" r="4" fill="none" stroke="#5830B0" strokeWidth="1.5" />
      <text x="24" y="29" textAnchor="middle" fill="#5830B0" fontSize="7" fontWeight="bold">$</text>
    </svg>
  );
}

export function RequestsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="req-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9B80EF" />
          <stop offset="1" stopColor="#6840C0" />
        </linearGradient>
        <linearGradient id="req-shine" x1="24" y1="4" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.3" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="7" width="40" height="40" rx="13" fill="#4C2A8A" opacity="0.15" />
      <rect x="4" y="4" width="40" height="40" rx="13" fill="url(#req-bg)" />
      <rect x="4" y="4" width="40" height="20" rx="13" fill="url(#req-shine)" />
      <rect x="12" y="18" width="24" height="17" rx="3" fill="white" fillOpacity="0.9" />
      <path d="M12 21l12 7 12-7" fill="none" stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="15" y="14" width="18" height="10" rx="2" fill="white" fillOpacity="0.6" />
      <line x1="18" y1="17" x2="30" y2="17" stroke="#6840C0" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="18" y1="20" x2="26" y2="20" stroke="#6840C0" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ReportsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rep-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B75E5" />
          <stop offset="1" stopColor="#6035BA" />
        </linearGradient>
        <linearGradient id="rep-shine" x1="24" y1="4" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.3" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="7" width="40" height="40" rx="13" fill="#3D1F7A" opacity="0.15" />
      <rect x="4" y="4" width="40" height="40" rx="13" fill="url(#rep-bg)" />
      <rect x="4" y="4" width="40" height="20" rx="13" fill="url(#rep-shine)" />
      <rect x="13" y="28" width="5" height="8" rx="1.5" fill="white" fillOpacity="0.8" />
      <rect x="21.5" y="22" width="5" height="14" rx="1.5" fill="white" fillOpacity="0.9" />
      <rect x="30" y="16" width="5" height="20" rx="1.5" fill="white" fillOpacity="0.95" />
      <path d="M14 26l7-6 7 3 7-8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35" cy="15" r="2" fill="white" fillOpacity="0.95" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="set-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9580EA" />
          <stop offset="1" stopColor="#6338BE" />
        </linearGradient>
        <linearGradient id="set-shine" x1="24" y1="4" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.3" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="5" y="7" width="40" height="40" rx="13" fill="#3D1F7A" opacity="0.15" />
      <rect x="4" y="4" width="40" height="40" rx="13" fill="url(#set-bg)" />
      <rect x="4" y="4" width="40" height="20" rx="13" fill="url(#set-shine)" />
      <circle cx="24" cy="24" r="5" fill="none" stroke="white" strokeOpacity="0.95" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="2" fill="white" fillOpacity="0.9" />
      {/* Gear teeth */}
      <rect x="22.5" y="12" width="3" height="5" rx="1.5" fill="white" fillOpacity="0.9" />
      <rect x="22.5" y="31" width="3" height="5" rx="1.5" fill="white" fillOpacity="0.9" />
      <rect x="12" y="22.5" width="5" height="3" rx="1.5" fill="white" fillOpacity="0.9" />
      <rect x="31" y="22.5" width="5" height="3" rx="1.5" fill="white" fillOpacity="0.9" />
      <rect x="14.5" y="14.5" width="3" height="5" rx="1.5" fill="white" fillOpacity="0.9" transform="rotate(-45 16 17)" />
      <rect x="30.5" y="28.5" width="3" height="5" rx="1.5" fill="white" fillOpacity="0.9" transform="rotate(-45 32 31)" />
      <rect x="28.5" y="14.5" width="3" height="5" rx="1.5" fill="white" fillOpacity="0.9" transform="rotate(45 30 17)" />
      <rect x="14.5" y="28.5" width="3" height="5" rx="1.5" fill="white" fillOpacity="0.9" transform="rotate(45 16 31)" />
    </svg>
  );
}

export const moduleIcons = {
  dashboard: DashboardIcon,
  employees: EmployeesIcon,
  attendance: AttendanceIcon,
  leaves: LeavesIcon,
  payroll: PayrollIcon,
  requests: RequestsIcon,
  reports: ReportsIcon,
  settings: SettingsIcon,
} as const;

export type ModuleKey = keyof typeof moduleIcons;

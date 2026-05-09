"use client";

import { CalendarDays, LogOut, MessageSquareText, ClipboardList } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/conversation", label: "Diagnosis", icon: MessageSquareText },
  { href: "/reports", label: "Reports", icon: ClipboardList },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("account_type");
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-20 shrink-0 flex-col items-center justify-between rounded-xl bg-[#167980] py-5">
      <Link href="/" className="text-center text-sm font-bold leading-tight text-white">
        CLI
        <br />
        nical
      </Link>

      <nav className="flex flex-col items-center gap-2">
        {navItems.slice(0, 6).map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`rounded-lg p-3 transition ${
                isActive ? "bg-white text-[#167980]" : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        aria-label="Log out"
        title="Log out"
        className="rounded-lg p-3 text-white/85 transition hover:bg-white/10 hover:text-white cursor-pointer"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </aside>
  );
}

"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PatientBookingHeader() {
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
    <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
      <div>
        <p className="text-sm font-semibold text-gray-950">CLInical</p>
        <p className="text-xs text-gray-500">Patient appointment booking</p>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </header>
  );
}

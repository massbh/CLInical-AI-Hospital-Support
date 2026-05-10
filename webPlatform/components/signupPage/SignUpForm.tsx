"use client";

import { useState } from "react";
import { User, Mail, Lock } from "lucide-react";
import type { AccountType, SignUpFormData, SignUpFormProps } from "@/types";

export default function SignUpForm({ onSubmit, accountType: propAccountType, setAccountType: propSetAccountType }: SignUpFormProps) {
  const [localAccountType, setLocalAccountType] = useState<AccountType>("patient");
  
  const accountType = propAccountType ?? localAccountType;
  const setAccountType = propSetAccountType ?? setLocalAccountType;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data: SignUpFormData = {
      accountType,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      repeatPassword: String(formData.get("repeatPassword") ?? ""),
      agreedToTerms: formData.get("agreedToTerms") === "on",
    };

    onSubmit?.(data);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[400px] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-8 py-6">
        <h1 className="text-center text-2xl font-semibold text-gray-950">Create account</h1>
      </div>

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-[#167980]">Select your account type</p>
          <div className="grid w-full grid-cols-2 gap-2">

            <button
              type="button"
              onClick={() => setAccountType("patient")}
              className={`rounded-lg px-4 py-3 text-sm font-semibold transition
                ${accountType === "patient"
                  ? "bg-[#167980] text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
            >
              Patient
            </button>

            <button
              type="button"
              onClick={() => setAccountType("doctor")}
              className={`rounded-lg px-4 py-3 text-sm font-semibold transition
                ${accountType === "doctor"
                  ? "bg-[#167980] text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
            >
              Doctor
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 focus-within:border-[#167980] focus-within:ring-2 focus-within:ring-[#167980]/15">
            <User className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              name="name"
              type="text"
              placeholder="Name"
              required
              className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 focus-within:border-[#167980] focus-within:ring-2 focus-within:ring-[#167980]/15">
            <Mail className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              name="email"
              type="email"
              placeholder="Email"
              required
              className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 focus-within:border-[#167980] focus-within:ring-2 focus-within:ring-[#167980]/15">
            <Lock className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
              className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </label>

          <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 focus-within:border-[#167980] focus-within:ring-2 focus-within:ring-[#167980]/15">
            <Lock className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              name="repeatPassword"
              type="password"
              placeholder="Repeat password"
              required
              className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </label>
        </div>

        <label className="flex items-start gap-2">
          <input name="agreedToTerms" type="checkbox" required className="mt-0.5 h-4 w-4 cursor-pointer accent-[#167980]" />
          <span className="text-xs leading-5 text-gray-500">
            I agree with{" "}
            <span className="text-[#167980] underline">Terms</span>
            {" "}and{" "}
            <span className="text-[#167980] underline">Privacy Policy</span>
          </span>
        </label>

        <div className="flex justify-center">
          <button className="w-full rounded-lg bg-[#167980] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#12666c]">
            Create account
          </button>
        </div>

      </div>
    </form>
  );
}

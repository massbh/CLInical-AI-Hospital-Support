"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import SignUpForm from "@/components/signupPage/SignUpForm";
import type { SignUpFormData } from "@/types";

export default function SignUpPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
    const [accountType, setAccountType] = useState<"patient" | "doctor">("patient");
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const token = localStorage.getItem("auth_token");
        if (!token) return;

        fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((user) => {
                if (user) {
                    setRedirectTarget(
                        user.accountType === "doctor"
                            ? "/appointments"
                            : "/appointments/new"
                    );
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (redirectTarget) {
            router.push(redirectTarget);
        }
    }, [redirectTarget, router]);

    async function handleSignUp(data: SignUpFormData) {
        if (data.password !== data.repeatPassword) {
            setError("Passwords do not match");
            return;
        }

        if (!data.agreedToTerms) {
            setError("You must agree to the terms");
            return;
        }

        setError(null);

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.name,
                    email: data.email,
                    password: data.password,
                    accountType: data.accountType,
                }),
            });

            if (response.ok) {
                router.push("/login");
                return;
            }

            const result = await response.json();
            setError(result.error || "Something went wrong");

        } catch {
            setError("Network error");
        }
    }

    if (redirectTarget) {
        return null;
    }

    return (
        <main className="relative flex min-h-screen flex-col items-center justify-start gap-4 bg-[#F4F7F7] p-4 pt-14 overflow-hidden">
            {/* Patient Image - Appears on the left when patient is selected */}
            <div 
              className={`absolute left-0 bottom-0 top-0 w-1/3 transition-all duration-700 ease-in-out flex items-end justify-start pl-12 ${
                accountType === "patient" ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-full"
              }`}
            >
              <Image 
                src="/patient.svg" 
                alt="Patients illustration" 
                width={500} 
                height={500} 
                className="object-contain w-full h-auto max-w-[500px]"
                priority
              />
            </div>

            {/* Doctor Image - Appears on the right when doctor is selected */}
            <div 
              className={`absolute right-0 bottom-0 top-0 w-1/3 transition-all duration-700 ease-in-out flex items-end justify-end pr-12 ${
                accountType === "doctor" ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
              }`}
            >
              <Image 
                src="/doctorr.svg" 
                alt="Doctor illustration" 
                width={500} 
                height={500} 
                className="object-contain w-full h-auto max-w-[400px] -scale-x-100"
                priority
              />
            </div>

            <div className="z-10 flex flex-col items-center gap-4 w-full">
                <p className="text-sm font-semibold text-[#167980]">
                    Already have an account?{" "}
                    <Link href="/login" className="font-bold underline">
                        Log in
                    </Link>
                </p>

                {error && (
                    <p className="w-full max-w-[400px] rounded-lg bg-red-50 px-4 py-2 text-center text-sm text-red-600">
                        {error}
                    </p>
                )}

                <SignUpForm onSubmit={handleSignUp} accountType={accountType} setAccountType={setAccountType} />
            </div>
        </main>
    );
}

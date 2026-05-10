"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SignUpForm from "@/components/signupPage/SignUpForm";
import type { SignUpFormData } from "@/types";

export default function SignUpPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
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
        <main className="flex min-h-screen flex-col items-center justify-start gap-4 bg-[#F4F7F7] p-4 pt-14">
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

            <SignUpForm onSubmit={handleSignUp} />
        </main>
    );
}

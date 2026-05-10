"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NoteCard from "../../components/conversationScreen/NoteCard";
import SuggestionCard from "../../components/conversationScreen/SuggestionCard";
import StreamStatus from "../../components/conversationScreen/StreamStatus";
import Sidebar from "../../components/appointmentPage/Sidebar";
import type { Note, Suggestion } from "@/types";
import { getAuthHeaders } from "@/lib/client-auth";

const DISPLAY_LIMIT = 10;
const POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 3000);

type CurrentAppointment = {
    id: string;
    patient_id: string;
    date: string;
    time: string;
    patient_name: string;
    patient_surname: string;
    doctor_name: string;
};

export default function ConversationPage() {
    const router = useRouter();
    const [notes, setNotes] = useState<Note[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [appointmentId, setAppointmentId] = useState<string | null>(null);
    const [appointment, setAppointment] = useState<CurrentAppointment | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isAppointmentActive, setIsAppointmentActive] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [toggleError, setToggleError] = useState<string | null>(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [isCreatingReport, setIsCreatingReport] = useState(false);
    const [createReportError, setCreateReportError] = useState<string | null>(null);

    const appointmentIdRef = useRef<string | null>(null);
    const isAppointmentActiveRef = useRef(false);

    useEffect(() => {
        async function loadCurrentAppointment() {
            try {
                const response = await fetch("/api/appointments/current", {
                    headers: getAuthHeaders(),
                });
                if (!response.ok) {
                    const data = await response.json();
                    setError(data.error || "Could not find current appointment");
                    return;
                }
                const appointmentData: CurrentAppointment = await response.json();
                setError(null);
                setAppointment(appointmentData);

                if (appointmentData.id !== appointmentIdRef.current) {
                    appointmentIdRef.current = appointmentData.id;
                    setAppointmentId(appointmentData.id);
                    setNotes([]);
                    setSuggestions([]);
                    setIsAppointmentActive(false);
                    isAppointmentActiveRef.current = false;
                    setHasStarted(false);
                    setCreateReportError(null);
                }
            } catch {
                setError("Failed to connect to server");
            }
        }

        loadCurrentAppointment();
        const interval = setInterval(loadCurrentAppointment, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    // No auto-stop on unmount: page refreshes used to fire this and kill the
    // backend session. The doctor ends the appointment explicitly via the
    // button instead.

    useEffect(() => {
        if (!appointmentId || !isAppointmentActive) return;

        async function fetchData() {
            try {
                const [notesResponse, suggestionsResponse] = await Promise.all([
                    fetch(`/api/notes?appointmentId=${appointmentId}`, { headers: getAuthHeaders() }),
                    fetch(`/api/suggestions?appointmentId=${appointmentId}`, { headers: getAuthHeaders() }),
                ]);

                if (notesResponse.ok) {
                    const notesData = await notesResponse.json();
                    setNotes(
                        notesData.map((n: Note) => ({
                            ...n,
                            timestamp: new Date(n.timestamp),
                        }))
                    );
                }

                if (suggestionsResponse.ok) {
                    const suggestionsData = await suggestionsResponse.json();
                    setSuggestions(
                        suggestionsData.map((s: Suggestion) => ({
                            ...s,
                            timestamp: new Date(s.timestamp),
                        }))
                    );
                }

                setLastUpdate(new Date());
            } catch (err) {
                console.error("Polling error:", err);
            }
        }

        fetchData();
        const interval = setInterval(fetchData, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [appointmentId, isAppointmentActive]);

    async function handleToggleAppointment() {
        if (!appointmentId || isToggling) return;
        const action = isAppointmentActive ? "stop" : "start";
        setIsToggling(true);
        setToggleError(null);
        try {
            const response = await fetch(
                `/api/appointments/${appointmentId}/${action}`,
                { method: "POST", headers: getAuthHeaders() }
            );
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                setToggleError(
                    data.error || `Failed to ${action} appointment`
                );
                return;
            }
            const next = !isAppointmentActive;
            setIsAppointmentActive(next);
            isAppointmentActiveRef.current = next;
            if (next) setHasStarted(true);
        } catch {
            setToggleError(`Failed to ${action} appointment`);
        } finally {
            setIsToggling(false);
        }
    }

    async function handleCreateReport() {
        if (!appointmentId || !appointment || isCreatingReport) return;
        setIsCreatingReport(true);
        setCreateReportError(null);
        try {
            const response = await fetch(
                `/api/reports/create-from-appointment/${appointmentId}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                    body: JSON.stringify({
                        patient_name: appointment.patient_name,
                        patient_surname: appointment.patient_surname,
                        doctor_name: appointment.doctor_name,
                        title: `Consultation – ${appointment.patient_name} ${appointment.patient_surname}`,
                    }),
                }
            );
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                setCreateReportError(data.error || "Failed to create report");
                return;
            }
            router.push(`/reports/${data.report_id}`);
        } catch {
            setCreateReportError("Failed to create report");
        } finally {
            setIsCreatingReport(false);
        }
    }

    if (error) {
        return (
            <div className="flex h-screen size-full overflow-hidden bg-[#F4F7F7] p-4">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-gray-950">No Active Appointment</h2>
                        <p className="mt-2 text-sm text-gray-500">{error}</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
    <div className="flex h-screen size-full overflow-hidden bg-[#F4F7F7] p-4">
        <Sidebar />

        <main className="flex-1 overflow-auto px-6 py-3">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 className="text-2xl font-semibold text-gray-950">Diagnosis Support</h1>
                <p className="mt-1 text-sm text-gray-500">Triage notes and AI suggestions for active patient review.</p>
            </div>
            <div className="flex items-center gap-3">
                <StreamStatus isConnected={isAppointmentActive} lastUpdate={lastUpdate} />
                <button
                    type="button"
                    onClick={handleToggleAppointment}
                    disabled={!appointmentId || isToggling}
                    className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        isAppointmentActive
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-[#2CA6AE] hover:bg-[#167980]"
                    }`}
                >
                    {isToggling
                        ? isAppointmentActive
                            ? "Stopping..."
                            : "Starting..."
                        : isAppointmentActive
                            ? "End appointment"
                            : "Start appointment"}
                </button>
                {hasStarted && !isAppointmentActive && appointmentId && (
                    <button
                        type="button"
                        onClick={handleCreateReport}
                        disabled={isCreatingReport}
                        className="rounded-lg border border-[#2CA6AE] px-4 py-2 text-sm font-medium text-[#167980] shadow-sm transition-colors hover:bg-[#E6F5F6] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isCreatingReport ? "Creating report..." : "Create report"}
                    </button>
                )}
            </div>
        </div>
        {createReportError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {createReportError}
            </div>
        )}

        {toggleError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {toggleError}
            </div>
        )}

        {!isAppointmentActive && (
            <div className="mb-5 rounded-lg border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                Press <span className="font-medium text-gray-700">Start appointment</span> to begin streaming notes and suggestions for this patient.
            </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-950">Notes</h2>
                <span className="text-sm text-muted-foreground">
                {notes.length} total
                </span>
            </div>
            <div className="space-y-3">
                {notes.slice(0, DISPLAY_LIMIT).map((note) => (
                <NoteCard key={note.id} {...note} />
                ))}
            </div>
            </section>

            <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-950">Suggestions</h2>
                <span className="text-sm text-muted-foreground">
                {suggestions.length} total
                </span>
            </div>
            <div className="space-y-3">
                {suggestions.slice(0, DISPLAY_LIMIT).map((suggestion) => (
                    <SuggestionCard key={suggestion.id} {...suggestion} />
                ))}
            </div>
            </section>
        </div>
        </main>
    </div>
    );
}

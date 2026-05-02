"use client";

import { useState, useEffect, useRef } from "react";
import  NoteCard  from "../../components/conversationScreen/NoteCard";
import SuggestionCard  from "../../components/conversationScreen/SuggestionCard";
import  StreamStatus  from "../../components/conversationScreen/StreamStatus";
import Sidebar from "../../components/appointmentPage/Sidebar"
import type { Note, Suggestion } from "@/types";

const DISPLAY_LIMIT = 10;
const POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 3000);

export default function ConversationPage() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [appointmentId, setAppointmentId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isAppointmentActive, setIsAppointmentActive] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [toggleError, setToggleError] = useState<string | null>(null);

     // reference to track the current appointment ID without re-triggering the polling effect
    const appointmentIdRef = useRef<string | null>(null);
    const isAppointmentActiveRef = useRef(false);

    // find current appointment for logged in user via poll
    useEffect(() => {
        async function loadCurrentAppointment() {
        try {
            const response = await fetch("/api/appointments/current");
            if (!response.ok) {
                const data = await response.json();
                setError(data.error || "Could not find current appointment");
                return;
            }
            const appointment = await response.json();
            setError(null);

            // if the appointment changed, clear the old notes/suggestions
            if (appointment.id !== appointmentIdRef.current) {
                appointmentIdRef.current = appointment.id;
                setAppointmentId(appointment.id);
                setNotes([]);
                setSuggestions([]);
                setIsAppointmentActive(false);
                isAppointmentActiveRef.current = false;
            }


        } catch {
            setError("Failed to connect to server");
        }
        }
        // check immediately, then every POLL_INTERVAL
        loadCurrentAppointment();
        const interval = setInterval(loadCurrentAppointment, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    // stop the streaming session if the page unmounts while it's running
    useEffect(() => {
        return () => {
            if (!isAppointmentActiveRef.current) return;
            const id = appointmentIdRef.current;
            if (!id) return;
            fetch(`/api/appointments/${id}/stop`, {
                method: "POST",
                keepalive: true,
            }).catch(() => {});
        };
    }, []);

    // poll notes and suggestions only while the appointment is active
    useEffect(() => {
        if (!appointmentId || !isAppointmentActive) return;

        async function fetchData() {
        try {
            const [notesResponse, suggestionsResponse] = await Promise.all([
            fetch(`/api/notes?appointmentId=${appointmentId}`),
            fetch(`/api/suggestions?appointmentId=${appointmentId}`),
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
                { method: "POST" }
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
        } catch {
            setToggleError(`Failed to ${action} appointment`);
        } finally {
            setIsToggling(false);
        }
    }

    // show error/no-appointment state
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
            </div>
        </div>

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

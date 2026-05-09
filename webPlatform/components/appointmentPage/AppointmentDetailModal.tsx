"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/client-auth";

type AppointmentDetails = {
  id: string;
  date: string;
  time: string;
  patientName: string;
  patientEmail: string;
  doctorName: string;
};

type AppointmentHistory = {
  date: string;
  time: string;
  doctorName: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string | null;
};

export default function AppointmentDetailModal({
  isOpen,
  onClose,
  appointmentId,
}: Props) {
  const [details, setDetails] = useState<AppointmentDetails | null>(null);
  const [history, setHistory] = useState<AppointmentHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!appointmentId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/details`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      setDetails(data.appointment);
      setHistory(data.history || []);
    } catch (error) {
      console.error("Failed to fetch appointment details:", error);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    if (isOpen && appointmentId) {
      fetchDetails();
    }
  }, [isOpen, appointmentId, fetchDetails]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="mb-6 text-xl font-bold text-[#2CA6AE]">
          Appointment Details
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2CA6AE] border-t-transparent"></div>
          </div>
        ) : details ? (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#F4F7F7] p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Current Appointment
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date</span>
                  <span className="font-medium">{formatDate(details.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time</span>
                  <span className="font-medium">{details.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Doctor</span>
                  <span className="font-medium">{details.doctorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Patient</span>
                  <span className="font-medium">{details.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email</span>
                  <span className="font-medium text-sm">{details.patientEmail}</span>
                </div>
              </div>
            </div>

            {history.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                  Previous Appointments
                </h3>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {history.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">
                          {formatDate(item.date)}
                        </span>
                        <span className="text-sm text-gray-500">{item.time}</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {item.doctorName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {history.length === 0 && (
              <div className="rounded-lg border border-gray-100 p-4 text-center text-gray-500">
                No previous appointments found for this patient.
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            Unable to load appointment details.
          </div>
        )}
      </div>
    </div>
  );
}
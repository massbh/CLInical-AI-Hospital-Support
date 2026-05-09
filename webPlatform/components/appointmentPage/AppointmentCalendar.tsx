"use client";

import { useState, useMemo, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { getAuthHeaders } from "@/lib/client-auth";

const APPOINTMENT_DISPLAY_LIMIT = 12;

const COLORS = ["bg-[#2CA6AE]", "bg-green-400", "bg-yellow-400", "bg-pink-400", "bg-gray-400"];

type CalendarAppointment = { time: string; title: string; color: string };

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AppointmentCalendar() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const [appointments, setAppointments] = useState<Record<string, CalendarAppointment[]>>({});

  useEffect(() => {
    async function loadAppointments() {
      try {
        const response = await fetch("/api/appointments/calendar", {
          headers: getAuthHeaders(),
        });
        const rows: { date: string; time: string; patientName: string }[] = await response.json();

        const grouped: Record<string, CalendarAppointment[]> = {};
        rows.forEach((row, index) => {
          if (!grouped[row.date]) {
            grouped[row.date] = [];
          }

          grouped[row.date].push({
            time: row.time,
            title: `Appointment with ${row.patientName}`,
            color: COLORS[index % COLORS.length],
          });
        });
        setAppointments(grouped);
      } catch (error) {
        console.error("Failed to load appointments:", error);
      }
    }
    loadAppointments();
  }, []);

  const calendarModifiers = useMemo(() => ({ today }), [today]);
  const calendarModifiersStyles = useMemo(
    () => ({
      today: {
        fontWeight: "900",
        color: "#2CA6AE",
      },
    }),
    []
  );

  const selectedKey = formatDate(selectedDate);
  const dayAppointments = appointments[selectedKey] || [];

  const dateLabel = selectedDate.toLocaleDateString("en-GB", {
    month: "long",
    day: "numeric",
  }).toUpperCase();

  return (
    <div className="flex gap-4 h-full w-full overflow-hidden">

      <div className="flex flex-col w-[40%] shrink-0 overflow-y-auto pr-2">
        <h3 className="text-[#2CA6AE] font-bold text-base tracking-widest mb-6">
          {dateLabel}
        </h3>

        {dayAppointments.length === 0 ? (
          <p className="text-gray-400 text-base">No appointments for this day.</p>
        ) : (
          <div className="flex flex-col">
            {dayAppointments.slice(0, APPOINTMENT_DISPLAY_LIMIT).map((appointment, index) => (
              <div
                key={index}
                className="flex items-center gap-3 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 rounded-lg px-2 transition-colors group"
              >
                <span className="text-[#2CA6AE] text-base font-medium w-20 shrink-0">
                  {appointment.time}
                </span>
                <span className={`h-3 w-3 rounded-full shrink-0 ${appointment.color}`} />
                <span className="text-gray-800 text-base group-hover:font-medium transition-all">
                  {appointment.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-1.5 bg-[#2CA6AE] self-stretch mx-4 shrink-0 rounded-full" />

      <div className="bg-[#2CA6AE] rounded-3xl p-4 flex-1 overflow-hidden flex items-center justify-center">
        <div className="bg-white rounded-2xl p-4 w-full h-full overflow-hidden [&_button[data-day]]:aspect-auto [&_button[data-day]]:w-16 [&_button[data-day]]:mx-auto [&_button[data-day]]:py-2.5">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            classNames={{
              root: "w-full",
              month: "flex w-full flex-col gap-3",
              month_caption: "flex h-8 w-full items-center justify-center px-(--cell-size)",
              day: "group/day relative h-10 mt-4 w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius) [&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
              week: "flex w-full mt-0",
              today: "font-semibold [&_button]:bg-[#E8F3F4] [&_button]:rounded-lg",
            }}
            modifiers={calendarModifiers}
            modifiersStyles={calendarModifiersStyles}
          />
        </div>
      </div>

    </div>
  );
}

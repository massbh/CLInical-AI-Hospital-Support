"use client";
import { useState, useEffect, useCallback } from "react";
import BookingDoctor from "./BookingDoctor";
import BookingDateTime from "./BookingDateTime";
import BookingForm from "./BookingForm";
import type { Doctor, DoctorSchedule, BookedAppointment } from "@/types";
import { getAuthHeaders } from "@/lib/client-auth";

export default function BookingLayout() {

    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
    const [calendarView, setCalendarView] = useState<"month" | "week">("month");


    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [doctorSchedules, setDoctorSchedules] = useState<DoctorSchedule[]>([]);  
    const [bookedAppointments, setBookedAppointments] = useState<BookedAppointment[]>([]);  

    const loadBookedAppointments = useCallback(async () => {
        const appointmentsResponse = await fetch("/api/appointments", {
            headers: getAuthHeaders(),
            cache: "no-store",
        });
        const appointmentsData: BookedAppointment[] = await appointmentsResponse.json();
        setBookedAppointments(appointmentsData);
    }, []);

    // fetch doctors, schedules, and booked appointments
    useEffect(() => {
        async function loadData() {
            try {
                // fetch all doctors
                const doctorsResponse = await fetch("/api/doctors");
                const doctorsData: Doctor[] = await doctorsResponse.json();
                setDoctors(doctorsData);

                // fetch each doctors schedule
                const schedulePromisses = doctorsData.map((doctor) =>
                     fetch(`/api/doctors/${doctor.id}/schedule`).then((response) => response.json())
                );
                const scheduleArrays = await Promise.all(schedulePromisses);
                setDoctorSchedules(scheduleArrays.flat());

                await loadBookedAppointments();
            } catch (error) {
                console.error("Failed to load booking data:", error);  
            }
        }
        loadData();  
    }, [loadBookedAppointments]);





    return (
    <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_380px] gap-4 p-4">
        <section className="min-w-0 rounded-xl border border-gray-100 bg-white shadow-sm">
            <BookingDoctor
                selectedDoctor={selectedDoctor}
                doctors={doctors}
                onSelectDoctor={setSelectedDoctor}
                onSelectTime={setSelectedTime}
            />
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <BookingDateTime
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                selectedDoctor={selectedDoctor}
                calendarView={calendarView}
                onSelectDate={setSelectedDate}
                onSelectTime={setSelectedTime}
                onSelectCalendarView={setCalendarView}
                doctorSchedules={doctorSchedules}
                bookedAppointments={bookedAppointments}
            />
        </section>

        <section className="min-w-0 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <BookingForm
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                selectedDoctor={selectedDoctor}
                doctors={doctors}
                onBookingCreated={(appointment) => {
                    setBookedAppointments((current) => [
                        ...current.filter(
                            (item) =>
                                !(
                                    item.doctorId === appointment.doctorId &&
                                    item.date === appointment.date &&
                                    item.time === appointment.time
                                )
                        ),
                        appointment,
                    ]);
                    setSelectedTime(null);
                    void loadBookedAppointments();
                }}
            />
        </section>
    </div>
);
}

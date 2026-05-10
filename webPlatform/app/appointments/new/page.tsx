import BookingLayout from "@/components/appointmentBooking/BookingLayout";
import PatientBookingHeader from "@/components/appointmentBooking/PatientBookingHeader";

export default function NewAppointmentPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#F4F7F7] p-4">
            <main className="flex h-[95vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-xl bg-white">
                <PatientBookingHeader />
                <BookingLayout />
            </main>
        </div>
    );
}

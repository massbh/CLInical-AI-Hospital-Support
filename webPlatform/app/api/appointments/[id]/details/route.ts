import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireDoctor(_request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "appointment id is required" },
      { status: 400 }
    );
  }

  try {
    const appointmentResult = await procedures.appointmentGetById(id);

    if (appointmentResult.length === 0) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const appointment = appointmentResult[0];
    const patientId = appointment.patient_id;

    const allAppointments = await procedures.appointmentGetAll();
    const patientAppointments = allAppointments
        .filter(apt => apt.doctor_id)
        .filter(apt => {
            const dateStr = apt.date instanceof Date ? apt.date.toISOString().split('T')[0] : apt.date;
            const apptDateStr = appointment.date instanceof Date ? appointment.date.toISOString().split('T')[0] : appointment.date;
            
            if (dateStr < apptDateStr) return true;
            if (dateStr === apptDateStr && apt.time < appointment.time) return true;
            return false;
        })
        .sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date.toISOString() : a.date;
            const dateB = b.date instanceof Date ? b.date.toISOString() : b.date;
            if (dateA > dateB) return -1;
            if (dateA < dateB) return 1;
            if (a.time > b.time) return -1;
            if (a.time < b.time) return 1;
            return 0;
        });

    const history = await Promise.all(
        patientAppointments.slice(0, 10).map(async (apt) => {
            const doctorResult = await procedures.appointmentGetDoctorByAccountId(apt.doctor_id);
            const doctorName = doctorResult.length > 0 ? doctorResult[0].name : "Unknown";
            return {
                date: apt.date instanceof Date ? apt.date.toISOString().split('T')[0] : apt.date,
                time: apt.time,
                doctorName: doctorName
            };
        })
    );

    return NextResponse.json({
      appointment: {
        id: appointment.id,
        date: appointment.date instanceof Date ? appointment.date.toISOString().split('T')[0] : appointment.date,
        time: appointment.time,
        patientName: appointment.patient_name,
        patientEmail: appointment.patient_email,
        doctorName: appointment.doctor_name,
      },
      history: history,
    });
  } catch (error) {
    console.error("Error fetching appointment details:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
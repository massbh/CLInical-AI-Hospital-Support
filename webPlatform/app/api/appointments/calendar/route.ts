import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireDoctor } from "@/lib/db-auth";  
  
// return booked appointments with patient names for the logged-in doctor's calendar view  
export async function GET(_request: NextRequest) {
    const authResult = await requireDoctor(_request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult; 


  
   try {  
         // find the doctor linked to this account
         const doctorResult = await pool.query(
             `SELECT id FROM doctors WHERE account_id = $1`,
             [user.id]
         );
  
        if (doctorResult.rows.length === 0) {  
            return NextResponse.json({ error: "No doctor profile found for this account" }, { status: 404 });  
        }  
  
        const doctorId = doctorResult.rows[0].id;  
  
        // fetch only this doctor's appointments  
        const result = await pool.query(  
            `SELECT  
                ba.date::text,  
                ba.time,  
                a.name AS "patientName"  
             FROM booked_appointments ba  
             JOIN accounts a ON a.id = ba.patient_id  
             WHERE ba.doctor_id = $1  
             ORDER BY ba.date, ba.time DESC`,  
            [doctorId]  
        );  
  
        return NextResponse.json(result.rows);  
    } catch (error) {  
        console.error("Error fetching calendar appointments:", error);  
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
    }  
}
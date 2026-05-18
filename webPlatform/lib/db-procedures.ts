import pool from "./db";

export type AccountType = "patient" | "doctor" | "nurse";
export type SectionStatus = "pending" | "accepted";
export type SuggestionPriority = "low" | "medium" | "high";

interface AuthUserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  account_type: AccountType;
}

interface AuthUserByIdRow {
  id: string;
  name: string;
  account_type: AccountType;
}

interface AppointmentRow {
  doctor_id: string;
  date: Date;
  time: string;
}

interface AppointmentDetailRow {
  id: string;
  date: Date;
  time: string;
  patient_id: string;
  patient_name: string;
  patient_email: string;
  doctor_name: string;
}

interface DoctorRow {
  id: string;
  name: string;
}

interface DoctorScheduleRow {
  doctor_id: string;
  working_days: number[];
  work_hours: string[];
}

interface CalendarAppointmentRow {
  id: string;
  date: Date;
  time: string;
  patient_name: string;
}

interface CurrentAppointmentRow {
  id: string;
  patient_id: string;
  date: Date;
  time: string;
  patient_name: string;
  patient_surname: string;
  doctor_name: string;
}

interface BookedAppointmentRow {
  id: string;
  doctor_id: string;
  date: Date;
  time: string;
}

interface ReportRow {
  id: string;
  patient_name: string;
  patient_surname: string;
  date: Date;
  title: string;
  content: string | null;
  finalized: boolean;
}

interface ReportMetaRow {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_name: string;
  date: Date;
}

interface ReportExistsRow {
  exists: boolean;
}

interface AppointmentDetailsRow {
  patient_id: string;
  doctor_account_id: string;
}

interface NoteRow {
  id: string;
  content: string;
  source: string | null;
  timestamp: Date;
}

interface CreatedNoteRow {
  id: string;
  content: string;
  source: string | null;
  timestamp: Date;
}

interface SuggestionRow {
  id: string;
  content: string;
  priority: string;
  title: string;
  source: string | null;
  timestamp: Date;
}

interface CreatedSuggestionRow {
  id: string;
  content: string;
  priority: string;
  title: string;
  timestamp: Date;
}

interface ReportSectionRow {
  id: string;
  title: string;
  status: SectionStatus;
}

interface ReportSectionDetailRow {
  id: string;
  title: string;
  status: SectionStatus;
  content: string | null;
}

interface ReportSectionUpdateRow {
  id: string;
  title: string;
  status: SectionStatus;
}

interface TimeSlotRow {
  time_slot: string;
}

export const procedures = {
  async authGetUserByEmail(email: string): Promise<AuthUserRow[]> {
    const result = await pool.query(
      "SELECT * FROM authGetUserByEmail($1)",
      [email]
    );
    return result.rows;
  },

  async authGetUserById(id: string): Promise<AuthUserByIdRow[]> {
    const result = await pool.query(
      "SELECT * FROM authGetUserById($1)",
      [id]
    );
    return result.rows;
  },

  async authCreateAccount(
    name: string,
    email: string,
    passwordHash: string,
    accountType: AccountType
  ): Promise<{ id: string }[]> {
    const result = await pool.query(
      "SELECT * FROM authCreateAccount($1, $2, $3, $4)",
      [name, email, passwordHash, accountType]
    );
    return result.rows;
  },

  async authCreateDoctor(name: string, accountId: string): Promise<void> {
    await pool.query(
      "SELECT authCreateDoctor($1, $2)",
      [name, accountId]
    );
  },

  async appointmentGetAll(doctorId?: string): Promise<AppointmentRow[]> {
    const result = await pool.query(
      "SELECT * FROM appointmentGetAll($1)",
      [doctorId || null]
    );
    return result.rows;
  },

  async appointmentGetById(id: string): Promise<AppointmentDetailRow[]> {
    const result = await pool.query(
      "SELECT * FROM appointmentGetById($1)",
      [id]
    );
    return result.rows;
  },

  async appointmentGetDoctorByAccountId(accountId: string): Promise<DoctorRow[]> {
    const result = await pool.query(
      "SELECT * FROM appointmentGetDoctorByAccountId($1)",
      [accountId]
    );
    return result.rows;
  },

  async appointmentGetCalendarForDoctor(doctorId: string): Promise<CalendarAppointmentRow[]> {
    const result = await pool.query(
      "SELECT * FROM appointmentGetCalendarForDoctor($1)",
      [doctorId]
    );
    return result.rows;
  },

  async appointmentGetCurrent(doctorId: string): Promise<CurrentAppointmentRow[]> {
    const result = await pool.query(
      "SELECT * FROM appointmentGetCurrent($1)",
      [doctorId]
    );
    return result.rows;
  },

  async appointmentBook(
    doctorId: string,
    patientId: string,
    date: string,
    time: string
  ): Promise<BookedAppointmentRow[]> {
    const result = await pool.query(
      "SELECT * FROM appointmentBook($1, $2, $3, $4)",
      [doctorId, patientId, date, time]
    );
    return result.rows;
  },

  async appointmentFindAvailable(date: string, time: string): Promise<{ id: string }[]> {
    const result = await pool.query(
      "SELECT * FROM appointmentFindAvailable($1, $2)",
      [date, time]
    );
    return result.rows;
  },

  async doctorGetAll(): Promise<DoctorRow[]> {
    const result = await pool.query("SELECT * FROM doctorGetAll()");
    return result.rows;
  },

  async doctorGetSchedule(doctorId: string): Promise<DoctorScheduleRow[]> {
    const result = await pool.query(
      "SELECT * FROM doctorGetSchedule($1)",
      [doctorId]
    );
    return result.rows;
  },

  async reportGetAll(): Promise<ReportRow[]> {
    const result = await pool.query("SELECT * FROM reportGetAll()");
    return result.rows;
  },

  async reportGetMeta(id: string): Promise<ReportMetaRow[]> {
    const result = await pool.query(
      "SELECT * FROM reportGetMeta($1)",
      [id]
    );
    return result.rows;
  },

  async reportCheckExists(id: string): Promise<ReportExistsRow[]> {
    const result = await pool.query(
      "SELECT * FROM reportCheckExists($1)",
      [id]
    );
    return result.rows;
  },

  async reportGetAppointmentDetails(appointmentId: string): Promise<AppointmentDetailsRow[]> {
    const result = await pool.query(
      "SELECT * FROM reportGetAppointmentDetails($1)",
      [appointmentId]
    );
    return result.rows;
  },

  async reportGetNotesByAppointment(appointmentId: string): Promise<NoteRow[]> {
    const result = await pool.query(
      "SELECT * FROM reportGetNotesByAppointment($1)",
      [appointmentId]
    );
    return result.rows;
  },

  async reportGetSuggestionsByAppointment(appointmentId: string): Promise<{ id: string; content: string }[]> {
    const result = await pool.query(
      "SELECT * FROM reportGetSuggestionsByAppointment($1)",
      [appointmentId]
    );
    return result.rows;
  },

  async reportCreate(
    patientId: string,
    doctorId: string,
    patientName: string,
    patientSurname: string,
    doctorName: string,
    title: string
  ): Promise<{ id: string }[]> {
    const result = await pool.query(
      "SELECT * FROM reportCreate($1, $2, $3, $4, $5, $6)",
      [patientId, doctorId, patientName, patientSurname, doctorName, title]
    );
    return result.rows;
  },

  async reportSectionUpsert(
    reportId: string,
    title: string,
    content: string,
    status: SectionStatus
  ): Promise<void> {
    await pool.query(
      "SELECT reportSectionUpsert($1, $2, $3, $4)",
      [reportId, title, content, status]
    );
  },

  async reportSectionGetAll(reportId: string): Promise<ReportSectionRow[]> {
    const result = await pool.query(
      "SELECT * FROM reportSectionGetAll($1)",
      [reportId]
    );
    return result.rows;
  },

  async reportSectionGetById(sectionId: string, reportId: string): Promise<ReportSectionDetailRow[]> {
    const result = await pool.query(
      "SELECT * FROM reportSectionGetById($1, $2)",
      [sectionId, reportId]
    );
    return result.rows;
  },

  async reportSectionUpdate(
    sectionId: string,
    reportId: string,
    status?: SectionStatus,
    content?: string
  ): Promise<ReportSectionUpdateRow[]> {
    const result = await pool.query(
      "SELECT * FROM reportSectionUpdate($1, $2, $3, $4)",
      [sectionId, reportId, status || null, content || null]
    );
    return result.rows;
  },

  async reportFinalize(id: string): Promise<void> {
    await pool.query("SELECT reportFinalize($1)", [id]);
  },

  async reportRevertFinalize(id: string): Promise<void> {
    await pool.query("SELECT reportRevertFinalize($1)", [id]);
  },

  async noteGetByAppointment(appointmentId: string): Promise<NoteRow[]> {
    const result = await pool.query(
      "SELECT * FROM noteGetByAppointment($1)",
      [appointmentId]
    );
    return result.rows;
  },

  async noteCreate(
    content: string,
    source: string | null,
    appointmentId: string
  ): Promise<CreatedNoteRow[]> {
    const result = await pool.query(
      "SELECT * FROM noteCreate($1, $2, $3)",
      [content, source, appointmentId]
    );
    return result.rows;
  },

  async suggestionGetByAppointment(appointmentId: string): Promise<SuggestionRow[]> {
    const result = await pool.query(
      "SELECT * FROM suggestionGetByAppointment($1)",
      [appointmentId]
    );
    return result.rows;
  },

  async suggestionCreate(
    title: string,
    description: string,
    priority: string,
    appointmentId: string
  ): Promise<CreatedSuggestionRow[]> {
    const result = await pool.query(
      "SELECT * FROM suggestionCreate($1, $2, $3, $4)",
      [title, description, priority, appointmentId]
    );
    return result.rows;
  },

  async getAvailableTimeSlots(doctorId: string, date: string): Promise<TimeSlotRow[]> {
    const result = await pool.query(
      "SELECT * FROM getAvailableTimeSlots($1, $2)",
      [doctorId, date]
    );
    return result.rows;
  },
};
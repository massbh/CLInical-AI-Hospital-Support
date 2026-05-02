// ─── Conversation / Diagnosis Support ────────────────────────────────────────

export interface Note {
  id: string;
  content: string;
  source: string;
  timestamp: Date;
  isNew?: boolean;
}

export interface Suggestion {
  id: string;
  content: string;
  source: string;
  timestamp: Date;
  isNew?: boolean;
}

export interface NoteCardProps {
  id: string;
  content: string;
  timestamp: Date;
  isNew?: boolean;
}

export interface SuggestionCardProps {
  id: string;
  content: string;
  timestamp: Date;
  isNew?: boolean;
}

export interface StreamStatusProps {
  isConnected: boolean;
  lastUpdate?: Date;
}

// ─── Appointment Booking ──────────────────────────────────────────────────────

export type DoctorId = string;

export type Doctor = {
  id: DoctorId;
  name: string;
};

export type DoctorSchedule = {
  doctorId: DoctorId;
  workingDays: number[]; // 0 = Sunday, 1 = Monday, and so on
  workHours: string[];
};

export type BookedAppointment = {
  doctorId: DoctorId;
  date: string; // e.g. "2026-04-08"
  time: string; // e.g. "10:00 am"
};

export type CalendarView = "month" | "week";

export type BookingDateTimeProps = {
  selectedDate: Date | undefined;
  selectedTime: string | null;
  selectedDoctor: string;
  calendarView: CalendarView;
  onSelectDate: (date: Date | undefined) => void;
  onSelectTime: (time: string | null) => void;
  onSelectCalendarView: (view: CalendarView) => void;
  doctorSchedules: DoctorSchedule[];
  bookedAppointments: BookedAppointment[];
};

export type BookingDoctorProps = {
  doctors: Doctor[];
  selectedDoctor: string;
  onSelectDoctor: (doctor: string) => void;
  onSelectTime: (time: string | null) => void;
};

export type BookingFormProps = {
  selectedDate: Date | undefined;
  selectedTime: string | null;
  selectedDoctor: string;
  doctors: Doctor[];
};

export type TimeSlotButtonProps = {
  day: Date;
  time: string;
  dateKey: string;
  selectedDate: Date | undefined;
  selectedTime: string | null;
  isBooked: boolean;
  onSelectDate: (date: Date | undefined) => void;
  onSelectTime: (time: string | null) => void;
};

export type WeekDayColumnProps = {
  day: Date;
  selectedDate: Date | undefined;
  selectedTime: string | null;
  selectedDoctor: string;
  onSelectDate: (date: Date | undefined) => void;
  onSelectTime: (time: string | null) => void;
  doctorSchedules: DoctorSchedule[];
  bookedAppointments: BookedAppointment[];
};

export type WeeklyCalendarProps = {
  selectedDate: Date | undefined;
  selectedTime: string | null;
  selectedDoctor: string;
  onSelectDate: (date: Date | undefined) => void;
  onSelectTime: (time: string | null) => void;
  onBackToMonthView: () => void;
  doctorSchedules: DoctorSchedule[];
  bookedAppointments: BookedAppointment[];
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export type ReportListItem = {
  id: string;
  patientName: string;
  patientSurname: string;
  date: string;
  title: string;
  content: string;
};

export type ReportRowProps = {
  report: ReportListItem;
};

export type SectionStatus = "pending" | "accepted";

// GET /api/reports/:id
export type ReportMeta = {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  date: string;
};

// GET /api/reports/:id/sections  — list payload, no content
export type ReportSectionSummary = {
  id: string;
  title: string;
  status: SectionStatus;
};

// GET /api/reports/:id/sections/:sectionId  — detail payload, includes content
export type ReportSection = ReportSectionSummary & {
  content: string;
};

export type SectionEditorProps = {
  section: ReportSectionSummary;
  content: string | null;
  onAccept: (id: string, content: string) => void;
  onEdit: (id: string) => void;
  isEditing: boolean;
};

export type SectionNavProps = {
  meta: ReportMeta;
  sections: ReportSectionSummary[];
  activeSectionId: string;
  onSelectSection: (id: string) => void;
};

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export type AccountType = "patient" | "doctor";

export type SignUpFormData = {
  accountType: AccountType;
  name: string;
  email: string;
  password: string;
  repeatPassword: string;
  agreedToTerms: boolean;
};

export type SignUpFormProps = {
  onSubmit?: (data: SignUpFormData) => void;
};

// ─── Log In ───────────────────────────────────────────────────────────────────

export type LoginFormData = {
  email: string;
  password: string;
};

export type LoginFormProps = {
  onSubmit?: (data: LoginFormData) => void;
};

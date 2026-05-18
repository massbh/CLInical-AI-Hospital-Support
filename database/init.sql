-- CLInical AI Hospital Support - Database Schema
-- All tables in a single init.sql file

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";



CREATE TYPE account_type AS ENUM ('patient', 'doctor', 'nurse');
CREATE TYPE section_status AS ENUM ('pending', 'accepted');



CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    account_type account_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_accounts_type ON accounts(account_type);



CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL UNIQUE
);

CREATE INDEX idx_doctors_name ON doctors(name);



CREATE TABLE doctor_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    working_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    work_hours VARCHAR(255)[] NOT NULL DEFAULT ARRAY['9:00 am', '10:00 am', '11:00 am', '12:00 pm', '1:00 pm', '2:00 pm', '3:00 pm', '4:00 pm', '5:00 pm']
);

CREATE INDEX idx_doctor_schedules_doctor ON doctor_schedules(doctor_id);



CREATE TABLE booked_appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doctor_id, date, time)
);

CREATE INDEX idx_booked_appointments_doctor ON booked_appointments(doctor_id);
CREATE INDEX idx_booked_appointments_patient ON booked_appointments(patient_id);
CREATE INDEX idx_booked_appointments_date ON booked_appointments(date);



CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    source VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_new BOOLEAN DEFAULT TRUE,
    appointment_id UUID NOT NULL REFERENCES booked_appointments(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_timestamp ON notes(timestamp DESC);
CREATE INDEX idx_notes_appointment ON notes(appointment_id);


CREATE TABLE suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    source VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_new BOOLEAN DEFAULT TRUE,
    appointment_id UUID NOT NULL REFERENCES booked_appointments(id) ON DELETE CASCADE
);

CREATE INDEX idx_suggestions_timestamp ON suggestions(timestamp DESC);
CREATE INDEX idx_suggestions_appointment ON suggestions(appointment_id);



CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL,
    patient_surname VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    preview BOOLEAN DEFAULT NULL,
    email_status VARCHAR(20) DEFAULT NULL CHECK (email_status IN ('ready', 'sent', 'failed')),
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_patient ON reports(patient_id);
CREATE INDEX idx_reports_doctor ON reports(doctor_id);
CREATE INDEX idx_reports_date ON reports(date DESC);
CREATE INDEX idx_reports_email_status ON reports(email_status);



CREATE TABLE report_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    status section_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_report_sections_report ON report_sections(report_id);
CREATE INDEX idx_report_sections_status ON report_sections(status);



CREATE VIEW report_meta AS
SELECT 
    r.id,
    r.patient_id,
    r.patient_name,
    r.doctor_name,
    r.date,
    r.title
FROM reports r;



CREATE OR REPLACE FUNCTION authGetUserByEmail(email TEXT)
RETURNS TABLE(id UUID, name TEXT, email TEXT, password_hash TEXT, account_type account_type) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.name, a.email, a.password_hash, a.account_type
    FROM accounts a
    WHERE a.email = authGetUserByEmail.email;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION authGetUserById(userId UUID)
RETURNS TABLE(id UUID, name TEXT, account_type account_type) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.name, a.account_type
    FROM accounts a
    WHERE a.id = userId;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION authCreateAccount(
    p_name TEXT,
    p_email TEXT,
    p_password_hash TEXT,
    p_account_type account_type
)
RETURNS TABLE(id UUID) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO accounts (name, email, password_hash, account_type)
    VALUES (p_name, p_email, p_password_hash, p_account_type)
    RETURNING id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION authCreateDoctor(p_name TEXT, p_account_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO doctors (name, account_id)
    VALUES (p_name, p_account_id);
END;
$$ LANGUAGE plpgsql;

-- Appointment Procedures
CREATE OR REPLACE FUNCTION appointmentGetAll(p_doctor_id UUID DEFAULT NULL)
RETURNS TABLE(doctor_id UUID, date DATE, time VARCHAR(50)) AS $$
BEGIN
    IF p_doctor_id IS NOT NULL THEN
        RETURN QUERY
        SELECT ba.doctor_id, ba.date, ba.time
        FROM booked_appointments ba
        WHERE ba.doctor_id = p_doctor_id
        ORDER BY ba.date, ba.time;
    ELSE
        RETURN QUERY
        SELECT ba.doctor_id, ba.date, ba.time
        FROM booked_appointments ba
        ORDER BY ba.date, ba.time;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION appointmentGetById(p_id UUID)
RETURNS TABLE(
    id UUID,
    date DATE,
    time VARCHAR(50),
    patient_id UUID,
    patient_name TEXT,
    patient_email TEXT,
    doctor_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ba.id,
        ba.date,
        ba.time,
        ba.patient_id,
        a.name AS patient_name,
        a.email AS patient_email,
        d.name AS doctor_name
    FROM booked_appointments ba
    JOIN accounts a ON a.id = ba.patient_id
    JOIN doctors d ON d.id = ba.doctor_id
    WHERE ba.id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION appointmentGetDoctorByAccountId(p_account_id UUID)
RETURNS TABLE(id UUID, name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.name
    FROM doctors d
    WHERE d.account_id = p_account_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION appointmentGetCalendarForDoctor(p_doctor_id UUID)
RETURNS TABLE(id UUID, date DATE, time VARCHAR(50), patient_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT ba.id, ba.date::DATE, ba.time, a.name AS patient_name
    FROM booked_appointments ba
    JOIN accounts a ON a.id = ba.patient_id
    WHERE ba.doctor_id = p_doctor_id
    ORDER BY ba.date, ba.time DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION appointmentGetCurrent(p_doctor_id UUID)
RETURNS TABLE(
    id UUID,
    patient_id UUID,
    date DATE,
    time VARCHAR(50),
    patient_name TEXT,
    patient_surname TEXT,
    doctor_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ba.id,
        ba.patient_id,
        ba.date,
        ba.time,
        (a.name)::TEXT,
        SUBSTR(a.name, POSITION(' ' IN a.name) + 1),
        d.name AS doctor_name
    FROM booked_appointments ba
    JOIN accounts a ON a.id = ba.patient_id
    JOIN doctors d ON d.id = ba.doctor_id
    WHERE ba.doctor_id = p_doctor_id
      AND ba.date = CURRENT_DATE
      AND ba.time::TIME >= CURRENT_TIME - INTERVAL '60 minutes'
    ORDER BY ba.time::TIME
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION appointmentBook(
    p_doctor_id UUID,
    p_patient_id UUID,
    p_date DATE,
    p_time VARCHAR(50)
)
RETURNS TABLE(id UUID, doctor_id UUID, date DATE, time VARCHAR(50)) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO booked_appointments (doctor_id, patient_id, date, time)
    VALUES (p_doctor_id, p_patient_id, p_date, p_time)
    RETURNING id, doctor_id, date, time;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION appointmentFindAvailable(p_date DATE, p_time VARCHAR(50))
RETURNS TABLE(id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT d.id
    FROM doctors d
    JOIN doctor_schedules ds ON ds.doctor_id = d.id
    WHERE
        EXTRACT(DOW FROM p_date)::INTEGER = ANY(ds.working_days)
        AND p_time = ANY(ds.work_hours)
        AND NOT EXISTS (
            SELECT 1 FROM booked_appointments ba
            WHERE ba.doctor_id = d.id AND ba.date = p_date AND ba.time = p_time
        )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Doctor Procedures
CREATE OR REPLACE FUNCTION doctorGetAll()
RETURNS TABLE(id UUID, name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.name FROM doctors d ORDER BY d.name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION doctorGetSchedule(p_doctor_id UUID)
RETURNS TABLE(doctor_id UUID, working_days INTEGER[], work_hours TEXT[]) AS $$
BEGIN
    RETURN QUERY
    SELECT ds.doctor_id, ds.working_days, ds.work_hours
    FROM doctor_schedules ds
    WHERE ds.doctor_id = p_doctor_id;
END;
$$ LANGUAGE plpgsql;

-- Report Procedures
CREATE OR REPLACE FUNCTION reportGetAll()
RETURNS TABLE(
    id UUID,
    patient_name TEXT,
    patient_surname TEXT,
    date DATE,
    title TEXT,
    content TEXT,
    finalized BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.patient_name,
        r.patient_surname,
        r.date,
        r.title,
        r.content,
        (r.preview IS FALSE)
    FROM reports r
    ORDER BY r.date DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportGetMeta(p_id UUID)
RETURNS TABLE(id UUID, patient_id UUID, patient_name TEXT, doctor_name TEXT, date DATE) AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.patient_id, r.patient_name, r.doctor_name, r.date
    FROM report_meta r
    WHERE r.id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportCheckExists(p_id UUID)
RETURNS TABLE(exists BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT EXISTS(SELECT 1 FROM reports WHERE id = p_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportGetAppointmentDetails(p_appointment_id UUID)
RETURNS TABLE(patient_id UUID, doctor_account_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT ba.patient_id, d.account_id AS doctor_account_id
    FROM booked_appointments ba
    JOIN doctors d ON d.id = ba.doctor_id
    WHERE ba.id = p_appointment_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportGetNotesByAppointment(p_appointment_id UUID)
RETURNS TABLE(id UUID, content TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.content
    FROM notes n
    WHERE n.appointment_id = p_appointment_id
    ORDER BY n.timestamp ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportGetSuggestionsByAppointment(p_appointment_id UUID)
RETURNS TABLE(id UUID, content TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.description AS content
    FROM suggestions s
    WHERE s.appointment_id = p_appointment_id
    ORDER BY s.timestamp ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportCreate(
    p_patient_id UUID,
    p_doctor_id UUID,
    p_patient_name TEXT,
    p_patient_surname TEXT,
    p_doctor_name TEXT,
    p_title TEXT
)
RETURNS TABLE(id UUID) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO reports (patient_id, doctor_id, patient_name, patient_surname, doctor_name, date, title, preview)
    VALUES (p_patient_id, p_doctor_id, p_patient_name, p_patient_surname, p_doctor_name, CURRENT_DATE, p_title, NULL)
    RETURNING id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportSectionUpsert(
    p_report_id UUID,
    p_title TEXT,
    p_content TEXT,
    p_status section_status
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO report_sections (report_id, title, content, status)
    VALUES (p_report_id, p_title, p_content, p_status)
    ON CONFLICT (report_id, title) DO UPDATE SET
        content = EXCLUDED.content,
        status = EXCLUDED.status;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportSectionGetAll(p_report_id UUID)
RETURNS TABLE(id UUID, title TEXT, status section_status) AS $$
BEGIN
    RETURN QUERY
    SELECT rs.id, rs.title, rs.status
    FROM report_sections rs
    WHERE rs.report_id = p_report_id
    ORDER BY rs.created_at;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportSectionGetById(p_section_id UUID, p_report_id UUID)
RETURNS TABLE(id UUID, title TEXT, status section_status, content TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT rs.id, rs.title, rs.status, rs.content
    FROM report_sections rs
    WHERE rs.id = p_section_id AND rs.report_id = p_report_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportSectionUpdate(
    p_section_id UUID,
    p_report_id UUID,
    p_status section_status DEFAULT NULL,
    p_content TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, title TEXT, status section_status) AS $$
BEGIN
    RETURN QUERY
    UPDATE report_sections
    SET
        status = COALESCE(p_status, status),
        content = COALESCE(p_content, content)
    WHERE id = p_section_id AND report_id = p_report_id
    RETURNING id, title, status;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportFinalize(p_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE reports SET preview = FALSE WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reportRevertFinalize(p_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE reports SET preview = NULL WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Note Procedures
CREATE OR REPLACE FUNCTION noteGetByAppointment(p_appointment_id UUID)
RETURNS TABLE(id UUID, content TEXT, source TEXT, timestamp TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.content, n.source, n.timestamp
    FROM notes n
    WHERE n.appointment_id = p_appointment_id
    ORDER BY n.timestamp::TIME DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION noteCreate(
    p_content TEXT,
    p_source TEXT,
    p_appointment_id UUID
)
RETURNS TABLE(id UUID, content TEXT, source TEXT, timestamp TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO notes (content, source, appointment_id)
    VALUES (p_content, p_source, p_appointment_id)
    RETURNING id, content, source, timestamp;
END;
$$ LANGUAGE plpgsql;

-- Suggestion Procedures
CREATE OR REPLACE FUNCTION suggestionGetByAppointment(p_appointment_id UUID)
RETURNS TABLE(
    id UUID,
    content TEXT,
    priority TEXT,
    title TEXT,
    source TEXT,
    timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.description AS content, s.priority::TEXT, s.title, NULL::TEXT AS source, s.timestamp
    FROM suggestions s
    WHERE s.appointment_id = p_appointment_id
    ORDER BY s.timestamp::TIME DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION suggestionCreate(
    p_title TEXT,
    p_description TEXT,
    p_priority TEXT,
    p_appointment_id UUID
)
RETURNS TABLE(id UUID, content TEXT, priority TEXT, title TEXT, timestamp TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO suggestions (title, description, priority, appointment_id)
    VALUES (p_title, p_description, p_priority::suggestion_priority, p_appointment_id)
    RETURNING id, description AS content, priority::TEXT, title, timestamp;
END;
$$ LANGUAGE plpgsql;

-- Time Slots Procedure
CREATE OR REPLACE FUNCTION getAvailableTimeSlots(p_doctor_id UUID, p_date DATE)
RETURNS TABLE(time_slot VARCHAR(50)) AS $$
BEGIN
    RETURN QUERY
    SELECT unnest(ds.work_hours)::VARCHAR(50)
    FROM doctor_schedules ds
    WHERE ds.doctor_id = p_doctor_id
      AND EXTRACT(DOW FROM p_date)::INTEGER = ANY(ds.working_days)
    EXCEPT
    SELECT ba.time::VARCHAR(50)
    FROM booked_appointments ba
    WHERE ba.doctor_id = p_doctor_id
      AND ba.date = p_date;
END;
$$ LANGUAGE plpgsql;



-- ============================================================  
-- SEED DATA  
-- ============================================================  
-- Login credentials:  
--   doctor@test.com   / password123  (Dr. Sarah Johnson)  
--   doctor2@test.com  / password123  (Dr. Michael Chen)  
--   patient@test.com  / password123  (Alice Williams)  
--   patient2@test.com / password123  (Bob Martinez)  
-- ============================================================  
  
-- Accounts (replace REPLACE_WITH_HASH with the bcrypt output from Step 1)  
INSERT INTO accounts (id, name, email, password_hash, account_type) VALUES  
    ('aaaa0000-0000-0000-0000-000000000001'::UUID, 'Dr. Sarah Johnson',  'doctor@test.com',   '$2b$10$VsEfypu2Y5oHs/bcJ/w6juL35VedVs2Ozn5KWRRgP4dpIZ75NqZq6', 'doctor'),  
    ('aaaa0000-0000-0000-0000-000000000002'::UUID, 'Dr. Michael Chen',   'doctor2@test.com',  '$2b$10$VsEfypu2Y5oHs/bcJ/w6juL35VedVs2Ozn5KWRRgP4dpIZ75NqZq6', 'doctor'),  
    ('aaaa0000-0000-0000-0000-000000000003'::UUID, 'Alice Williams',     'patient@test.com',  '$2b$10$VsEfypu2Y5oHs/bcJ/w6juL35VedVs2Ozn5KWRRgP4dpIZ75NqZq6', 'patient'),  
    ('aaaa0000-0000-0000-0000-000000000004'::UUID, 'Bob Martinez',       'patient2@test.com', '$2b$10$VsEfypu2Y5oHs/bcJ/w6juL35VedVs2Ozn5KWRRgP4dpIZ75NqZq6', 'patient');  
  
-- Doctors  
INSERT INTO doctors (id, name, account_id) VALUES  
    ('bbbb0000-0000-0000-0000-000000000001'::UUID, 'Dr. Sarah Johnson', 'aaaa0000-0000-0000-0000-000000000001'::UUID),  
    ('bbbb0000-0000-0000-0000-000000000002'::UUID, 'Dr. Michael Chen',  'aaaa0000-0000-0000-0000-000000000002'::UUID);  
  
-- Doctor schedules (Mon-Sat for Sarah so today Saturday works, Mon-Fri for Michael)  
INSERT INTO doctor_schedules (doctor_id, working_days, work_hours) VALUES  
    ('bbbb0000-0000-0000-0000-000000000001'::UUID,  
     ARRAY[1,2,3,4,5,6],  
     ARRAY['9:00 am','10:00 am','11:00 am','12:00 pm','1:00 pm','2:00 pm','3:00 pm','4:00 pm','5:00 pm']),  
    ('bbbb0000-0000-0000-0000-000000000002'::UUID,  
     ARRAY[1,2,3,4,5],  
     ARRAY['10:00 am','11:00 am','12:00 pm','1:00 pm']);  
  
-- Booked appointments  
-- One for TODAY (2026-05-02) so the conversation page works immediately  
INSERT INTO booked_appointments (id, doctor_id, patient_id, date, time) VALUES  
    ('cccc0000-0000-0000-0000-000000000001'::UUID,  
     'bbbb0000-0000-0000-0000-000000000001'::UUID,  
     'aaaa0000-0000-0000-0000-000000000003'::UUID,  
     CURRENT_DATE, '9:00 am'),  
    ('cccc0000-0000-0000-0000-000000000002'::UUID,  
     'bbbb0000-0000-0000-0000-000000000001'::UUID,  
     'aaaa0000-0000-0000-0000-000000000004'::UUID,  
     CURRENT_DATE, '10:00 am'),  
    ('cccc0000-0000-0000-0000-000000000003'::UUID,
     'bbbb0000-0000-0000-0000-000000000001'::UUID,
     'aaaa0000-0000-0000-0000-000000000003'::UUID,
     CURRENT_DATE, '3:00 pm'),
    ('cccc0000-0000-0000-0000-000000000006'::UUID,
     'bbbb0000-0000-0000-0000-000000000001'::UUID,
     'aaaa0000-0000-0000-0000-000000000003'::UUID,
     CURRENT_DATE, '2:00 pm'),
    ('cccc0000-0000-0000-0000-000000000004'::UUID,  
     'bbbb0000-0000-0000-0000-000000000001'::UUID,  
     'aaaa0000-0000-0000-0000-000000000003'::UUID,  
     '2026-05-04', '11:00 am'),  
    ('cccc0000-0000-0000-0000-000000000005'::UUID,
     'bbbb0000-0000-0000-0000-000000000002'::UUID,
     'aaaa0000-0000-0000-0000-000000000004'::UUID,
     '2026-05-05', '1:00 pm');

-- Dynamic "now" appointment for Dr. Sarah Johnson + Alice Williams.
-- Picks the closest work-hour slot to CURRENT_TIME so the conversation page
-- always shows a usable appointment after a reload-db, regardless of when.
DO $$
DECLARE
    slot VARCHAR(50);
BEGIN
    slot := CASE EXTRACT(HOUR FROM CURRENT_TIME)::INT
        WHEN  9 THEN '9:00 am'
        WHEN 10 THEN '10:00 am'
        WHEN 11 THEN '11:00 am'
        WHEN 12 THEN '12:00 pm'
        WHEN 13 THEN '1:00 pm'
        WHEN 14 THEN '2:00 pm'
        WHEN 15 THEN '3:00 pm'
        WHEN 16 THEN '4:00 pm'
        WHEN 17 THEN '5:00 pm'
        ELSE '9:00 am'  -- before/after work hours: fall back to first slot
    END;

    INSERT INTO booked_appointments (id, doctor_id, patient_id, date, time)
    VALUES (
        'cccc0000-0000-0000-0000-000000000099'::UUID,
        'bbbb0000-0000-0000-0000-000000000001'::UUID,
        'aaaa0000-0000-0000-0000-000000000003'::UUID,
        CURRENT_DATE,
        slot
    )
    ON CONFLICT (doctor_id, date, time) DO NOTHING;
END $$;
  
-- Notes (tied to today's 9:00 am appointment for Dr. Sarah Johnson)  
INSERT INTO notes (content, source, is_new, appointment_id) VALUES  
    ('Patient reports mild headache persisting for 3 days. No fever.',  
     'AI Analysis', TRUE, 'cccc0000-0000-0000-0000-000000000001'::UUID),  
    ('Blood pressure reading: 130/85 mmHg — slightly elevated.',  
     'Vitals Monitor', TRUE, 'cccc0000-0000-0000-0000-000000000001'::UUID),  
    ('Patient has family history of hypertension (mother, maternal grandmother).',  
     'Medical Records', TRUE, 'cccc0000-0000-0000-0000-000000000001'::UUID);  
  
-- Suggestions (tied to today's 9:00 am appointment for Dr. Sarah Johnson)
INSERT INTO suggestions (content, source, is_new, appointment_id) VALUES
    ('Order blood panel — recurring headaches with elevated BP may indicate underlying condition; recommend CBC and metabolic panel.',
     'medBrain', TRUE, 'cccc0000-0000-0000-0000-000000000001'::UUID),
    ('Discuss lifestyle factors — ask about sleep patterns, stress levels, and caffeine intake given the headache history.',
     'medBrain', TRUE, 'cccc0000-0000-0000-0000-000000000001'::UUID),
    ('Schedule follow-up — if BP remains elevated, schedule a follow-up in 2 weeks for repeat measurement.',
     'medBrain', TRUE, 'cccc0000-0000-0000-0000-000000000001'::UUID);
  
-- Notes for the 10:00 am appointment (different patient)  
INSERT INTO notes (content, source, is_new, appointment_id) VALUES  
    ('Patient here for routine follow-up after knee surgery 6 weeks ago.',  
     'AI Analysis', TRUE, 'cccc0000-0000-0000-0000-000000000002'::UUID);  
  
INSERT INTO suggestions (content, source, is_new, appointment_id) VALUES
    ('Review post-op imaging — check latest X-ray to confirm proper healing of the tibial plateau.',
     'medBrain', TRUE, 'cccc0000-0000-0000-0000-000000000002'::UUID);
  
-- Reports  
INSERT INTO reports (id, patient_id, doctor_id, patient_name, patient_surname, doctor_name, date, title, content, preview) VALUES  
    ('dddd0000-0000-0000-0000-000000000001'::UUID,  
     'aaaa0000-0000-0000-0000-000000000003'::UUID,  
     'aaaa0000-0000-0000-0000-000000000001'::UUID,  
     'Alice', 'Williams', 'Dr. Sarah Johnson',  
     '2026-04-28', 'Annual Physical Examination',  
     'Comprehensive annual physical examination for patient Alice Williams.', NULL),  
    ('dddd0000-0000-0000-0000-000000000002'::UUID,  
     'aaaa0000-0000-0000-0000-000000000004'::UUID,  
     'aaaa0000-0000-0000-0000-000000000002'::UUID,  
     'Bob', 'Martinez', 'Dr. Michael Chen',  
     '2026-04-25', 'Post-Operative Follow-Up',  
     'Follow-up assessment after arthroscopic knee surgery.', NULL);  
  
-- Report sections  
INSERT INTO report_sections (report_id, title, content, status) VALUES  
    ('dddd0000-0000-0000-0000-000000000001'::UUID,  
     'Vital Signs',  
     'BP: 120/80 mmHg, HR: 72 bpm, Temp: 98.6°F, SpO2: 99%. All vitals within normal range.',  
     'accepted'),  
    ('dddd0000-0000-0000-0000-000000000001'::UUID,  
     'Physical Examination',  
     'Heart: Regular rate and rhythm, no murmurs. Lungs: Clear to auscultation bilaterally. Abdomen: Soft, non-tender.',  
     'accepted'),  
    ('dddd0000-0000-0000-0000-000000000001'::UUID,  
     'Assessment & Plan',  
     'Patient is in good overall health. Continue current medications. Return in 12 months for next annual exam.',  
     'pending'),  
    ('dddd0000-0000-0000-0000-000000000002'::UUID,  
     'Surgical Summary',  
     'Arthroscopic meniscectomy performed on left knee on 2026-03-20. No intraoperative complications.',  
     'accepted'),  
    ('dddd0000-0000-0000-0000-000000000002'::UUID,  
     'Recovery Progress',  
     'Patient reports decreased pain and improved range of motion. Physical therapy ongoing twice weekly.',  
     'pending'),  
    ('dddd0000-0000-0000-0000-000000000002'::UUID,  
     'Recommendations',  
     'Continue physical therapy for 4 more weeks. Gradual return to normal activities. Follow up in 6 weeks.',  
     'pending');

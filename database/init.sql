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



CREATE OR REPLACE FUNCTION get_available_time_slots(
    p_doctor_id UUID,
    p_date DATE
) RETURNS TABLE(time_slot VARCHAR(50)) AS $$
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

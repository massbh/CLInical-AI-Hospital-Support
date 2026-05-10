#!/usr/bin/env python3
"""Insert mock data for PDF generation testing."""

import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection
conn = psycopg2.connect(
    host="localhost",
    user="clinicalai",
    password="clinicalai",
    database="clinicalai"
)

cursor = conn.cursor(cursor_factory=RealDictCursor)

try:
    cursor.execute(
        "SELECT COUNT(*) as count FROM reports WHERE id = 'cccc0000-0000-0000-0000-000000000001'"
    )
    if cursor.fetchone()['count'] > 0:
        print("✓ Test data already exists")
        # Reset preview flag to TRUE for testing
        cursor.execute(
            "UPDATE reports SET preview = TRUE WHERE id = 'cccc0000-0000-0000-0000-000000000001'"
        )
        conn.commit()
        print("✓ Preview flag reset to TRUE for PDF generation testing")
    else:
        cursor.execute(
            "SELECT id FROM accounts WHERE email = 'patient@test.com' LIMIT 1"
        )
        result = cursor.fetchone()
        if result:
            patient_id = result['id']
        else:
            patient_id = 'aaaa0000-0000-0000-0000-000000000001'
            cursor.execute("""
                INSERT INTO accounts (id, name, email, password_hash, account_type) 
                VALUES (%s, %s, %s, %s, %s)
            """, (patient_id, 'John Patient', 'patient@test.com', 'hash1', 'patient'))
        
        cursor.execute(
            "SELECT id FROM accounts WHERE email = 'doctor@test.com' LIMIT 1"
        )
        result = cursor.fetchone()
        if result:
            doctor_id = result['id']
        else:
            doctor_id = 'bbbb0000-0000-0000-0000-000000000001'
            cursor.execute("""
                INSERT INTO accounts (id, name, email, password_hash, account_type) 
                VALUES (%s, %s, %s, %s, %s)
            """, (doctor_id, 'Dr. Jane Smith', 'doctor@test.com', 'hash2', 'doctor'))
        
        # Insert report with preview=TRUE (triggers PDF generation)
        cursor.execute("""
            INSERT INTO reports (id, patient_id, doctor_id, patient_name, patient_surname, doctor_name, date, title, content, preview) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            'cccc0000-0000-0000-0000-000000000001',
            patient_id,
            doctor_id,
            'John',
            'Patient',
            'Jane Smith',
            '2026-05-07',
            'Medical Consultation Report',
            'Complete medical assessment',
            True  # This flag triggers PDF generation
        ))
        
        # Insert report sections
        sections = [
            ('Symptoms', 'Patient reports persistent headache and fatigue for 3 days'),
            ('Vital Signs', 'BP: 120/80, HR: 72, Temp: 98.6F'),
            ('Diagnosis', 'Preliminary diagnosis suggests possible tension headache'),
            ('Recommendations', 'Rest, hydration, and pain management recommended'),
        ]
        
        for section_title, section_content in sections:
            cursor.execute("""
                INSERT INTO report_sections (report_id, title, content, status) 
                VALUES (%s, %s, %s, %s)
            """, (
                'cccc0000-0000-0000-0000-000000000001',
                section_title,
                section_content,
                'accepted'
            ))
        
        conn.commit()
        print("✓ Mock data inserted successfully")
        print(f"  - Patient: John Patient")
        print(f"  - Doctor: Dr. Jane Smith")
        print(f"  - Report ID: cccc0000-0000-0000-0000-000000000001")
        print(f"  - Preview Flag: TRUE (will trigger PDF generation)")
        print(f"  - Sections: 4 (Symptoms, Vital Signs, Diagnosis, Recommendations)")

    # Verify data was inserted
    cursor.execute("""
        SELECT r.id, r.patient_name, r.doctor_name, r.title, r.preview, 
               COUNT(rs.id) as section_count
        FROM reports r
        LEFT JOIN report_sections rs ON r.id = rs.report_id
        WHERE r.id = 'cccc0000-0000-0000-0000-000000000001'
        GROUP BY r.id, r.patient_name, r.doctor_name, r.title, r.preview
    """)
    
    result = cursor.fetchone()
    if result:
        print(f"\n✓ Verification: Report exists")
        print(f"  - ID: {result['id']}")
        print(f"  - Patient: {result['patient_name']}")
        print(f"  - Doctor: {result['doctor_name']}")
        print(f"  - Title: {result['title']}")
        print(f"  - Preview Flag: {result['preview']}")
        print(f"  - Sections: {result['section_count']}")

finally:
    cursor.close()
    conn.close()
    print("\n✓ Database connection closed")

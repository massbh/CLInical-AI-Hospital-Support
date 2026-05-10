import os
from datetime import date
from unittest.mock import patch, MagicMock

import pytest

from reportGenerator import pdf_generator as pg


SAMPLE_REPORT = {
    "id": "r-1",
    "patient_name": "Alice",
    "patient_surname": "Smith",
    "doctor_name": "Dr. House",
    "title": "Visit",
    "date": date(2026, 5, 7),
    "preview": None,
}

SAMPLE_SECTIONS = [
    {"title": "Assessment", "content": "<para>Assessment body</para>", "status": "ok"},
    {"title": "Diagnosis", "content": "<para>Diagnosis body</para>", "status": "ok"},
    {"title": "Prescription", "content": "<para>Prescription body</para>", "status": "ok"},
]


def test_add_part_concatenates():
    assert pg.add_part("a", "b") == "ab"


def test_loop_reports_merges_first_three_sections():
    with patch.object(pg, "fetch_report_sections", return_value=SAMPLE_SECTIONS):
        merged = pg.loop_reports("r-1")
    assert "Assessment body" in merged
    assert "Diagnosis body" in merged
    assert "Prescription body" in merged


def test_generate_formatted_pdf_writes_file(tmp_path):
    out = tmp_path / "nested" / "out.pdf"
    pg.generate_formatted_pdf("<para>Hello world</para>", str(out))
    assert out.exists() and out.stat().st_size > 0


def test_process_report_preview_mode_posts_to_ui():
    report = {**SAMPLE_REPORT, "preview": None}
    with patch.object(pg, "fetch_report", return_value=report), \
         patch.object(pg, "fetch_report_sections", return_value=SAMPLE_SECTIONS), \
         patch.object(pg, "httpx") as mock_httpx, \
         patch.object(pg, "generate_formatted_pdf") as mock_gen, \
         patch.object(pg, "update_report_preview_flag") as mock_flag:
        client = MagicMock()
        mock_httpx.Client.return_value.__enter__.return_value = client
        pg.process_report("r-1")

    assert client.post.called
    mock_gen.assert_not_called()
    mock_flag.assert_not_called()


def test_process_report_production_mode_generates_pdf_and_flips_flag(tmp_path):
    report = {**SAMPLE_REPORT, "preview": True}
    with patch.object(pg, "fetch_report", return_value=report), \
         patch.object(pg, "fetch_report_sections", return_value=SAMPLE_SECTIONS), \
         patch.object(pg, "update_report_preview_flag") as mock_flag:
        pg.process_report("r-1", output_dir=str(tmp_path) + os.sep)

    assert (tmp_path / "report_r-1.pdf").exists()
    mock_flag.assert_called_once_with("r-1", False)


def test_process_report_already_sent_is_noop():
    report = {**SAMPLE_REPORT, "preview": False}
    with patch.object(pg, "fetch_report", return_value=report), \
         patch.object(pg, "generate_formatted_pdf") as mock_gen, \
         patch.object(pg, "update_report_preview_flag") as mock_flag, \
         patch.object(pg, "send_to_preview_ui") as mock_send:
        pg.process_report("r-1")

    mock_gen.assert_not_called()
    mock_flag.assert_not_called()
    mock_send.assert_not_called()


def test_process_report_missing_report_returns_quietly():
    with patch.object(pg, "fetch_report", return_value=None), \
         patch.object(pg, "send_to_preview_ui") as mock_send, \
         patch.object(pg, "generate_formatted_pdf") as mock_gen:
        pg.process_report("missing")

    mock_send.assert_not_called()
    mock_gen.assert_not_called()


def test_process_all_pending_dispatches_each_row():
    rows = [{"id": "a"}, {"id": "b"}, {"id": "c"}]
    with patch.object(pg, "fetch_reports_for_processing", return_value=rows), \
         patch.object(pg, "process_report") as mock_proc:
        pg.process_all_pending_reports()

    assert mock_proc.call_count == 3
    assert [c.args[0] for c in mock_proc.call_args_list] == ["a", "b", "c"]

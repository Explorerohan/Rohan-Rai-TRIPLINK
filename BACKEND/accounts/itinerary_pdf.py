"""Generate premium itinerary PDF using reportlab."""

from datetime import timedelta
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from .models import ItineraryTrip


BRAND_GREEN = colors.HexColor("#1f6b2a")
LIGHT_BG = colors.HexColor("#f8fafc")
BORDER = colors.HexColor("#dbe3ed")
TEXT_DARK = colors.HexColor("#0f172a")
TEXT_MUTED = colors.HexColor("#475569")

# Standard wording for all travelers (section 8).
STANDARD_TRAVEL_INSTRUCTIONS = (
    "Please follow your confirmed itinerary closely, including scheduled timings and meeting or pickup points, and arrive "
    "prepared for each activity. Keep your passport, tickets, and other travel documents secure and accessible, and "
    "safeguard personal belongings and valuables throughout your trip. If you experience delays, an emergency, or need "
    "assistance, contact your TRIPLINK travel advisor without delay using the support details in this document. Your "
    "safety and comfort are our priority; we thank you for your cooperation and wish you an enjoyable journey."
)


def _safe(v, default="Not provided"):
    s = (str(v).strip() if v is not None else "")
    return s or default


def _logo_path():
    root = Path(__file__).resolve().parents[2]
    p = root / "FRONTEND" / "TRIPLINK" / "src" / "Assets" / "Logo.png"
    return p if p.exists() else None


def _logo_flowable(max_width=1.0 * inch):
    """Logo image with natural aspect ratio, left-aligned (above TRIPLINK title)."""
    path = _logo_path()
    if not path:
        return None
    try:
        reader = ImageReader(str(path))
        iw, ih = reader.getSize()
        if iw <= 0 or ih <= 0:
            return None
        w = float(max_width)
        h = w * (float(ih) / float(iw))
        return Image(str(path), width=w, height=h, hAlign="LEFT")
    except Exception:
        return None


def _section_title(text, styles):
    return Paragraph(f"<b>{text}</b>", styles["section"])


def _kv_table(rows):
    table = Table(rows, colWidths=[2.1 * inch, 4.9 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TEXTCOLOR", (0, 0), (-1, -1), TEXT_DARK),
                ("TEXTCOLOR", (0, 0), (0, -1), TEXT_MUTED),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def build_itinerary_pdf(trip: ItineraryTrip) -> BytesIO:
    """Build branded, detailed PDF buffer for an ItineraryTrip."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=42, leftMargin=42, topMargin=42, bottomMargin=44)
    sample = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "Title", parent=sample["Heading1"], fontSize=20, textColor=TEXT_DARK, spaceAfter=4, alignment=TA_LEFT
        ),
        "subtitle": ParagraphStyle(
            "Subtitle", parent=sample["Normal"], fontSize=9, textColor=TEXT_MUTED, leading=12, alignment=TA_LEFT
        ),
        "section": ParagraphStyle("Section", parent=sample["Heading2"], fontSize=12, textColor=BRAND_GREEN, spaceAfter=6),
        "body": ParagraphStyle("Body", parent=sample["Normal"], fontSize=9, textColor=TEXT_DARK, leading=12),
        "note": ParagraphStyle("Note", parent=sample["Normal"], fontSize=9, textColor=TEXT_MUTED, leading=12),
    }

    profile = getattr(trip, "profile", None)
    traveler_name = _safe(getattr(profile, "traveler_full_names", None), "Traveler")
    booking_ref = _safe(
        getattr(profile, "booking_reference", "") or getattr(getattr(trip, "booking", None), "booking_code", ""),
        "N/A",
    )
    end_date = trip.start_date + timedelta(days=max(1, trip.days_count) - 1)

    flow = []
    logo_im = _logo_flowable()
    if logo_im:
        flow.append(logo_im)
        flow.append(Spacer(1, 0.06 * inch))
    flow.append(Paragraph("TRIPLINK", styles["title"]))
    flow.append(
        Paragraph(
            f"Premium Travel Itinerary<br/>Booking Ref: {booking_ref} | Generated for: {traveler_name}",
            styles["subtitle"],
        )
    )
    flow.append(Spacer(1, 0.16 * inch))

    # 1) Traveler & booking details
    flow.append(_section_title("1. Traveler & Booking Details", styles))
    flow.append(
        _kv_table(
            [
                ["Traveler Full Name(s)", _safe(getattr(profile, "traveler_full_names", None), traveler_name)],
                ["Contact Number", _safe(getattr(profile, "traveler_contact_number", None))],
                ["Email Address", _safe(getattr(profile, "traveler_email", None), getattr(trip.room.traveler, "email", ""))],
                ["Booking ID / Ref", booking_ref],
                ["Travel Dates", f"{trip.start_date} to {end_date}"],
                [
                    "Travelers (Adults/Children)",
                    f'{getattr(profile, "travelers_adults", 1)}/{getattr(profile, "travelers_children", 0)}',
                ],
                ["Package Name", _safe(getattr(profile, "package_name", None), getattr(getattr(trip.booking, "package", None), "title", ""))],
            ]
        )
    )
    flow.append(Spacer(1, 0.14 * inch))

    # 2) Trip overview
    flow.append(_section_title("2. Trip Overview", styles))
    flow.append(
        _kv_table(
            [
                ["Destination(s)", _safe(getattr(profile, "destinations", None))],
                ["Total Duration", f"{trip.days_count} Days / {trip.nights_count} Nights"],
            ]
        )
    )
    flow.append(Spacer(1, 0.14 * inch))

    # 3) Hotel details
    flow.append(_section_title("3. Hotel Details", styles))
    hotels = list(trip.hotel_stays.order_by("display_order", "id"))
    if not hotels:
        flow.append(Paragraph("Hotel details not provided.", styles["note"]))
    else:
        for h in hotels:
            stay_in = getattr(h, "stay_check_in_date", None)
            stay_out = getattr(h, "stay_check_out_date", None)
            stay_dates = ""
            if stay_in or stay_out:
                stay_dates = f"{stay_in or '—'} → {stay_out or '—'}"
            cin = (h.check_in_time or "").strip()
            cout = (h.check_out_time or "").strip()
            if cin or cout:
                times_line = f"{cin or '—'} / {cout or '—'}"
            else:
                times_line = "—"
            rows = [
                ["Hotel Name", _safe(h.hotel_name)],
                ["Address", _safe(h.full_address)],
                ["Contact Number", _safe(h.contact_number)],
            ]
            if stay_dates:
                rows.append(["Stay dates", _safe(stay_dates)])
            rows.append(["Check-in / check-out times", _safe(times_line)])
            rows.extend(
                [
                    ["Room Type", _safe(h.room_type)],
                    ["Amenities", _safe(h.amenities)],
                ]
            )
            flow.append(_kv_table(rows))
            flow.append(Spacer(1, 0.08 * inch))

    # 4) Day-by-day timeline
    flow.append(_section_title("4. Day-by-Day Detailed Itinerary", styles))
    items = list(trip.items.order_by("day_number", "is_night", "time_label", "created_at"))
    if not items:
        flow.append(Paragraph("No timeline entries available.", styles["note"]))
    else:
        current_period = None
        for item in items:
            period = f"Day {item.day_number}"
            if period != current_period:
                current_period = period
                flow.append(Paragraph(f"<b>{period}</b> — {item.travel_date}", styles["body"]))
                flow.append(Spacer(1, 0.05 * inch))
            pl = (item.place or "").strip()
            act = _safe(item.activity)
            tm = _safe(item.time_label, "Time")
            row_text = f"{tm}  |  {act} @ {pl}" if pl else f"{tm}  |  {act}"
            timeline = Table([[row_text]], colWidths=[7.0 * inch])
            timeline.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ]
                )
            )
            flow.append(timeline)
            if item.food_name:
                flow.append(Paragraph(f"Meal: {_safe(item.food_name)}", styles["note"]))
            if item.notes:
                flow.append(Paragraph(f"Note: {_safe(item.notes)}", styles["note"]))
            flow.append(Spacer(1, 0.04 * inch))
    flow.append(Spacer(1, 0.1 * inch))

    # 5) Meal plan
    flow.append(_section_title("5. Meal Plan", styles))
    flow.append(
        _kv_table(
            [
                ["Breakfast", _safe(getattr(profile, "meal_breakfast", None))],
                ["Lunch", _safe(getattr(profile, "meal_lunch", None))],
                ["Dinner", _safe(getattr(profile, "meal_dinner", None))],
            ]
        )
    )
    flow.append(Spacer(1, 0.1 * inch))

    # 6) Activities
    flow.append(_section_title("6. Activities & Experiences", styles))
    acts = list(trip.activity_plans.order_by("display_order", "id"))
    if not acts:
        flow.append(Paragraph("No dedicated activities list provided.", styles["note"]))
    else:
        act_rows = [["Activity", "Location"]]
        for a in acts:
            act_rows.append(
                [
                    _safe(a.activity_name),
                    _safe(a.location),
                ]
            )
        act_table = Table(act_rows, colWidths=[3.4 * inch, 3.6 * inch])
        act_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), LIGHT_BG),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                ]
            )
        )
        flow.append(act_table)
    flow.append(Spacer(1, 0.1 * inch))

    # 7) What to carry
    flow.append(_section_title("7. What to Carry", styles))
    carry = list(trip.carry_items.order_by("display_order", "id"))
    if not carry:
        flow.append(Paragraph("Carry checklist not provided.", styles["note"]))
    else:
        for c in carry:
            flow.append(Paragraph(f"• {_safe(c.item_name)}", styles["body"]))
    flow.append(Spacer(1, 0.1 * inch))

    # 8) Instructions (same professional text for every traveler)
    flow.append(_section_title("8. Important Instructions", styles))
    flow.append(Paragraph(STANDARD_TRAVEL_INSTRUCTIONS, styles["body"]))
    flow.append(Spacer(1, 0.1 * inch))

    # 9) Support
    flow.append(_section_title("9. Contact Details (24/7 Support)", styles))
    flow.append(
        _kv_table(
            [
                ["Travel Agent Name", _safe(getattr(profile, "support_agent_name", None), getattr(trip.room.agent, "email", ""))],
                ["Contact Number", _safe(getattr(profile, "support_contact_number", None))],
                ["Email Address", _safe(getattr(profile, "support_email", None), getattr(trip.room.agent, "email", ""))],
            ]
        )
    )
    flow.append(Spacer(1, 0.1 * inch))

    # 10) Payments
    flow.append(_section_title("10. Payment Details", styles))
    flow.append(
        _kv_table(
            [
                ["Total Package Cost", _safe(getattr(profile, "total_package_cost", None), getattr(getattr(trip, "booking", None), "total_amount", ""))],
                ["Amount Paid", _safe(getattr(profile, "amount_paid", None), getattr(getattr(trip, "booking", None), "total_amount", ""))],
                ["Remaining Balance", _safe(getattr(profile, "remaining_balance", None), "0.00")],
                ["Payment Method", _safe(getattr(profile, "payment_method", None), getattr(getattr(trip, "booking", None), "payment_method", ""))],
            ]
        )
    )
    flow.append(Spacer(1, 0.1 * inch))

    # 11) Document manifest
    flow.append(_section_title("11. Documents Attached", styles))
    docs = list(trip.document_items.order_by("display_order", "id"))
    if not docs:
        flow.append(Paragraph("No document manifest provided.", styles["note"]))
    else:
        for d in docs:
            state = "Included" if d.included else "Not included"
            label = (d.document_type or "").strip() or (d.document_name or "").strip() or "Document"
            notes_tail = (d.notes or "").strip()
            line = f"• {_safe(label)} ({state})"
            if notes_tail:
                line += f" — {_safe(notes_tail)}"
            flow.append(Paragraph(line, styles["body"]))

    def _footer(canvas, doc_obj):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(TEXT_MUTED)
        canvas.drawString(42, 24, "TRIPLINK | Professional travel planning itinerary")
        canvas.drawRightString(A4[0] - 42, 24, f"Page {doc_obj.page}")
        canvas.restoreState()

    doc.build(flow, onFirstPage=_footer, onLaterPages=_footer)
    buf.seek(0)
    return buf

"""Generate itinerary PDF using reportlab."""

from datetime import timedelta
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from .models import ItineraryTrip


def build_itinerary_pdf(trip: ItineraryTrip) -> BytesIO:
    """Build PDF buffer for an ItineraryTrip. Caller should seek(0) before reading."""
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ItineraryTitle",
        parent=styles["Heading1"],
        fontSize=18,
        spaceAfter=6,
    )
    heading_style = ParagraphStyle(
        "ItineraryHeading",
        parent=styles["Heading2"],
        fontSize=14,
        spaceAfter=4,
    )
    body_style = styles["Normal"]

    # Title
    traveler_name = "Traveler"
    if trip.room and trip.room.traveler:
        try:
            traveler_name = trip.room.traveler.user_profile.full_name or traveler_name
        except Exception:
            pass
    title = Paragraph(
        f"Trip Itinerary for {traveler_name}<br/><small>{trip.start_date} "
        f"({trip.days_count} Days / {trip.nights_count} Nights)</small>",
        title_style,
    )

    items = list(trip.items.order_by("day_number", "is_night", "time_label"))
    current_period = None
    flow = [title, Spacer(1, 0.2 * inch)]

    for item in items:
        period = f"Day {item.day_number}" if not item.is_night else f"Night {item.day_number}"
        if period != current_period:
            current_period = period
            flow.append(Paragraph(f"<b>{period}</b> — {item.travel_date}", heading_style))
            flow.append(Spacer(1, 0.1 * inch))

        # Row: time | place | activity | food
        food_display = item.food_name if item.food_name else "—"
        data = [[item.time_label, item.place, item.activity, food_display]]
        t = Table(data, colWidths=[0.9 * inch, 1.8 * inch, 2.2 * inch, 1.6 * inch])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                    ("TOPPADDING", (0, 0), (-1, 0), 6),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                ]
            )
        )
        flow.append(t)
        if item.notes:
            flow.append(Paragraph(f"<i>Note: {item.notes}</i>", body_style))
        flow.append(Spacer(1, 0.15 * inch))

    doc.build(flow)
    buf.seek(0)
    return buf

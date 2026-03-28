"""Helpers for manual refund dashboards: transparent pricing, deal, points, eSewa paid."""
from __future__ import annotations

from decimal import Decimal

def _d(x) -> Decimal:
    if x is None:
        return Decimal("0")
    if isinstance(x, Decimal):
        return x
    try:
        return Decimal(str(x))
    except Exception:
        return Decimal("0")


def get_refund_payment_breakdown(booking, package) -> dict:
    """
    Compute display fields for admin/agent refund tables.
    Uses booking + package row; optional booking.esewa_payment_session for payable_amount.
    """
    tc = max(int(getattr(booking, "traveler_count", 1) or 1), 1)
    list_ppp = _d(getattr(package, "price_per_person", None))
    list_line_total = list_ppp * tc

    snap_ppp = _d(getattr(booking, "price_per_person_snapshot", None))
    booked_line = snap_ppp * tc

    subtotal = _d(getattr(booking, "total_amount", None))
    if subtotal <= 0 and booked_line > 0:
        subtotal = booked_line

    points = int(getattr(booking, "reward_points_used", 0) or 0)

    session = getattr(booking, "esewa_payment_session", None)
    payable_from_session = _d(getattr(session, "payable_amount", None)) if session is not None else None
    session_total = _d(getattr(session, "total_amount", None)) if session is not None else None

    pref = (getattr(booking, "payment_reference", "") or "").strip()
    pm = (getattr(booking, "payment_method", "") or "").lower()

    # Amount actually charged to eSewa (what staff should refund in NPR via eSewa)
    if pref == "REWARD_POINTS_ONLY":
        amount_paid_esewa = Decimal("0")
    elif payable_from_session is not None and payable_from_session >= 0:
        amount_paid_esewa = payable_from_session
    else:
        amount_paid_esewa = subtotal - Decimal(points)
        if amount_paid_esewa < 0:
            amount_paid_esewa = Decimal("0")

    # Deal: catalog list vs booked subtotal (after agent deal pricing at booking time)
    deal_savings = list_line_total - subtotal
    if deal_savings < 0:
        deal_savings = Decimal("0")
    # Deal if list total exceeds booked subtotal, or per-person snapshot is below list catalog
    has_deal = deal_savings > Decimal("0.01") or (list_ppp > 0 and snap_ppp + Decimal("0.005") < list_ppp)

    points_value_npr = Decimal(points)  # 1 point = 1 NPR in this codebase

    return {
        "traveler_count": tc,
        "list_price_per_person": list_ppp,
        "list_line_total": list_line_total,
        "booked_price_per_person": snap_ppp,
        "booked_line_total": booked_line,
        "subtotal_after_deal": subtotal,
        "reward_points_used": points,
        "reward_points_value_npr": points_value_npr,
        "amount_paid_esewa": amount_paid_esewa,
        "has_deal": has_deal,
        "deal_savings_from_list": deal_savings,
        "payment_method": getattr(booking, "payment_method", "") or "",
        "payment_reference": getattr(booking, "payment_reference", "") or "",
        "transaction_uuid": getattr(booking, "transaction_uuid", "") or "",
        "session_total_amount": session_total if session is not None else None,
        "session_payable_amount": payable_from_session if session is not None else None,
        "is_reward_only": pref == "REWARD_POINTS_ONLY",
    }

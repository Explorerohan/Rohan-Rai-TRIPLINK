from django import template

from accounts.feature_options import get_feature_icon
from accounts.refund_display import get_refund_payment_breakdown

register = template.Library()


@register.filter
def feature_ionicon(name):
    """Ionicons name for a package feature label (see feature_options.FEATURE_OPTIONS)."""
    return get_feature_icon(name)


@register.inclusion_tag("includes/refund_payment_breakdown.html")
def refund_payment_breakdown(rr):
    if rr is None or not getattr(rr, "booking_id", None) or not getattr(rr, "package_id", None):
        return {"d": None, "rr": rr}
    try:
        d = get_refund_payment_breakdown(rr.booking, rr.package)
    except Exception:
        return {"d": None, "rr": rr}
    return {"d": d, "rr": rr}

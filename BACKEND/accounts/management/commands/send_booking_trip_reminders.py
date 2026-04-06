import logging

from django.core.management.base import BaseCommand

from accounts.booking_trip_notifications import process_booking_trip_reminders

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Send automated trip reminders (24h, 1h before start) and post-trip review prompts. "
        "Schedule this every 10–15 minutes (e.g. cron or Windows Task Scheduler)."
    )

    def handle(self, *args, **options):
        counts = process_booking_trip_reminders()
        msg = (
            f"Trip reminders done: 24h={counts['h24']}, 1h={counts['h1']}, review={counts['review']}"
        )
        logger.info(msg)
        self.stdout.write(self.style.SUCCESS(msg))

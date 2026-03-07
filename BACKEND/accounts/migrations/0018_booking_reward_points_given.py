# Generated manually

from django.db import migrations, models


def backfill_reward_points_given(apps, schema_editor):
    """Set reward_points_given for bookings that already have rewards_awarded=True."""
    Booking = apps.get_model("accounts", "Booking")
    for b in Booking.objects.filter(rewards_awarded=True, reward_points_given=0):
        amount = float(b.total_amount or 0)
        if amount <= 0:
            amount = float(b.price_per_person_snapshot or 0) * (b.traveler_count or 1)
        b.reward_points_given = int(amount * 0.10)
        b.save(update_fields=["reward_points_given"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0017_add_reward_points"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="reward_points_given",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Points awarded for this booking (10% of total). Used to prevent double-award and to deduct on delete.",
            ),
        ),
        migrations.RunPython(backfill_reward_points_given, noop),
    ]

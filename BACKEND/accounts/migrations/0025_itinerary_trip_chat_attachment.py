# Generated manually for itinerary trip, day/night, and chat attachment

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import accounts.models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0024_itineraryitem"),
    ]

    operations = [
        migrations.CreateModel(
            name="ItineraryTrip",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_date", models.DateField()),
                ("days_count", models.PositiveSmallIntegerField(default=1)),
                ("nights_count", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        limit_choices_to={"role": "agent"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="created_itinerary_trips",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="itinerary_trips",
                        to="accounts.chatroom",
                    ),
                ),
            ],
            options={
                "verbose_name": "Itinerary Trip",
                "verbose_name_plural": "Itinerary Trips",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddField(
            model_name="chatmessage",
            name="attachment",
            field=models.FileField(
                blank=True,
                help_text="File attachment (e.g. itinerary PDF) sent with this message.",
                null=True,
                upload_to=accounts.models.chat_attachment_path,
            ),
        ),
        migrations.AddField(
            model_name="itineraryitem",
            name="trip",
            field=models.ForeignKey(
                blank=True,
                help_text="When set, this item is part of a day/night trip batch.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="items",
                to="accounts.itinerarytrip",
            ),
        ),
        migrations.AddField(
            model_name="itineraryitem",
            name="day_number",
            field=models.PositiveSmallIntegerField(
                default=1,
                help_text="1-based day index (Day 1, Day 2, etc.).",
            ),
        ),
        migrations.AddField(
            model_name="itineraryitem",
            name="is_night",
            field=models.BooleanField(
                default=False,
                help_text="True = Night period (e.g. Night 1), False = Day period.",
            ),
        ),
        migrations.AlterModelOptions(
            name="itineraryitem",
            options={
                "ordering": ["trip_id", "day_number", "is_night", "time_label", "created_at"],
                "verbose_name": "Itinerary Item",
                "verbose_name_plural": "Itinerary Items",
            },
        ),
    ]

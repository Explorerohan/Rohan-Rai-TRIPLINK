# Generated manually for chat itinerary items

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0023_expo_push_token"),
    ]

    operations = [
        migrations.CreateModel(
            name="ItineraryItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("travel_date", models.DateField()),
                ("day_label", models.CharField(blank=True, help_text="Day label, e.g. Day 1 / Monday", max_length=50)),
                ("time_label", models.CharField(help_text="Time text, e.g. 09:00 AM", max_length=50)),
                ("place", models.CharField(max_length=200)),
                ("activity", models.CharField(max_length=300)),
                ("food_name", models.CharField(blank=True, max_length=150)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        limit_choices_to={"role": "agent"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="created_itinerary_items",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="itinerary_items",
                        to="accounts.chatroom",
                    ),
                ),
            ],
            options={
                "verbose_name": "Itinerary Item",
                "verbose_name_plural": "Itinerary Items",
                "ordering": ["travel_date", "time_label", "created_at"],
            },
        ),
    ]

from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0025_itinerary_trip_chat_attachment"),
    ]

    operations = [
        migrations.AddField(
            model_name="package",
            name="latitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text="Latitude for map pin (e.g., 48.856613)",
                max_digits=9,
                null=True,
                validators=[
                    django.core.validators.MinValueValidator(-90),
                    django.core.validators.MaxValueValidator(90),
                ],
            ),
        ),
        migrations.AddField(
            model_name="package",
            name="longitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text="Longitude for map pin (e.g., 2.352222)",
                max_digits=9,
                null=True,
                validators=[
                    django.core.validators.MinValueValidator(-180),
                    django.core.validators.MaxValueValidator(180),
                ],
            ),
        ),
    ]

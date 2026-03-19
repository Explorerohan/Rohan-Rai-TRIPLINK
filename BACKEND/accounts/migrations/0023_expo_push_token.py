# Generated manually for Expo push notifications

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0022_add_deal_model"),
    ]

    operations = [
        migrations.CreateModel(
            name="ExpoPushToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(help_text="ExponentPushToken[...] from expo-notifications", max_length=512, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="expo_push_tokens",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Expo Push Token",
                "verbose_name_plural": "Expo Push Tokens",
                "ordering": ["-updated_at"],
            },
        ),
    ]

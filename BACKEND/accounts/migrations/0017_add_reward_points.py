# Generated manually for reward points feature

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0016_packagebookmark"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="reward_points",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Points earned from completed trips (10% of booking total)",
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="rewards_awarded",
            field=models.BooleanField(
                default=False,
                help_text="Whether reward points (10% of total) have been credited for this completed trip",
            ),
        ),
    ]

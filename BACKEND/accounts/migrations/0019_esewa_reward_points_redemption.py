from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0018_booking_reward_points_given"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="reward_points_used",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Reward points redeemed/used as discount for this booking.",
            ),
        ),
        migrations.AddField(
            model_name="esewapaymentsession",
            name="payable_amount",
            field=models.DecimalField(
                max_digits=12,
                decimal_places=2,
                default=0,
                help_text="Amount to actually pay via eSewa after applying any reward points.",
            ),
        ),
        migrations.AddField(
            model_name="esewapaymentsession",
            name="reward_points_used",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Reward points applied as discount for this payment session.",
            ),
        ),
    ]


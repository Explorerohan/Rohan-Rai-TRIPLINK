from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0026_package_coordinates"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="esewa_refund_reference",
            field=models.CharField(
                blank=True,
                help_text="eSewa reference after refund (e.g. ref_id from status API).",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="refunded_at",
            field=models.DateTimeField(
                blank=True,
                help_text="When the payment was marked refunded (eSewa or internal ledger).",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="booking",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("paid", "Paid"),
                    ("failed", "Failed"),
                    ("refund_pending", "Refund pending"),
                    ("refunded", "Refunded"),
                ],
                default="paid",
                max_length=20,
            ),
        ),
    ]

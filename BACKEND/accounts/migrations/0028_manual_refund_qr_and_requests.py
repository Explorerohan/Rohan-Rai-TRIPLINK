from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0027_booking_refund_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="refund_qr",
            field=models.ImageField(
                blank=True,
                help_text="eSewa (or other) QR for receiving manual refunds when cancelling paid bookings.",
                null=True,
                upload_to="profiles/refund_qr/",
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
                    ("refund_declined", "Refund declined"),
                    ("refunded", "Refunded"),
                ],
                default="paid",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="RefundRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("pending", "Pending"), ("completed", "Completed"), ("cancelled", "Cancelled")], default="pending", max_length=20)),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("payment_method", models.CharField(blank=True, max_length=20)),
                ("payment_reference", models.CharField(blank=True, max_length=120)),
                ("transaction_uuid", models.CharField(blank=True, max_length=120)),
                ("traveler_email", models.EmailField(blank=True, max_length=254)),
                ("traveler_name", models.CharField(blank=True, max_length=200)),
                ("package_title", models.CharField(blank=True, max_length=200)),
                ("trip_start_date", models.DateField(blank=True, null=True)),
                ("traveler_qr_snapshot", models.ImageField(blank=True, null=True, upload_to="refund_requests/snapshots/")),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "booking",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="refund_request",
                        to="accounts.booking",
                    ),
                ),
                (
                    "package",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="refund_requests",
                        to="accounts.package",
                    ),
                ),
                (
                    "resolved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="refund_requests_resolved",
                        to="accounts.user",
                    ),
                ),
                (
                    "traveler",
                    models.ForeignKey(
                        limit_choices_to={"role": "traveler"},
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="refund_requests",
                        to="accounts.user",
                    ),
                ),
            ],
            options={
                "verbose_name": "Refund Request",
                "verbose_name_plural": "Refund Requests",
                "ordering": ["-created_at"],
            },
        ),
    ]

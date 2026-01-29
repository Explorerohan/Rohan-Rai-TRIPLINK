# Generated manually for trip date fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_alter_booking_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='package',
            name='trip_start_date',
            field=models.DateField(blank=True, help_text='Trip start date (from when)', null=True),
        ),
        migrations.AddField(
            model_name='package',
            name='trip_end_date',
            field=models.DateField(blank=True, help_text='Trip end date (to when)', null=True),
        ),
    ]

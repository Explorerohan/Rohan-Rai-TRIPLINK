# Generated manually for hotel stay calendar fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0035_itineraryitem_place_blank"),
    ]

    operations = [
        migrations.AddField(
            model_name="itineraryhotelstay",
            name="stay_check_in_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="itineraryhotelstay",
            name="stay_check_out_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]

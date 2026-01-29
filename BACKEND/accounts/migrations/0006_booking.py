# Generated manually for Booking model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_agentprofile_profile_picture_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Booking',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('confirmed', 'Confirmed'), ('cancelled', 'Cancelled')], default='confirmed', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('package', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bookings', to='accounts.package')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bookings', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Booking',
                'verbose_name_plural': 'Bookings',
                'ordering': ['-created_at'],
            },
        ),
    ]

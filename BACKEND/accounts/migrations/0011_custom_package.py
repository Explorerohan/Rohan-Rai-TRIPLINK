# Generated manually for CustomPackage (traveler-created custom trip packages)

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def custom_package_image_path(instance, filename):
    if instance.pk:
        return f'custom_packages/{instance.user_id}/{instance.pk}/{filename}'
    return f'custom_packages/{instance.user_id}/temp/{filename}'


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_remove_package_rating_agentprofile_rating_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomPackage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(help_text='Package title (e.g., PARIS)', max_length=200)),
                ('location', models.CharField(help_text='Location name (e.g., Paris)', max_length=200)),
                ('country', models.CharField(help_text='Country name (e.g., France)', max_length=100)),
                ('description', models.TextField(help_text='Detailed description of the package')),
                ('price_per_person', models.DecimalField(decimal_places=2, help_text='Price in Rs.', max_digits=10)),
                ('duration_days', models.PositiveIntegerField(default=7, help_text='Number of days')),
                ('duration_nights', models.PositiveIntegerField(default=6, help_text='Number of nights')),
                ('trip_start_date', models.DateField(blank=True, help_text='Trip start date', null=True)),
                ('trip_end_date', models.DateField(blank=True, help_text='Trip end date', null=True)),
                ('main_image', models.ImageField(blank=True, null=True, upload_to='custom_packages/%Y/%m/')),
                ('additional_notes', models.TextField(
                    blank=True,
                    help_text='Additional things to consider on this trip (e.g., visa, weather, packing)',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    limit_choices_to={'role': 'traveler'},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='custom_packages',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('features', models.ManyToManyField(blank=True, related_name='custom_packages', to='accounts.packagefeature')),
            ],
            options={
                'verbose_name': 'Custom Package',
                'verbose_name_plural': 'Custom Packages',
                'ordering': ['-created_at'],
            },
        ),
    ]

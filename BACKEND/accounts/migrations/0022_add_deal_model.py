# Generated migration for Deal model

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0021_notification_type'),
    ]

    operations = [
        migrations.CreateModel(
            name='Deal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(blank=True, help_text='Optional label, e.g. Summer Sale', max_length=200)),
                ('discount_percent', models.PositiveIntegerField(help_text='Discount percentage 1-99, e.g. 20 for 20% off')),
                ('valid_from', models.DateTimeField(help_text='When deal becomes active')),
                ('valid_until', models.DateTimeField(help_text='When deal expires')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('agent', models.ForeignKey(
                    limit_choices_to={'role': 'agent'},
                    on_delete=models.deletion.CASCADE,
                    related_name='deals',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('package', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='deals',
                    to='accounts.package',
                )),
            ],
            options={
                'verbose_name': 'Deal',
                'verbose_name_plural': 'Deals',
                'ordering': ['-valid_until'],
            },
        ),
    ]

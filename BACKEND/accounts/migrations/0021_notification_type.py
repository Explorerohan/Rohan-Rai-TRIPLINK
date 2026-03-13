# Generated migration for notification_type field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0020_add_notification_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('alert', 'Alert'),
                    ('emergency', 'Emergency'),
                    ('rule_violation', 'Rule Violation'),
                    ('info', 'Information'),
                    ('update', 'Update'),
                    ('promotion', 'Promotion'),
                    ('general', 'General'),
                ],
                default='general',
                help_text='Type of notification - determines icon shown to user.',
                max_length=32,
            ),
        ),
    ]

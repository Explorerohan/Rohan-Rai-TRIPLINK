# Generated migration for ChatRoom and ChatMessage (real-time chat system)

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_custom_package'),
    ]

    operations = [
        migrations.CreateModel(
            name='ChatRoom',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('agent', models.ForeignKey(
                    limit_choices_to={'role': 'agent'},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='chat_rooms_as_agent',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('traveler', models.ForeignKey(
                    limit_choices_to={'role': 'traveler'},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='chat_rooms_as_traveler',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Chat Room',
                'verbose_name_plural': 'Chat Rooms',
                'ordering': ['-updated_at'],
                'unique_together': {('traveler', 'agent')},
            },
        ),
        migrations.CreateModel(
            name='ChatMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField()),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('room', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='messages',
                    to='accounts.chatroom',
                )),
                ('sender', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='chat_messages_sent',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Chat Message',
                'verbose_name_plural': 'Chat Messages',
                'ordering': ['created_at'],
            },
        ),
    ]

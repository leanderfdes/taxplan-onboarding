from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assessment', '0009_usersession_violation_counters'),
    ]

    operations = [
        migrations.AddField(
            model_name='proctoringsnapshot',
            name='snapshot_id',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True),
        ),
        migrations.AddConstraint(
            model_name='proctoringsnapshot',
            constraint=models.UniqueConstraint(fields=('session', 'snapshot_id'), name='uniq_snapshot_per_session_id'),
        ),
    ]

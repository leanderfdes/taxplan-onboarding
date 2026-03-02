import os
import django
import sys

# Set up Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'taxplan_backend.settings')
django.setup()

from assessment.models import TestType

def seed_test_types():
    test_types = [
        {'name': 'GST', 'slug': 'gst'},
        {'name': 'Income Tax', 'slug': 'income-tax'},
        {'name': 'TDS', 'slug': 'tds'},
        {'name': 'Professional Tax', 'slug': 'professional-tax'},
    ]

    for data in test_types:
        obj, created = TestType.objects.get_or_create(slug=data['slug'], defaults={'name': data['name']})
        if created:
            print(f"Created TestType: {obj.name}")
        else:
            print(f"TestType already exists: {obj.name}")

if __name__ == '__main__':
    seed_test_types()

from django.contrib import admin
from .models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['email', 'get_full_name', 'phone_number', 'is_onboarded', 'is_verified', 'created_at']
    list_filter = ['is_onboarded', 'is_verified', 'is_active', 'created_at']
    search_fields = ['email', 'first_name', 'last_name', 'phone_number']
    readonly_fields = ['id', 'google_id', 'created_at', 'updated_at']
    ordering = ['-created_at']
    
    fieldsets = (
        ('Account Info', {
            'fields': ('id', 'email', 'google_id')
        }),
        ('Personal Details', {
            'fields': (
                ('first_name', 'middle_name', 'last_name'),
                'age', 'dob', 'phone_number', 
                ('address_line1', 'address_line2'),
                ('city', 'state', 'pincode'),
            )
        }),
        ('Status', {
            'fields': ('is_active', 'is_onboarded', 'is_verified', 'is_staff', 'is_superuser')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

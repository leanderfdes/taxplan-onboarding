import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication"""
    
    def create_user(self, email, google_id=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, google_id=google_id, **extra_fields)
        user.set_unusable_password()  
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_verified', True)
        extra_fields.setdefault('is_onboarded', True)
        
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    """Custom User model for TaxplanAdvisor consultants"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    google_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    
    # Onboarding fields
    first_name = models.CharField(max_length=100, blank=True)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    
    age = models.PositiveIntegerField(null=True, blank=True)
    dob = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    
    # Address Split
    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=20, blank=True)
    

    # Practice Details
    PRACTICE_TYPE_CHOICES = [
        ('Individual', 'Individual'),
    ]
    practice_type = models.CharField(max_length=50, choices=PRACTICE_TYPE_CHOICES, null=True, blank=True)
    years_of_experience = models.PositiveIntegerField(null=True, blank=True)
    
    # Status fields
    is_verified = models.BooleanField(default=False)
    is_onboarded = models.BooleanField(default=False)
    has_accepted_declaration = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return self.email
    
    def get_full_name(self):
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(filter(None, parts)) or self.email
    
    def get_short_name(self):
        return self.first_name if self.first_name else self.email.split('@')[0]





class ConsultantDocument(models.Model):
    DOCUMENT_TYPES = [
        ('Qualification', 'Qualification Degree'),
        ('Certificate', 'Certificate'),
        ('bachelors_degree', "Bachelor's Degree"),
        ('masters_degree', "Master's Degree"),
        ('certificate', 'Certificate (Additional)'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    title = models.CharField(max_length=255, blank=True)
    file = models.FileField(upload_to='consultant_documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'consultant_documents'
        verbose_name = 'Consultant Document'
        verbose_name_plural = 'Consultant Documents'
        ordering = ['-uploaded_at']


class IdentityDocument(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='identity_documents')
    file_path = models.CharField(max_length=500)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    # Gemini Verification Fields
    document_type = models.CharField(max_length=100, blank=True, null=True, help_text="Type of document identified by Gemini (e.g., Aadhaar, PAN)")
    verification_status = models.CharField(max_length=50, blank=True, null=True, help_text="Verification status from Gemini (e.g., Verified, Invalid)")
    gemini_raw_response = models.TextField(blank=True, null=True, help_text="Raw JSON response from Gemini")

    class Meta:
        db_table = 'identity_documents'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.user.email} - Identity Document"


class ConsultantCredential(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='credentials')
    username = models.CharField(max_length=150, unique=True)
    password = models.CharField(max_length=255)  
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'consultant_credentials'
        verbose_name = 'Consultant Credential'
        verbose_name_plural = 'Consultant Credentials'

    def __str__(self):
        return f"Credentials for {self.user.email}"

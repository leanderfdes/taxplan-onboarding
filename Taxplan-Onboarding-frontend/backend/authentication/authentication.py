import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import User


def generate_jwt_token(user):
    """Generate JWT token for a user with 3-hour expiry"""
    payload = {
        'user_id': str(user.id),
        'email': user.email,
        'exp': datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS),
        'iat': datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm='HS256')
    return token


def decode_jwt_token(token):
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationFailed('Token has expired')
    except jwt.InvalidTokenError:
        raise AuthenticationFailed('Invalid token')


class JWTAuthentication(BaseAuthentication):
    """Custom JWT Authentication for DRF"""
    
    def authenticate(self, request):
        # Check for token in cookies first, then Authorization header
        token = request.COOKIES.get('jwt_token')
        
        if not token:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return None
        
        try:
            payload = decode_jwt_token(token)
            user = User.objects.get(id=payload['user_id'])
            return (user, token)
        except User.DoesNotExist:
            raise AuthenticationFailed('User not found')
        except Exception as e:
            raise AuthenticationFailed(str(e))

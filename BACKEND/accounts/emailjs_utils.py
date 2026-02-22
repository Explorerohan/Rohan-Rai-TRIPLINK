"""
EmailJS utility functions for sending emails via EmailJS API
"""
import random
from django.conf import settings
import requests


def generate_otp():
    """Generate a 4-digit OTP"""
    return str(random.randint(1000, 9999))


def send_otp_email(email, otp):
    """
    Send OTP email using EmailJS API
    
    Args:
        email: Recipient email address
        otp: OTP code to send
        
    Returns:
        dict: Response from EmailJS API
        
    Raises:
        Exception: If email sending fails
    """
    # Validate configuration
    service_id = getattr(settings, 'EMAILJS_SERVICE_ID', None)
    template_id = getattr(settings, 'EMAILJS_TEMPLATE_ID', None)
    public_key = getattr(settings, 'EMAILJS_PUBLIC_KEY', None)
    private_key = getattr(settings, 'EMAILJS_PRIVATE_KEY', None)
    api_url = getattr(settings, 'EMAILJS_API_URL', 'https://api.emailjs.com/api/v1.0/email/send')
    
    if not all([service_id, template_id, public_key, private_key]):
        raise ValueError("EmailJS configuration is missing. Please check your settings.")
    
    # Prepare template parameters
    template_params = {
        'email': email,
        'passcode': otp,
        'time': str(5 * 60),  # 5 minutes expiration time
    }
    
    # Prepare request body (EmailJS strict mode requires accessToken in body)
    request_body = {
        'service_id': service_id,
        'template_id': template_id,
        'user_id': public_key,
        'template_params': template_params,
        'accessToken': private_key,  # Required for strict mode
    }
    
    try:
        response = requests.post(
            api_url,
            headers={'Content-Type': 'application/json'},
            json=request_body,
            timeout=10
        )
        
        if not response.ok:
            error_message = "Failed to send OTP email."
            try:
                error_data = response.json()
                error_message = error_data.get('message', error_data.get('text', error_message))
            except:
                error_message = response.text or f"HTTP {response.status_code}: {response.reason}"
            
            raise Exception(error_message)
        
        return {'status': response.status_code, 'text': response.text}
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to send OTP email. Network error: {str(e)}")


def send_agent_credentials_email(email, password, login_url, agent_name=None):
    """
    Send new agent account credentials via EmailJS.

    Args:
        email: Agent email address
        password: Initial password created by admin
        login_url: Web login URL for admin/agent portal

    Returns:
        dict: Response from EmailJS API

    Raises:
        Exception: If email sending fails
    """
    service_id = (
        getattr(settings, 'EMAILJS_AGENT_CREDENTIALS_SERVICE_ID', None)
        or getattr(settings, 'EMAILJS_SERVICE_ID', None)
    )
    template_id = getattr(settings, 'EMAILJS_AGENT_CREDENTIALS_TEMPLATE_ID', None)
    public_key = (
        getattr(settings, 'EMAILJS_AGENT_CREDENTIALS_PUBLIC_KEY', None)
        or getattr(settings, 'EMAILJS_PUBLIC_KEY', None)
    )
    private_key = (
        getattr(settings, 'EMAILJS_AGENT_CREDENTIALS_PRIVATE_KEY', None)
        or getattr(settings, 'EMAILJS_PRIVATE_KEY', None)
    )
    api_url = (
        getattr(settings, 'EMAILJS_AGENT_CREDENTIALS_API_URL', None)
        or getattr(settings, 'EMAILJS_API_URL', 'https://api.emailjs.com/api/v1.0/email/send')
    )

    if not all([service_id, template_id, public_key, private_key]):
        raise ValueError(
            "Agent credentials email configuration is missing. "
            "Set EMAILJS_AGENT_CREDENTIALS_TEMPLATE_ID (and service/keys if separate)."
        )

    template_params = {
        'email': email,
        'agent_name': agent_name or email.split('@')[0],
        'agent_email': email,
        'temporary_password': password,
        'login_url': login_url,
        'app_name': getattr(settings, 'EMAIL_APP_NAME', 'TRIPLINK'),
        'company_name': getattr(settings, 'EMAIL_COMPANY_NAME', 'TRIPLINK'),
        'support_email': getattr(settings, 'EMAIL_SUPPORT_ADDRESS', ''),
        'system_name': getattr(settings, 'EMAIL_SYSTEM_NAME', 'TRIPLINK'),
        'contact_information': getattr(settings, 'EMAIL_CONTACT_INFORMATION', ''),
    }

    request_body = {
        'service_id': service_id,
        'template_id': template_id,
        'user_id': public_key,
        'template_params': template_params,
        'accessToken': private_key,
    }

    try:
        response = requests.post(
            api_url,
            headers={'Content-Type': 'application/json'},
            json=request_body,
            timeout=10
        )

        if not response.ok:
            error_message = "Failed to send agent credentials email."
            try:
                error_data = response.json()
                error_message = error_data.get('message', error_data.get('text', error_message))
            except Exception:
                error_message = response.text or f"HTTP {response.status_code}: {response.reason}"
            raise Exception(error_message)

        return {'status': response.status_code, 'text': response.text}
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to send agent credentials email. Network error: {str(e)}")


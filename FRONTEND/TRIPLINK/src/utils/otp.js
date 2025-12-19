// Debug: Log environment variables (remove in production)
console.log("EmailJS Config Check:", {
  SERVICE_ID: process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID ? "✓ Set" : "✗ Missing",
  TEMPLATE_ID: process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID ? "✓ Set" : "✗ Missing",
  PUBLIC_KEY: process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY ? "✓ Set" : "✗ Missing",
  PRIVATE_KEY: process.env.EXPO_PUBLIC_EMAILJS_PRIVATE_KEY ? "✓ Set" : "✗ Missing",
});

const SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID || "service_drzeno8";
const TEMPLATE_ID = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID || "template_7jxk7ff";
const PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY || "P4yjMlbQu_ckrhA3-";
// For now, use the private key directly if env var is not loaded
const PRIVATE_KEY = process.env.EXPO_PUBLIC_EMAILJS_PRIVATE_KEY || "4ytfBo3yCFYNV0D_unE_S";
const EMAILJS_API_URL = "https://api.emailjs.com/api/v1.0/email/send";

export const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

export const sendOtpEmail = async (email, otp) => {
  // Validate configuration
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error("EmailJS configuration is missing. Please check your environment variables.");
  }

  // In strict mode, private key is required for non-browser applications
  if (!PRIVATE_KEY || PRIVATE_KEY.trim() === "") {
    throw new Error(
      "EmailJS Private Key is required for React Native. " +
      "Get it from https://dashboard.emailjs.com/admin/account and set EXPO_PUBLIC_EMAILJS_PRIVATE_KEY in your environment variables."
    );
  }

  const templateParams = {
    email,
    passcode: otp,
    time: new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString(),
  };

  try {
    // Use EmailJS REST API directly (works in React Native)
    // In strict mode, EmailJS requires accessToken in the request body, NOT in Authorization header
    const headers = {
      "Content-Type": "application/json",
    };

    // EmailJS strict mode requires accessToken in the body
    const requestBody = {
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: PUBLIC_KEY,
      template_params: templateParams,
      accessToken: PRIVATE_KEY, // Required for strict mode - must be in body, not header
    };

    // Debug: Log what we're sending (remove sensitive data in production)
    console.log("EmailJS Request Debug:", {
      hasPrivateKey: !!PRIVATE_KEY,
      privateKeyLength: PRIVATE_KEY ? PRIVATE_KEY.length : 0,
      privateKeyStart: PRIVATE_KEY ? PRIVATE_KEY.substring(0, 5) + "..." : "none",
      serviceId: SERVICE_ID,
      templateId: TEMPLATE_ID,
      publicKey: PUBLIC_KEY,
      hasAccessToken: !!requestBody.accessToken,
    });

    const response = await fetch(EMAILJS_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = "Failed to send OTP email.";
      
      // Try to parse error message
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.text || errorMessage;
      } catch {
        errorMessage = responseText || `HTTP ${response.status}: ${response.statusText}`;
      }
      
      // Add helpful hints based on status code
      if (response.status === 400) {
        errorMessage += " Check that your template parameters match your EmailJS template variables (email, passcode, time).";
      } else if (response.status === 401 || response.status === 403) {
        if (errorMessage.includes("private key")) {
          errorMessage += " Get your Private Key from https://dashboard.emailjs.com/admin/account and set it as EXPO_PUBLIC_EMAILJS_PRIVATE_KEY in your .env file.";
        } else {
          errorMessage += " Check your PUBLIC_KEY and PRIVATE_KEY in your EmailJS account settings.";
        }
      } else if (response.status === 404) {
        errorMessage += " Service ID or Template ID not found. Verify them in your EmailJS dashboard.";
      }
      
      console.error("EmailJS send error:", response.status, errorMessage);
      throw new Error(errorMessage);
    }

    console.log("EmailJS send success:", responseText || "Email sent successfully");
    return { status: response.status, text: responseText };
  } catch (error) {
    console.error("EmailJS send error:", error);
    
    // If it's already our formatted error, re-throw it
    if (error.message && error.message !== "Failed to send OTP email.") {
      throw error;
    }
    
    // Network or other errors
    throw new Error(
      error.message || 
      "Failed to send OTP email. Please check your network connection and EmailJS configuration."
    );
  }
};

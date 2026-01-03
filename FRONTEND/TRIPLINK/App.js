import React, { useState } from "react";
import { SafeAreaView } from "react-native";
import OnboardingScreen from "./src/screens/onboarding/OnboardingScreen";
import LoginScreen from "./src/screens/login/LoginScreen";
import { SignupScreen } from "./src/screens/signup";
import { ForgotPasswordScreen } from "./src/screens/forgotPassword";
import { VerificationScreen } from "./src/screens/verification";
import { DetailsScreen } from "./src/screens/details";
import HomeScreen from "./src/screens/home/HomeScreen";
import ProfileScreen, { EditProfileScreen } from "./src/screens/profile";
import { generateOtp, sendOtpEmail } from "./src/utils/otp";

export default function App() {
  const [screen, setScreen] = useState("onboarding");
  const [session, setSession] = useState(null);
  const [lastEmail, setLastEmail] = useState("");
  const [otpSession, setOtpSession] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);

  const goToLogin = () => setScreen("login");
  const goToSignup = () => setScreen("signup");
  const goToForgot = () => setScreen("forgot");
  const handleLoginSuccess = (auth) => {
    setSession(auth);
    setScreen("home");
  };
  const handleSignupComplete = () => setScreen("login");
  const handleForgotComplete = (payload) => {
    setLastEmail(payload.email);
    setOtpSession(payload);
    setScreen("verification");
  };
  const handleVerifyComplete = () => {
    const email = otpSession?.email || lastEmail;
    if (email) {
      setSession({
        access: null,
        refresh: null,
        user: { email, role: "traveler" },
      });
      setScreen("home");
    } else {
      setScreen("login");
    }
  };

  const handleTripPress = (trip) => {
    setSelectedTrip(trip);
    setScreen("details");
  };

  const handleBookTrip = (trip) => {
    // You can wire payment/booking here; for now, return to home.
    setScreen("home");
  };

  const handleLogout = async () => {
    // Call logout endpoint if session exists
    if (session?.access) {
      try {
        const API_BASE = "http://192.168.18.6:8000";
        const LOGOUT_ENDPOINT = `${API_BASE}/api/auth/logout/`;
        await fetch(LOGOUT_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access}`,
          },
        });
      } catch (error) {
        // Even if logout API call fails, proceed with client-side logout
        console.log("Logout API call failed:", error);
      }
    }
    // Clear session and navigate to login
    setSession(null);
    setScreen("login");
  };

  const handleResendOtp = async () => {
    if (!otpSession) return;
    if (otpSession.resendsUsed >= otpSession.maxResends) return;
    const nextOtp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    try {
      await sendOtpEmail(otpSession.email, nextOtp);
      setOtpSession((prev) => ({
        ...prev,
        otp: nextOtp,
        expiresAt,
        resendsUsed: (prev?.resendsUsed || 0) + 1,
      }));
    } catch (e) {
      // Optionally surface error to verification screen via lifted state
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {screen === "onboarding" && (
        <OnboardingScreen onLoginPress={goToLogin} onSignupPress={goToSignup} />
      )}
      {screen === "login" && (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onForgotPress={goToForgot}
          onSignupPress={goToSignup}
        />
      )}
      {screen === "forgot" && (
        <ForgotPasswordScreen
          onBack={goToLogin}
          onResetComplete={handleForgotComplete}
        />
      )}
      {screen === "verification" && (
        <VerificationScreen
          email={otpSession?.email || lastEmail}
          expectedCode={otpSession?.otp}
          expiresAt={otpSession?.expiresAt}
          resendsUsed={otpSession?.resendsUsed ?? 0}
          maxResends={otpSession?.maxResends ?? 3}
          onBack={goToForgot}
          onVerify={handleVerifyComplete}
          onResend={handleResendOtp}
        />
      )}
      {screen === "signup" && (
        <SignupScreen
          onSignupComplete={handleSignupComplete}
          onBackToLogin={goToLogin}
        />
      )}
      {screen === "home" && (
        <HomeScreen
          session={session}
          onTripPress={handleTripPress}
          onProfilePress={() => setScreen("profile")}
        />
      )}
      {screen === "details" && (
        <DetailsScreen
          trip={selectedTrip}
          onBack={() => setScreen("home")}
          onBook={handleBookTrip}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen
          key={profileRefreshKey}
          session={session}
          onBack={() => setScreen("home")}
          onEdit={() => setScreen("editProfile")}
          onLogout={handleLogout}
        />
      )}
      {screen === "editProfile" && (
        <EditProfileScreen
          session={session}
          onBack={() => setScreen("profile")}
          onSave={(updatedProfile) => {
            setProfileRefreshKey((prev) => prev + 1);
            setScreen("profile");
          }}
        />
      )}
    </SafeAreaView>
  );
}

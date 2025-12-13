import React, { useState } from "react";
import { SafeAreaView } from "react-native";
import OnboardingScreen from "./src/screens/onboarding/OnboardingScreen";
import LoginScreen from "./src/screens/login/LoginScreen";
import { SignupScreen } from "./src/screens/signup";
import { ForgotPasswordScreen } from "./src/screens/forgotPassword";
import { VerificationScreen } from "./src/screens/verification";
import HomeScreen from "./src/screens/home/HomeScreen";

export default function App() {
  const [screen, setScreen] = useState("onboarding");
  const [session, setSession] = useState(null);
  const [lastEmail, setLastEmail] = useState("");

  const goToLogin = () => setScreen("login");
  const goToSignup = () => setScreen("signup");
  const goToForgot = () => setScreen("forgot");
  const handleLoginSuccess = (auth) => {
    setSession(auth);
    setScreen("home");
  };
  const handleSignupComplete = () => setScreen("login");
  const handleForgotComplete = (email) => {
    setLastEmail(email);
    setScreen("verification");
  };
  const handleVerifyComplete = () => setScreen("login");

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
          email={lastEmail}
          onBack={goToForgot}
          onVerify={handleVerifyComplete}
          onResend={() => setScreen("forgot")}
        />
      )}
      {screen === "signup" && (
        <SignupScreen
          onSignupComplete={handleSignupComplete}
          onBackToLogin={goToLogin}
        />
      )}
      {screen === "home" && <HomeScreen session={session} />}
    </SafeAreaView>
  );
}

import React, { useState } from "react";
import { SafeAreaView } from "react-native";
import OnboardingScreen from "./src/screens/onboarding/OnboardingScreen";
import LoginScreen from "./src/screens/login/LoginScreen";

export default function App() {
  const [screen, setScreen] = useState("onboarding");

  const goToLogin = () => setScreen("login");
  const goToSignup = () => setScreen("login"); // placeholder until signup screen exists

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {screen === "onboarding" ? (
        <OnboardingScreen onLoginPress={goToLogin} onSignupPress={goToSignup} />
      ) : (
        <LoginScreen />
      )}
    </SafeAreaView>
  );
}

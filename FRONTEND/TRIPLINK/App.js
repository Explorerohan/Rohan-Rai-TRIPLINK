import React, { useState } from "react";
import { SafeAreaView } from "react-native";
import OnboardingScreen from "./src/screens/onboarding/OnboardingScreen";
import LoginScreen from "./src/screens/login/LoginScreen";
import HomeScreen from "./src/screens/home/HomeScreen";

export default function App() {
  const [screen, setScreen] = useState("onboarding");
  const [session, setSession] = useState(null);

  const goToLogin = () => setScreen("login");
  const goToSignup = () => setScreen("login"); // placeholder until signup exists
  const handleLoginSuccess = (auth) => {
    setSession(auth);
    setScreen("home");
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {screen === "onboarding" && (
        <OnboardingScreen onLoginPress={goToLogin} onSignupPress={goToSignup} />
      )}
      {screen === "login" && <LoginScreen onLoginSuccess={handleLoginSuccess} />}
      {screen === "home" && <HomeScreen session={session} />}
    </SafeAreaView>
  );
}

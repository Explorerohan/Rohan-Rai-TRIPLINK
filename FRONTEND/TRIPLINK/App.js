import React from "react";
import { SafeAreaView } from "react-native";
import OnboardingScreen from "./src/screens/onboarding/OnboardingScreen";

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <OnboardingScreen />
    </SafeAreaView>
  );
}

import React, { useState, useCallback, useEffect } from "react";
import { SafeAreaView, ActivityIndicator, View, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OnboardingScreen from "./src/screens/onboarding/OnboardingScreen";
import LoginScreen from "./src/screens/login/LoginScreen";
import { SignupScreen } from "./src/screens/signup";
import { ForgotPasswordScreen } from "./src/screens/forgotPassword";
import { VerificationScreen } from "./src/screens/verification";
import { DetailsScreen } from "./src/screens/details";
import HomeScreen from "./src/screens/home/HomeScreen";
import ProfileScreen, { EditProfileScreen } from "./src/screens/profile";
import { ScheduleScreen } from "./src/screens/schedule";
import SearchScreen from "./src/screens/search/SearchScreen";
import { CreateCustomPackageScreen, CustomPackagesListScreen } from "./src/screens/createCustomPackage";
import { generateOtp, sendOtpEmail } from "./src/utils/otp";
import { createBooking, getProfile, getPackages, getMyBookings } from "./src/utils/api";

const SESSION_STORAGE_KEY = "@triplink_session";

export default function App() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [screen, setScreen] = useState("onboarding");
  const [session, setSession] = useState(null);
  const [lastEmail, setLastEmail] = useState("");
  const [otpSession, setOtpSession] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [packagesRefreshKey, setPackagesRefreshKey] = useState(0);
  // Cached user data loaded at login so screens don't show loading on every switch
  const [userProfile, setUserProfile] = useState(null);
  const [cachedPackages, setCachedPackages] = useState(null);
  const [cachedBookings, setCachedBookings] = useState(null);

  const preloadUserData = useCallback(async (accessToken) => {
    if (!accessToken) return;
    try {
      const [profileRes, packagesRes, bookingsRes] = await Promise.all([
        getProfile(accessToken),
        getPackages({}, accessToken),
        getMyBookings(accessToken),
      ]);
      setUserProfile(profileRes?.data ?? null);
      const rawList = Array.isArray(packagesRes?.data) ? packagesRes.data : packagesRes?.data?.results ?? [];
      setCachedPackages(rawList);
      const rawBookings = bookingsRes?.data;
      const bookingsList = Array.isArray(rawBookings) ? rawBookings : (rawBookings?.results ?? []);
      setCachedBookings(Array.isArray(bookingsList) ? bookingsList : []);
    } catch (e) {
      console.warn("Preload user data failed:", e);
    }
  }, []);

  // Restore session on app load so user stays logged in until they logout
  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (cancelled) return;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.access) {
            setSession(parsed);
            setScreen("home");
            preloadUserData(parsed.access);
          }
        }
      } catch (e) {
        if (!cancelled) console.warn("Restore session failed:", e);
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    };
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const goToLogin = () => setScreen("login");
  const goToSignup = () => setScreen("signup");
  const goToForgot = () => setScreen("forgot");
  const handleLoginSuccess = (auth) => {
    setSession(auth);
    setScreen("home");
    if (auth?.access) {
      preloadUserData(auth.access);
      AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(auth)).catch((e) => console.warn("Save session failed:", e));
    }
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

  const handleBookTrip = async (trip) => {
    if (!session?.access) {
      alert("Please log in to book this package.");
      setScreen("login");
      return;
    }
    const packageId = trip?.packageData?.id ?? trip?.id;
    if (!packageId) {
      alert("Invalid package.");
      return;
    }
    try {
      await createBooking(packageId, session.access);
      alert("Your package has been booked.");
      setPackagesRefreshKey((k) => k + 1);
      setSelectedTrip((prev) => (prev ? { ...prev, user_has_booked: true } : prev));
      // Stay on details screen; button will show "Already booked"
    } catch (err) {
      const message = err?.message || "Booking failed. Please try again.";
      alert(message);
    }
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
    AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {});
    setSession(null);
    setUserProfile(null);
    setCachedPackages(null);
    setCachedBookings(null);
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

  if (!isHydrated) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color="#1f6b2a" />
      </View>
    );
  }

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
          packagesRefreshKey={packagesRefreshKey}
          initialProfile={userProfile}
          initialPackages={cachedPackages}
          onUpdateCachedPackages={setCachedPackages}
          onUpdateCachedProfile={setUserProfile}
          onTripPress={handleTripPress}
          onProfilePress={() => setScreen("profile")}
          onCalendarPress={() => setScreen("schedule")}
          onSearchPress={() => setScreen("search")}
          onPlusPress={() => setScreen("customPackages")}
        />
      )}
      {screen === "search" && (
        <SearchScreen
          session={session}
          initialPackages={cachedPackages}
          onBack={() => setScreen("home")}
          onTripPress={(trip) => {
            setSelectedTrip(trip?.packageData ? { ...trip, id: String(trip.packageData.id) } : trip);
            setScreen("details");
          }}
        />
      )}
      {screen === "schedule" && (
        <ScheduleScreen
          session={session}
          initialBookings={cachedBookings}
          onUpdateCachedBookings={setCachedBookings}
          onBack={() => setScreen("home")}
          onHomePress={() => setScreen("home")}
          onProfilePress={() => setScreen("profile")}
          onPlusPress={() => setScreen("customPackages")}
          onTripPress={(pkg) => {
            if (pkg?.id != null) {
              setSelectedTrip({ id: String(pkg.id) });
              setScreen("details");
            }
          }}
          onScheduleItemPress={(item) => {
            const packageId = item?.booking?.package_id ?? item?.packageData?.id;
            if (packageId != null) {
              setSelectedTrip({ id: String(packageId) });
              setScreen("details");
            }
          }}
        />
      )}
      {screen === "details" && (
        <DetailsScreen
          trip={selectedTrip}
          initialPackageFromCache={cachedPackages}
          session={session}
          onBack={() => setScreen("home")}
          onBook={handleBookTrip}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen
          key={profileRefreshKey}
          session={session}
          initialProfile={userProfile}
          onUpdateCachedProfile={setUserProfile}
          onBack={() => setScreen("home")}
          onEdit={() => setScreen("editProfile")}
          onCalendarPress={() => setScreen("schedule")}
          onLogout={handleLogout}
          onPlusPress={() => setScreen("customPackages")}
        />
      )}
      {screen === "customPackages" && (
        <CustomPackagesListScreen
          session={session}
          onBack={() => setScreen("home")}
          onCreatePress={() => setScreen("createCustomPackage")}
          onHomePress={() => setScreen("home")}
          onCalendarPress={() => setScreen("schedule")}
          onProfilePress={() => setScreen("profile")}
        />
      )}
      {screen === "createCustomPackage" && (
        <CreateCustomPackageScreen
          session={session}
          onBack={() => setScreen("customPackages")}
          onCreateSuccess={() => setScreen("customPackages")}
        />
      )}
      {screen === "editProfile" && (
        <EditProfileScreen
          session={session}
          initialProfile={userProfile}
          onBack={() => setScreen("profile")}
          onSave={(updatedProfile) => {
            if (updatedProfile) setUserProfile(updatedProfile);
            setProfileRefreshKey((prev) => prev + 1);
            setScreen("profile");
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});

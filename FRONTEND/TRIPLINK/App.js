import React, { useState, useCallback, useEffect, useRef } from "react";
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
import MessagesScreen, { ChatDetailScreen } from "./src/screens/messages";
import { ScheduleScreen } from "./src/screens/schedule";
import SearchScreen from "./src/screens/search/SearchScreen";
import { CreateCustomPackageScreen, CustomPackagesListScreen, CustomPackageDetailScreen } from "./src/screens/createCustomPackage";
import { generateOtp, sendOtpEmail } from "./src/utils/otp";
import { createBooking, getProfile, getPackages, getMyBookings, getCustomPackages, createChatRoom, getUnreadCount, markRoomRead, setTokenRefreshHandler, refreshAccessToken } from "./src/utils/api";

const SESSION_STORAGE_KEY = "@triplink_session";

export default function App() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [screen, setScreen] = useState("onboarding");
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const [lastEmail, setLastEmail] = useState("");
  const [otpSession, setOtpSession] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedCustomPackageId, setSelectedCustomPackageId] = useState(null);
  const [customPackageDetailReturnScreen, setCustomPackageDetailReturnScreen] = useState("customPackages");
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [packagesRefreshKey, setPackagesRefreshKey] = useState(0);
  // Cached user data loaded at login so screens don't show loading on every switch
  const [userProfile, setUserProfile] = useState(null);
  const [cachedPackages, setCachedPackages] = useState(null);
  const [cachedBookings, setCachedBookings] = useState(null);
  const [cachedCustomPackages, setCachedCustomPackages] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const preloadUserData = useCallback(async (accessToken) => {
    if (!accessToken) return;
    try {
      const [profileRes, packagesRes, bookingsRes, customPackagesRes] = await Promise.all([
        getProfile(accessToken),
        getPackages({}, accessToken),
        getMyBookings(accessToken),
        getCustomPackages(accessToken),
      ]);
      setUserProfile(profileRes?.data ?? null);
      const rawList = Array.isArray(packagesRes?.data) ? packagesRes.data : packagesRes?.data?.results ?? [];
      setCachedPackages(rawList);
      const rawBookings = bookingsRes?.data;
      const bookingsList = Array.isArray(rawBookings) ? rawBookings : (rawBookings?.results ?? []);
      setCachedBookings(Array.isArray(bookingsList) ? bookingsList : []);
      const rawCustom = customPackagesRes?.data;
      setCachedCustomPackages(Array.isArray(rawCustom) ? rawCustom : []);
    } catch (e) {
      console.warn("Preload user data failed:", e);
    }
  }, []);

  // When access token is refreshed, update session and persist (optionally save new refresh token if backend returns it)
  const handleNewAccessToken = useCallback((access, refresh) => {
    setSession((prev) => {
      if (!prev) return null;
      const next = { ...prev, access, ...(refresh != null && refresh !== "" ? { refresh } : {}) };
      sessionRef.current = next;
      AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const handleRefreshFailed = useCallback(() => {
    AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {});
    setSession(null);
    setUserProfile(null);
    setCachedPackages(null);
    setCachedBookings(null);
    setCachedCustomPackages(null);
    setScreen("login");
  }, []);

  useEffect(() => {
    setTokenRefreshHandler({
      getRefreshToken: () => sessionRef.current?.refresh ?? null,
      onNewAccessToken: handleNewAccessToken,
      onRefreshFailed: handleRefreshFailed,
    });
  }, [handleNewAccessToken, handleRefreshFailed]);

  // Poll unread message count when logged in (for Messages badge)
  const refreshUnreadCount = useCallback(async () => {
    const token = sessionRef.current?.access;
    if (!token) return;
    try {
      const { data } = await getUnreadCount(token);
      const conversations = typeof data?.conversations === "number" ? data.conversations : 0;
      setUnreadCount(conversations);
    } catch (_) {}
  }, []);
  useEffect(() => {
    if (!session?.access) {
      setUnreadCount(0);
      return;
    }
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 3000);
    return () => clearInterval(interval);
  }, [session?.access, refreshUnreadCount]);

  // Proactive refresh: get new access token before it expires (backend access lifetime 30 min, refresh every 25 min)
  useEffect(() => {
    if (!session?.refresh) return;
    const PROACTIVE_REFRESH_MS = 25 * 60 * 1000; // 25 minutes
    const intervalId = setInterval(async () => {
      const refreshToken = sessionRef.current?.refresh;
      if (!refreshToken) return;
      try {
        const tokens = await refreshAccessToken(refreshToken);
        handleNewAccessToken(tokens.access, tokens.refresh);
      } catch (_) {
        // Refresh failed (e.g. refresh token expired); next API call will 401 and trigger handleRefreshFailed
      }
    }, PROACTIVE_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [session?.refresh, handleNewAccessToken]);

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
            sessionRef.current = parsed; // so 401 handler has refresh token before first request
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
    sessionRef.current = auth; // so 401 handler has refresh token before first request
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
    setCachedCustomPackages(null);
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
          onMessagesPress={() => setScreen("messages")}
          onSearchPress={() => setScreen("search")}
          onPlusPress={() => setScreen("customPackages")}
          unreadCount={unreadCount}
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
      {screen === "messages" && (
        <MessagesScreen
          session={session}
          unreadCount={unreadCount}
          onBack={() => setScreen("home")}
          onHomePress={() => setScreen("home")}
          onCalendarPress={() => setScreen("schedule")}
          onPlusPress={() => setScreen("customPackages")}
          onProfilePress={() => setScreen("profile")}
          onChatPress={(chat) => {
            setSelectedChat(chat);
            setScreen("chatDetail");
          }}
        />
      )}
      {screen === "chatDetail" && selectedChat && (
        <ChatDetailScreen
          roomId={selectedChat.roomId ?? selectedChat.id}
          contactName={selectedChat.name ?? "Chat"}
          contactAvatar={selectedChat.avatar}
          otherUserId={selectedChat.other_user_id}
          session={session}
          isActive={true}
          onBack={() => setScreen("messages")}
          onMarkRoomRead={refreshUnreadCount}
          onPackagePress={(packageId) => {
            setCustomPackageDetailReturnScreen("chatDetail");
            setSelectedCustomPackageId(packageId);
            setScreen("customPackageDetail");
          }}
        />
      )}
      {screen === "customPackageDetail" && selectedCustomPackageId != null && (
        <CustomPackageDetailScreen
          packageId={selectedCustomPackageId}
          session={session}
          onBack={() => {
            setSelectedCustomPackageId(null);
            setScreen(customPackageDetailReturnScreen);
          }}
        />
      )}
      {screen === "schedule" && (
        <ScheduleScreen
          session={session}
          initialBookings={cachedBookings}
          onUpdateCachedBookings={setCachedBookings}
          unreadCount={unreadCount}
          onBack={() => setScreen("home")}
          onHomePress={() => setScreen("home")}
          onMessagesPress={() => setScreen("messages")}
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
          onMessageAgent={async (agent) => {
            if (!session?.access) {
              alert("Please log in to message the agent.");
              setScreen("login");
              return;
            }
            try {
              const { data: room } = await createChatRoom({ agent_id: agent.agent_id }, session.access);
              setSelectedChat({
                id: room.id,
                roomId: room.id,
                name: room.other_user_name || agent.full_name,
                avatar: room.other_user_avatar || agent.profile_picture_url,
                other_user_id: room.other_user_id,
              });
              setScreen("chatDetail");
            } catch (err) {
              alert(err?.message || "Failed to start chat.");
            }
          }}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen
          key={profileRefreshKey}
          session={session}
          initialProfile={userProfile}
          onUpdateCachedProfile={setUserProfile}
          unreadCount={unreadCount}
          onBack={() => setScreen("home")}
          onEdit={() => setScreen("editProfile")}
          onCalendarPress={() => setScreen("schedule")}
          onMessagesPress={() => setScreen("messages")}
          onLogout={handleLogout}
          onPlusPress={() => setScreen("customPackages")}
        />
      )}
      {screen === "customPackages" && (
        <CustomPackagesListScreen
          session={session}
          initialCustomPackages={cachedCustomPackages}
          onUpdateCachedCustomPackages={setCachedCustomPackages}
          unreadCount={unreadCount}
          onBack={() => setScreen("home")}
          onCreatePress={() => setScreen("createCustomPackage")}
          onPackagePress={(packageId) => {
            setCustomPackageDetailReturnScreen("customPackages");
            setSelectedCustomPackageId(packageId);
            setScreen("customPackageDetail");
          }}
          onHomePress={() => setScreen("home")}
          onCalendarPress={() => setScreen("schedule")}
          onMessagesPress={() => setScreen("messages")}
          onProfilePress={() => setScreen("profile")}
        />
      )}
      {screen === "createCustomPackage" && (
        <CreateCustomPackageScreen
          session={session}
          onBack={() => setScreen("customPackages")}
          onCreateSuccess={(newPackage) => {
            if (newPackage) setCachedCustomPackages((prev) => [...(prev || []), newPackage]);
            setScreen("customPackages");
          }}
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

import React, { useState, useCallback, useEffect, useRef } from "react";
import { SafeAreaView, ActivityIndicator, View, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OnboardingScreen from "./src/screens/onboarding/OnboardingScreen";
import LoginScreen from "./src/screens/login/LoginScreen";
import { SignupScreen } from "./src/screens/signup";
import { ForgotPasswordScreen } from "./src/screens/forgotPassword";
import { VerificationScreen } from "./src/screens/verification";
import { DetailsScreen } from "./src/screens/details";
import HomeScreen from "./src/screens/home/HomeScreen";
import TopPicksScreen from "./src/screens/home/TopPicksScreen";
import RunningNowScreen from "./src/screens/home/RunningNowScreen";
import ProfileScreen, { BookmarkedScreen, EditProfileScreen, ProfileDetailsScreen, PastTripsScreen, UpcomingTripsScreen, LeaderboardScreen, NotificationsScreen, CancelRefundScreen, ChangePasswordScreen } from "./src/screens/profile";
import MessagesScreen, { ChatDetailScreen } from "./src/screens/messages";
import { ScheduleScreen } from "./src/screens/schedule";
import SearchScreen from "./src/screens/search/SearchScreen";
import { CreateCustomPackageScreen, CustomPackagesListScreen, CustomPackageDetailScreen } from "./src/screens/createCustomPackage";
import { MapScreen } from "./src/screens/map";
import { getProfile, getPackages, getMyBookings, getCustomPackages, createChatRoom, getUnreadCount, getNotificationUnreadCount, markRoomRead, setTokenRefreshHandler, refreshAccessToken, registerExpoPushToken, requestTravelerPasswordReset, verifyTravelerPasswordReset } from "./src/utils/api";
import { registerForExpoPushTokenAsync, subscribeToNotificationResponse, consumeInitialNotificationResponse } from "./src/utils/pushNotifications";
import { LanguageProvider } from "./src/context/LanguageContext";
import { API_BASE } from "./src/config";

const SESSION_STORAGE_KEY = "@triplink_session";

export default function App() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [screen, setScreen] = useState("onboarding");
  const [screenHistory, setScreenHistory] = useState([]);
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const [lastEmail, setLastEmail] = useState("");
  const [otpSession, setOtpSession] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedMapData, setSelectedMapData] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedCustomPackageId, setSelectedCustomPackageId] = useState(null);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [packagesRefreshKey, setPackagesRefreshKey] = useState(0);
  // Cached user data loaded at login so screens don't show loading on every switch
  const [userProfile, setUserProfile] = useState(null);
  const [cachedPackages, setCachedPackages] = useState(null);
  const [cachedBookings, setCachedBookings] = useState(null);
  const [cachedCustomPackages, setCachedCustomPackages] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  const navigate = useCallback(
    (nextScreen, options = {}) => {
      const { resetHistory = false } = options;
      setScreenHistory((prev) => {
        if (resetHistory) return [];
        if (screen === nextScreen) return prev;
        return [...prev, screen];
      });
      setScreen(nextScreen);
    },
    [screen]
  );

  const goToRootScreen = useCallback((targetScreen) => {
    setScreenHistory([]);
    setScreen(targetScreen);
  }, []);

  const goBack = useCallback(() => {
    setScreenHistory((prev) => {
      if (prev.length === 0) {
        Alert.alert("No previous screen", "Where do you want to go?", [
          { text: "Cancel", style: "cancel" },
          { text: "Home", onPress: () => goToRootScreen("home") },
          { text: "Profile", onPress: () => goToRootScreen("profile") },
        ]);
        return prev;
      }
      const previousScreen = prev[prev.length - 1];
      setScreen(previousScreen);
      return prev.slice(0, -1);
    });
  }, [goToRootScreen]);

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
    setScreenHistory([]);
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

  const refreshNotificationUnreadCount = useCallback(async () => {
    const token = sessionRef.current?.access;
    if (!token) return;
    try {
      const { data } = await getNotificationUnreadCount(token);
      const count = typeof data?.count === "number" ? data.count : 0;
      setNotificationUnreadCount(count);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!session?.access) {
      setNotificationUnreadCount(0);
      return;
    }
    refreshNotificationUnreadCount();
    const interval = setInterval(refreshNotificationUnreadCount, 5000);
    return () => clearInterval(interval);
  }, [session?.access, refreshNotificationUnreadCount]);

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

  // Expo push: register token when logged in; open notifications screen when user taps a push
  useEffect(() => {
    let cancelled = false;
    const access = session?.access;
    if (!access) {
      return undefined;
    }

    consumeInitialNotificationResponse((last) => {
      if (cancelled) return;
      const data = last?.notification?.request?.content?.data;
      if (data?.type === "triplink_notification") {
        navigate("notifications");
      }
    }).catch(() => {});

    (async () => {
      try {
        const token = await registerForExpoPushTokenAsync();
        if (!cancelled && token) {
          await registerExpoPushToken(token, access);
        }
      } catch (e) {
        console.warn("Expo push registration failed:", e);
      }
    })();

    const sub = subscribeToNotificationResponse((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.type === "triplink_notification") {
        navigate("notifications");
      }
    });

    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, [session?.access]);

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

  const goToLogin = () => navigate("login", { resetHistory: true });
  const goToSignup = () => navigate("signup");
  const goToForgot = () => navigate("forgot");
  const handleLoginSuccess = (auth) => {
    sessionRef.current = auth; // so 401 handler has refresh token before first request
    setSession(auth);
    setScreenHistory([]);
    setScreen("home");
    if (auth?.access) {
      preloadUserData(auth.access);
      AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(auth)).catch((e) => console.warn("Save session failed:", e));
    }
  };
  const handleSignupComplete = () => navigate("login", { resetHistory: true });
  const handleForgotComplete = (payload) => {
    setLastEmail(payload.email);
    setOtpSession(payload);
    navigate("verification");
  };
  const handleVerifyComplete = () => {
    const email = otpSession?.email || lastEmail;
    if (email) {
      setSession({
        access: null,
        refresh: null,
        user: { email, role: "traveler" },
      });
      setScreenHistory([]);
      setScreen("home");
    } else {
      navigate("login", { resetHistory: true });
    }
  };

  const handleTripPress = (trip) => {
    setSelectedTrip(trip);
    navigate("details");
  };

  const handleBookTrip = useCallback(
    async (bookingResult = null) => {
      if (bookingResult?.requiresLogin) {
        navigate("login", { resetHistory: true });
        return;
      }
      if (!bookingResult?.booking) {
        return;
      }
      setPackagesRefreshKey((k) => k + 1);
      setSelectedTrip((prev) => (prev ? { ...prev, user_has_booked: true } : prev));
      setCachedBookings((prev) => [bookingResult.booking, ...(Array.isArray(prev) ? prev : [])]);

      // Refresh user profile so reward_points remain accurate after redemption
      try {
        const token = sessionRef.current?.access;
        if (token) {
          const res = await getProfile(token);
          setUserProfile(res?.data ?? null);
        }
      } catch (e) {
        console.warn("Failed to refresh profile after booking:", e);
      }
    },
    []
  );

  const handleLogout = async () => {
    // Call logout endpoint if session exists
    if (session?.access) {
      try {
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
    setNotificationUnreadCount(0);
    setScreenHistory([]);
    setScreen("login");
  };

  const handleResendOtp = async () => {
    if (!otpSession) return;
    if (otpSession.resendsUsed >= otpSession.maxResends) return;
    const expiresAt = Date.now() + 5 * 60 * 1000;
    try {
      await requestTravelerPasswordReset(otpSession.email);
      setOtpSession((prev) => ({
        ...prev,
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
    <LanguageProvider>
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
          expiresAt={otpSession?.expiresAt}
          resendsUsed={otpSession?.resendsUsed ?? 0}
          maxResends={otpSession?.maxResends ?? 3}
          onBack={goToForgot}
          onVerify={async (code) => {
            const em = otpSession?.email || lastEmail;
            await verifyTravelerPasswordReset(em, code);
            handleVerifyComplete();
          }}
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
          onProfilePress={() => navigate("profile")}
          onNotificationsPress={() => navigate("notifications")}
          onCalendarPress={() => navigate("schedule")}
          onMessagesPress={() => navigate("messages")}
          onSearchPress={() => navigate("search")}
          onPlusPress={() => navigate("customPackages")}
          onSeeAllTopPicksPress={() => navigate("topPicks")}
          onSeeAllRunningNowPress={() => navigate("runningNow")}
          unreadCount={unreadCount}
          notificationUnreadCount={notificationUnreadCount}
        />
      )}
      {screen === "topPicks" && (
        <TopPicksScreen
          session={session}
          initialPackages={cachedPackages}
          onUpdateCachedPackages={setCachedPackages}
          onTripPress={(trip) => {
            setSelectedTrip(trip?.packageData ? { ...trip, id: String(trip.packageData.id) } : trip);
            navigate("details");
          }}
          onBack={goBack}
        />
      )}
      {screen === "runningNow" && (
        <RunningNowScreen
          session={session}
          initialPackages={cachedPackages}
          onUpdateCachedPackages={setCachedPackages}
          onTripPress={(trip) => {
            setSelectedTrip(trip?.packageData ? { ...trip, id: String(trip.packageData.id) } : trip);
            navigate("details");
          }}
          onBack={goBack}
        />
      )}
      {screen === "search" && (
        <SearchScreen
          session={session}
          initialPackages={cachedPackages}
          onBack={goBack}
          onTripPress={(trip) => {
            setSelectedTrip(trip?.packageData ? { ...trip, id: String(trip.packageData.id) } : trip);
            navigate("details");
          }}
        />
      )}
      {screen === "messages" && (
        <MessagesScreen
          session={session}
          unreadCount={unreadCount}
          onBack={goBack}
          onHomePress={() => navigate("home")}
          onCalendarPress={() => navigate("schedule")}
          onPlusPress={() => navigate("customPackages")}
          onProfilePress={() => navigate("profile")}
          onChatPress={(chat) => {
            setSelectedChat(chat);
            navigate("chatDetail");
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
          onBack={goBack}
          onMarkRoomRead={refreshUnreadCount}
          onPackagePress={(packageId) => {
            setSelectedCustomPackageId(packageId);
            navigate("customPackageDetail");
          }}
        />
      )}
      {screen === "customPackageDetail" && selectedCustomPackageId != null && (
        <CustomPackageDetailScreen
          packageId={selectedCustomPackageId}
          session={session}
          onBack={() => {
            setSelectedCustomPackageId(null);
            goBack();
          }}
          onCancelSuccess={(updatedPkg) => {
            setCachedCustomPackages((prev) =>
              prev ? prev.map((p) => (p.id === updatedPkg?.id ? { ...p, ...updatedPkg } : p)) : prev
            );
          }}
          onDeleteSuccess={(deletedId) => {
            setCachedCustomPackages((prev) => (prev ? prev.filter((p) => p.id !== deletedId) : prev));
            setSelectedCustomPackageId(null);
            goBack();
          }}
        />
      )}
      {screen === "schedule" && (
        <ScheduleScreen
          session={session}
          initialBookings={cachedBookings}
          onUpdateCachedBookings={setCachedBookings}
          unreadCount={unreadCount}
          onBack={goBack}
          onHomePress={() => navigate("home")}
          onMessagesPress={() => navigate("messages")}
          onProfilePress={() => navigate("profile")}
          onPlusPress={() => navigate("customPackages")}
          onTripPress={(pkg) => {
            if (pkg?.id != null) {
              setSelectedTrip({ id: String(pkg.id) });
              navigate("details");
            }
          }}
          onScheduleItemPress={(item) => {
            const packageId = item?.booking?.package_id ?? item?.packageData?.id;
            if (packageId != null) {
              setSelectedTrip({ id: String(packageId) });
              navigate("details");
            }
          }}
        />
      )}
      {screen === "details" && (
        <DetailsScreen
          trip={selectedTrip}
          initialPackageFromCache={cachedPackages}
          session={session}
          initialProfile={userProfile}
          onBack={goBack}
          onShowMap={(mapData) => {
            setSelectedMapData(mapData || null);
            navigate("map");
          }}
          onBook={handleBookTrip}
          onMessageAgent={async (agent) => {
            if (!session?.access) {
              alert("Please log in to message the agent.");
              navigate("login", { resetHistory: true });
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
              navigate("chatDetail");
            } catch (err) {
              alert(err?.message || "Failed to start chat.");
            }
          }}
        />
      )}
      {screen === "map" && (
        <MapScreen
          mapData={selectedMapData}
          onBack={goBack}
        />
      )}
      {screen === "profile" && (
        <ProfileScreen
          key={profileRefreshKey}
          session={session}
          initialProfile={userProfile}
          initialBookings={cachedBookings}
          onUpdateCachedProfile={setUserProfile}
          unreadCount={unreadCount}
          onBack={goBack}
          onEdit={() => navigate("editProfile")}
          onProfileDetailsPress={() => navigate("profileDetails")}
          onBookmarkedPress={() => navigate("bookmarked")}
          onSettingsPress={() => navigate("changePassword")}
          onPastTripsPress={() => navigate("pastTrips")}
          onUpcomingTripsPress={() => navigate("upcomingTrips")}
          onLeaderboardPress={() => navigate("leaderboard")}
          onNotificationsPress={() => navigate("notifications")}
          onCalendarPress={() => navigate("schedule")}
          onMessagesPress={() => navigate("messages")}
          onLogout={handleLogout}
          onPlusPress={() => navigate("customPackages")}
          onUpdateCachedBookings={setCachedBookings}
          onCancelRefundPress={() => navigate("cancelRefund")}
        />
      )}
      {screen === "cancelRefund" && (
        <CancelRefundScreen
          session={session}
          initialBookings={cachedBookings}
          onUpdateCachedBookings={setCachedBookings}
          onBack={goBack}
          onTripPress={(item) => {
            const packageId = item?.booking?.package_id ?? item?.packageData?.id;
            if (packageId != null) {
              setSelectedTrip({ id: String(packageId) });
              navigate("details");
            }
          }}
        />
      )}
      {screen === "profileDetails" && (
        <ProfileDetailsScreen
          profile={userProfile}
          onBack={goBack}
        />
      )}
      {screen === "bookmarked" && (
        <BookmarkedScreen
          session={session}
          onBack={goBack}
          onTripPress={(pkg) => {
            if (pkg?.id != null) {
              setSelectedTrip({ id: String(pkg.id) });
              navigate("details");
            }
          }}
        />
      )}
      {screen === "pastTrips" && (
        <PastTripsScreen
          session={session}
          initialBookings={cachedBookings}
          onUpdateCachedBookings={setCachedBookings}
          onBack={goBack}
          onTripPress={(pkg) => {
            if (pkg?.id != null) {
              setSelectedTrip({ id: String(pkg.id) });
              navigate("details");
            }
          }}
        />
      )}
      {screen === "leaderboard" && (
        <LeaderboardScreen
          session={session}
          onBack={goBack}
        />
      )}
      {screen === "notifications" && (
        <NotificationsScreen
          session={session}
          onBack={goBack}
          onReadStateChange={refreshNotificationUnreadCount}
        />
      )}
      {screen === "upcomingTrips" && (
        <UpcomingTripsScreen
          session={session}
          initialBookings={cachedBookings}
          onUpdateCachedBookings={setCachedBookings}
          onBack={goBack}
          onOpenSchedule={() => navigate("cancelRefund")}
          onTripPress={(pkg) => {
            if (pkg?.id != null) {
              setSelectedTrip({ id: String(pkg.id) });
              navigate("details");
            }
          }}
        />
      )}
      {screen === "customPackages" && (
        <CustomPackagesListScreen
          session={session}
          initialCustomPackages={cachedCustomPackages}
          onUpdateCachedCustomPackages={setCachedCustomPackages}
          unreadCount={unreadCount}
          onBack={goBack}
          onCreatePress={() => navigate("createCustomPackage")}
          onPackagePress={(packageId) => {
            setSelectedCustomPackageId(packageId);
            navigate("customPackageDetail");
          }}
          onHomePress={() => navigate("home")}
          onCalendarPress={() => navigate("schedule")}
          onMessagesPress={() => navigate("messages")}
          onProfilePress={() => navigate("profile")}
        />
      )}
      {screen === "createCustomPackage" && (
        <CreateCustomPackageScreen
          session={session}
          onBack={goBack}
          onCreateSuccess={(newPackage) => {
            if (newPackage) setCachedCustomPackages((prev) => [...(prev || []), newPackage]);
            goBack();
          }}
        />
      )}
      {screen === "editProfile" && (
        <EditProfileScreen
          session={session}
          initialProfile={userProfile}
          onBack={goBack}
          onSave={(updatedProfile) => {
            if (updatedProfile) setUserProfile(updatedProfile);
            setProfileRefreshKey((prev) => prev + 1);
            goBack();
          }}
        />
      )}
      {screen === "changePassword" && (
        <ChangePasswordScreen
          session={session}
          onBack={goBack}
        />
      )}
    </SafeAreaView>
    </LanguageProvider>
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

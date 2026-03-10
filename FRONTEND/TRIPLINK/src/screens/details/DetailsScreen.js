import React, { useMemo, useState, useEffect, useRef } from "react";
import { useLanguage } from "../../context/LanguageContext";
import {
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { getPackageById, getAgentPublicProfile, createAgentReview, initiateEsewaPayment, verifyEsewaPayment } from "../../utils/api";

const DEFAULT_AVATAR_URL =
  "https://static.vecteezy.com/system/resources/thumbnails/041/641/685/small/3d-character-people-close-up-portrait-smiling-nice-3d-avartar-or-icon-png.png";

const defaultTrip = {
  title: "Coeurdes Alpes",
  location: "Aspen, United States",
  rating: 4.5,
  reviews: 355,
  price: 199,
  description:
    "Aspen is as close as one can get to a storybook alpine town in America. The choose-your-own-adventure possibilities - skiing, hiking, dining, shopping and more - make it perfect for every traveler. Wander through charming streets, soak up alpine sunshine, and unwind with world-class dining before your next adventure begins.",
  hero: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  facilities: [
    { key: "heater", label: "1 Heater", icon: "snow-outline" },
    { key: "dinner", label: "Dinner", icon: "restaurant-outline" },
    { key: "tub", label: "1 Tub", icon: "water-outline" },
    { key: "pool", label: "Pool", icon: "water-outline" },
  ],
};

const formatPrice = (price) => {
  let numericValue = 0;
  
  if (typeof price === "number") {
    numericValue = price;
  } else if (typeof price === "string") {
    const cleaned = price.replace(/[^0-9.]/g, "");
    numericValue = parseFloat(cleaned) || 0;
  }
  
  return `Rs. ${numericValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const parsePriceValue = (price) => {
  if (typeof price === "number") return Number.isFinite(price) ? price : 0;
  if (typeof price === "string") {
    const cleaned = price.replace(/[^0-9.]/g, "");
    return parseFloat(cleaned) || 0;
  }
  return 0;
};

const buildEsewaPostSource = (paymentSession) => {
  const uri = paymentSession?.esewa_form_url;
  const fields = paymentSession?.esewa_fields;
  if (!uri || !fields || typeof fields !== "object") return null;

  const body = Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(String(key))}=${encodeURIComponent(String(value ?? ""))}`)
    .join("&");

  return {
    uri,
    method: "POST",
    body,
  };
};

const formatTripDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatReviewDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const COLS = 4;
const CARD_GAP = 10;
const ROW_GAP = 12;

const StarRating = ({ rating, size = 16, color = "#f7b500" }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars.push(<Ionicons key={i} name="star" size={size} color={color} />);
    } else if (i - 0.5 <= rating) {
      stars.push(<Ionicons key={i} name="star-half" size={size} color={color} />);
    } else {
      stars.push(<Ionicons key={i} name="star-outline" size={size} color="#d1d5db" />);
    }
  }
  return <View style={{ flexDirection: "row", gap: 2 }}>{stars}</View>;
};

const ParticipantAvatar = ({ participant, index }) => (
  <View style={[styles.participantAvatarWrap, { marginLeft: index > 0 ? -12 : 0 }]}>
    <Image
      source={{ uri: participant.traveler_profile_picture || DEFAULT_AVATAR_URL }}
      style={styles.participantAvatar}
    />
  </View>
);

const AgentProfileReviewCard = ({ review, t }) => (
  <View style={styles.agentProfileReviewCard}>
    <View style={styles.agentProfileReviewHeader}>
      <Image
        source={{ uri: review?.reviewer_profile_picture || DEFAULT_AVATAR_URL }}
        style={styles.agentProfileReviewAvatar}
      />
      <View style={styles.agentProfileReviewMeta}>
        <Text style={styles.agentProfileReviewName} numberOfLines={1}>
          {review?.reviewer_name || (t ? t("traveler") : "Traveler")}
        </Text>
        <Text style={styles.agentProfileReviewDate}>{formatReviewDate(review?.created_at)}</Text>
      </View>
      <StarRating rating={Number(review?.rating || 0)} size={12} />
    </View>
    {!!review?.comment && (
      <Text style={styles.agentProfileReviewComment}>{review.comment}</Text>
    )}
  </View>
);

const AgentProfileDetailsModal = ({
  visible,
  onClose,
  loading,
  error,
  data,
  fallbackAgent,
  t,
}) => {
  const ratingRaw = data?.rating ?? fallbackAgent?.rating ?? 0;
  const ratingNumber = Number(ratingRaw);
  const ratingDisplayValue = Number.isFinite(ratingNumber) ? Math.max(0, Math.min(ratingNumber, 5)) : 0;
  const ratingText = Number.isFinite(ratingNumber) ? ratingNumber.toFixed(1).replace(/\.0$/, "") : "0";
  const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
  const T = t || ((k) => k);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.agentProfileModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{T("agentDetails")}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color="#6b7076" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.agentProfileHero}>
              <Image
                source={{ uri: data?.profile_picture_url || fallbackAgent?.profile_picture_url || DEFAULT_AVATAR_URL }}
                style={styles.agentProfileHeroAvatar}
              />
              <View style={styles.agentProfileHeroInfo}>
                <View style={styles.agentNameRow}>
                  <Text style={styles.agentProfileHeroName}>
                    {data?.full_name || fallbackAgent?.full_name || T("travelAgent")}
                  </Text>
                  {(data?.is_verified ?? fallbackAgent?.is_verified) ? (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#1f6b2a" />
                      <Text style={styles.verifiedText}>{T("verified")}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.agentRatingInline}>
                  <StarRating rating={ratingDisplayValue} size={13} />
                  <Text style={styles.agentRatingInlineText}>{ratingText}</Text>
                </View>
              </View>
            </View>

            {loading ? (
              <View style={styles.agentProfileLoadingWrap}>
                <ActivityIndicator size="small" color="#1f6b2a" />
                <Text style={styles.agentProfileLoadingText}>{T("loadingAgentDetails")}</Text>
              </View>
            ) : error ? (
              <View style={styles.agentProfileErrorCard}>
                <Text style={styles.agentProfileErrorText}>{error}</Text>
              </View>
            ) : (
              <>
                <View style={styles.agentProfileInfoCard}>
                  <View style={styles.agentProfileInfoRow}>
                    <Ionicons name="mail-outline" size={16} color="#6b7280" />
                    <Text style={styles.agentProfileInfoText}>{data?.email || "-"}</Text>
                  </View>
                  <View style={styles.agentProfileInfoRow}>
                    <Ionicons name="call-outline" size={16} color="#6b7280" />
                    <Text style={styles.agentProfileInfoText}>{data?.phone_number || "-"}</Text>
                  </View>
                  <View style={styles.agentProfileInfoRow}>
                    <Ionicons name="location-outline" size={16} color="#6b7280" />
                    <Text style={styles.agentProfileInfoText}>{data?.location || "-"}</Text>
                  </View>
                </View>

                <View style={styles.agentStatsGrid}>
                  <View style={styles.agentStatCard}>
                    <Text style={styles.agentStatValue}>{data?.reviews_count ?? 0}</Text>
                    <Text style={styles.agentStatLabel}>{T("reviews")}</Text>
                  </View>
                  <View style={styles.agentStatCard}>
                    <Text style={styles.agentStatValue}>{data?.total_packages_created ?? 0}</Text>
                    <Text style={styles.agentStatLabel}>{T("packagesCount")}</Text>
                  </View>
                  <View style={styles.agentStatCard}>
                    <Text style={styles.agentStatValue}>{data?.total_bookings_handled ?? 0}</Text>
                    <Text style={styles.agentStatLabel}>{T("bookings")}</Text>
                  </View>
                </View>

                <View style={styles.agentProfileReviewsSection}>
                  <Text style={styles.agentProfileReviewsTitle}>{T("travelerReviews")}</Text>
                  {reviews.length > 0 ? (
                    reviews.map((review, index) => (
                      <AgentProfileReviewCard key={review?.id || index} review={review} t={t} />
                    ))
                  ) : (
                    <View style={styles.agentProfileEmptyReviews}>
                      <Text style={styles.agentProfileEmptyReviewsText}>{T("noReviewsYet")}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const ReviewModal = ({ visible, onClose, onSubmit, submitting, t }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const T = t || ((k) => k);

  const handleSubmit = () => {
    if (rating < 1 || rating > 5) {
      Alert.alert(T("error") || "Error", T("selectRating1To5"));
      return;
    }
    onSubmit(rating, comment);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{T("reviewAgent")}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={24} color="#6b7076" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalLabel}>{T("yourRating")}</Text>
          <View style={styles.ratingSelector}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                <Ionicons
                  name={star <= rating ? "star" : "star-outline"}
                  size={36}
                  color={star <= rating ? "#f7b500" : "#d1d5db"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>{T("yourReviewOptional")}</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder={T("shareExperience")}
            placeholderTextColor="#9aa0a6"
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>{T("submitAgentReview")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const DetailsScreen = ({ route, trip: tripProp, initialPackageFromCache = null, session, onBack = () => {}, onBook = () => {}, onMessageAgent = () => {} }) => {
  const { t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [descriptionHasOverflow, setDescriptionHasOverflow] = useState(false);
  const [userHasBooked, setUserHasBooked] = useState(false);
  const [userHasReviewed, setUserHasReviewed] = useState(false);

  const packageId = useMemo(() => {
    const incoming = tripProp || route?.params?.trip || {};
    return incoming?.packageData?.id ?? incoming?.id ?? null;
  }, [tripProp, route?.params?.trip]);

  const cachedDetail = useMemo(() => {
    if (!packageId || !initialPackageFromCache || !Array.isArray(initialPackageFromCache)) return null;
    const idStr = String(packageId);
    return initialPackageFromCache.find((p) => String(p?.id ?? "") === idStr) || null;
  }, [packageId, initialPackageFromCache]);

  const hasCachedDetail = cachedDetail != null;
  const tripFromProp = tripProp || route?.params?.trip || {};
  const trip = useMemo(() => {
    const incoming = tripProp || route?.params?.trip || {};
    const pkg = incoming.packageData || {};
    return {
      ...defaultTrip,
      ...incoming,
      hero: incoming.hero || incoming.image || defaultTrip.hero,
      facilities: incoming.facilities || defaultTrip.facilities,
      price: incoming.price ?? defaultTrip.price,
      rating: incoming.rating ?? defaultTrip.rating,
      reviews: incoming.reviews ?? defaultTrip.reviews,
      description: incoming.description || defaultTrip.description,
      user_has_booked: incoming.user_has_booked ?? false,
      trip_start_date: incoming.trip_start_date ?? pkg.trip_start_date ?? null,
      trip_end_date: incoming.trip_end_date ?? pkg.trip_end_date ?? null,
    };
  }, [tripProp, route?.params?.trip]);

  const [loading, setLoading] = useState(!hasCachedDetail);
  const [packageDetail, setPackageDetail] = useState(() => {
    if (hasCachedDetail && cachedDetail) {
      return {
        ...cachedDetail,
        user_has_booked: tripFromProp.user_has_booked ?? cachedDetail.user_has_booked ?? false,
      };
    }
    return null;
  });
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [agentProfileModalVisible, setAgentProfileModalVisible] = useState(false);
  const [agentProfileLoading, setAgentProfileLoading] = useState(false);
  const [agentProfileData, setAgentProfileData] = useState(null);
  const [agentProfileError, setAgentProfileError] = useState("");
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [bookingStep, setBookingStep] = useState("traveler_count");
  const [travelerCountInput, setTravelerCountInput] = useState("1");
  const [paymentSession, setPaymentSession] = useState(null);
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [esewaWebViewVisible, setEsewaWebViewVisible] = useState(false);
  const [esewaWebViewLoading, setEsewaWebViewLoading] = useState(false);
  const paymentCallbackHandledRef = useRef(false);

  useEffect(() => {
    if (cachedDetail && !packageDetail) {
      setPackageDetail({
        ...cachedDetail,
        user_has_booked: tripFromProp.user_has_booked ?? cachedDetail.user_has_booked ?? false,
      });
      setUserHasBooked(tripFromProp.user_has_booked ?? cachedDetail.user_has_booked ?? false);
      setLoading(false);
    }
  }, [cachedDetail]);

  // Fetch full package details and participants (use cache for first paint)
  useEffect(() => {
    const fetchPackageDetails = async () => {
      if (!packageId) {
        setLoading(false);
        return;
      }
      try {
        if (!packageDetail) setLoading(true);
        const response = await getPackageById(packageId, session?.access);
        if (response?.data) {
          setPackageDetail(response.data);
          setUserHasBooked(response.data.user_has_booked ?? false);
          setUserHasReviewed(response.data.user_has_reviewed ?? response.data?.agent?.user_has_reviewed_agent ?? false);
        }
      } catch (error) {
        console.error("Error fetching package details:", error);
        if (!packageDetail) setPackageDetail(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPackageDetails();
  }, [packageId, session?.access]);

  const handleSubmitReview = async (rating, comment) => {
    if (!session?.access) {
      Alert.alert(t("error"), t("pleaseLoginToReview"));
      return;
    }

    const agentId = packageDetail?.agent?.agent_id;
    if (!agentId) {
      Alert.alert(t("error"), t("agentInfoNotFound"));
      return;
    }

    try {
      setSubmittingReview(true);
      await createAgentReview(agentId, rating, comment, session.access);
      setReviewModalVisible(false);
      setUserHasReviewed(true);
      Alert.alert(t("success") || "Success", t("reviewSubmitted"));
    } catch (error) {
      Alert.alert(t("error"), error.message || t("failedToSubmitReview"));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleOpenAgentProfile = async () => {
    const agentId = packageDetail?.agent?.agent_id;
    setAgentProfileModalVisible(true);

    if (!agentId) {
      setAgentProfileError(t("agentDetailsNotAvailable"));
      return;
    }

    if (String(agentProfileData?.agent_id || "") === String(agentId)) {
      setAgentProfileError("");
      return;
    }

    try {
      setAgentProfileLoading(true);
      setAgentProfileError("");
      const response = await getAgentPublicProfile(agentId);
      setAgentProfileData(response?.data || null);
    } catch (error) {
      setAgentProfileError(error?.message || t("failedToLoadAgentDetails") || "Failed to load agent details.");
    } finally {
      setAgentProfileLoading(false);
    }
  };

  const unitPrice = parsePriceValue(packageDetail?.price_per_person ?? trip.price);
  const travelerCount = Math.max(parseInt(travelerCountInput, 10) || 1, 1);
  const computedTotal = unitPrice * travelerCount;
  const esewaPostSource = useMemo(
    () => buildEsewaPostSource(paymentSession),
    [paymentSession]
  );

  const resetBookingModal = () => {
    setBookingStep("traveler_count");
    setTravelerCountInput("1");
    setPaymentSession(null);
    setInitiatingPayment(false);
    setVerifyingPayment(false);
    setEsewaWebViewVisible(false);
    setEsewaWebViewLoading(false);
    paymentCallbackHandledRef.current = false;
  };

  const closeBookingModal = () => {
    setBookingModalVisible(false);
    resetBookingModal();
  };

  const handleBookNowPress = () => {
    if (!session?.access) {
      Alert.alert(t("loginRequired"), t("pleaseLoginToBook"));
      onBook({ requiresLogin: true });
      return;
    }
    setBookingModalVisible(true);
    setBookingStep("traveler_count");
  };

  const handleContinueToPayment = async () => {
    if (!session?.access) {
      Alert.alert(t("loginRequired"), t("pleaseLoginToContinue"));
      return;
    }
    if (!packageId) {
      Alert.alert(t("error"), t("invalidPackage"));
      return;
    }

    try {
      setInitiatingPayment(true);
      const { data } = await initiateEsewaPayment(packageId, travelerCount, session.access);
      setPaymentSession(data || null);
      paymentCallbackHandledRef.current = false;
      setBookingStep("payment");
    } catch (error) {
      Alert.alert(t("paymentSetupFailed"), error?.message || t("couldNotStartEsewa"));
    } finally {
      setInitiatingPayment(false);
    }
  };

  const verifyEsewaPaymentAndBook = async ({ silent = false } = {}) => {
    const transactionUuid = paymentSession?.transaction_uuid;
    if (!session?.access || !transactionUuid) {
      if (!silent) Alert.alert(t("error"), t("paymentSessionMissing"));
      return;
    }

    try {
      setVerifyingPayment(true);
      const { data } = await verifyEsewaPayment(transactionUuid, session.access);
      const bookedTravelerCount = parseInt(data?.booking?.traveler_count, 10) || travelerCount;
      setUserHasBooked(true);
      setPackageDetail((prev) =>
        prev
          ? {
              ...prev,
              user_has_booked: true,
              participants_count: (prev.participants_count || 0) + bookedTravelerCount,
            }
          : prev
      );

      try {
        const refreshed = await getPackageById(packageId, session.access);
        if (refreshed?.data) {
          setPackageDetail(refreshed.data);
          setUserHasBooked(refreshed.data.user_has_booked ?? true);
        }
      } catch (_) {}

      onBook(data || null);
      closeBookingModal();
      Alert.alert(t("paymentSuccessful"), t("paymentCompleteBooked"));
      return true;
    } catch (error) {
      if (!silent) {
        Alert.alert(t("verificationFailed"), error?.message || t("paymentNotVerified"));
      } else {
        // Silent mode is used for callback auto-verification. Caller may retry.
      }
      return false;
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleEsewaCallbackUrl = (url) => {
    const currentUrl = String(url || "");
    if (!currentUrl || paymentCallbackHandledRef.current) return false;

    const isSuccess = currentUrl.includes("/api/auth/payments/esewa/callback/success/");
    const isFailure = currentUrl.includes("/api/auth/payments/esewa/callback/failure/");
    if (!isSuccess && !isFailure) return false;

    paymentCallbackHandledRef.current = true;
    setEsewaWebViewVisible(false);

    if (isFailure) {
      Alert.alert(t("paymentFailed"), t("esewaCancelledOrFailed"));
      return true;
    }

    (async () => {
      const retryDelaysMs = [0, 1200, 2500, 4000];
      for (const delayMs of retryDelaysMs) {
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        const ok = await verifyEsewaPaymentAndBook({ silent: true });
        if (ok) return;
      }
      Alert.alert(t("paymentSubmitted"), t("verificationTakingLonger"));
    })();
    return true;
  };

  const handleOpenEsewaCheckout = async () => {
    if (!esewaPostSource) {
      Alert.alert(t("error"), t("paymentCheckoutMissingError"));
      return;
    }
    paymentCallbackHandledRef.current = false;
    setEsewaWebViewVisible(true);
    setEsewaWebViewLoading(true);
  };

  const agent = packageDetail?.agent;
  const participants = packageDetail?.participants || [];
  const descriptionText = packageDetail?.description || trip.description || "";
  const agentRatingRaw = packageDetail?.agent_rating ?? agent?.rating ?? trip.rating ?? 0;
  const agentRatingNumber = Number(agentRatingRaw);
  const agentRatingDisplayValue = Number.isFinite(agentRatingNumber)
    ? Math.max(0, Math.min(agentRatingNumber, 5))
    : 0;
  const agentRatingText = Number.isFinite(agentRatingNumber)
    ? agentRatingNumber.toFixed(1).replace(/\.0$/, "")
    : "0";

  const todayKey = new Date().toISOString().slice(0, 10);
  const rawStartDate = packageDetail?.trip_start_date || trip.trip_start_date || null;
  let hasTripStarted = false;
  if (rawStartDate) {
    const parsedStart = new Date(rawStartDate);
    if (!Number.isNaN(parsedStart.getTime())) {
      const startKey = parsedStart.toISOString().slice(0, 10);
      hasTripStarted = startKey <= todayKey;
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f2f3f5" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={styles.heroCard}>
          <Image source={{ uri: packageDetail?.main_image_url || trip.hero }} style={styles.heroImage} />
          <TouchableOpacity style={styles.backButton} activeOpacity={0.85} onPress={onBack}>
            <Ionicons name="chevron-back" size={20} color="#1f1f1f" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Title & Map Link */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{packageDetail?.title || trip.title}</Text>
          </View>

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#6f747a" />
            <Text style={styles.locationText}>
              {packageDetail ? `${packageDetail.location}, ${packageDetail.country}` : trip.location}
            </Text>
          </View>

          {/* Trip Dates */}
          {(packageDetail?.trip_start_date || packageDetail?.trip_end_date || trip.trip_start_date || trip.trip_end_date) && (
            <View style={styles.tripDatesRow}>
              <Ionicons name="calendar-outline" size={18} color="#1f6b2a" />
              <Text style={styles.tripDatesText}>
                {(packageDetail?.trip_start_date || trip.trip_start_date) && (packageDetail?.trip_end_date || trip.trip_end_date)
                  ? `${formatTripDate(packageDetail?.trip_start_date || trip.trip_start_date)} – ${formatTripDate(packageDetail?.trip_end_date || trip.trip_end_date)}`
                  : (packageDetail?.trip_start_date || trip.trip_start_date)
                    ? `From ${formatTripDate(packageDetail?.trip_start_date || trip.trip_start_date)}`
                    : `To ${formatTripDate(packageDetail?.trip_end_date || trip.trip_end_date)}`}
              </Text>
            </View>
          )}

          {/* Description */}
          <View style={styles.descriptionWrap}>
            <Text
              style={styles.description}
              numberOfLines={expanded ? undefined : 4}
              onTextLayout={(e) => {
                const hasOverflow = (e?.nativeEvent?.lines?.length || 0) > 4;
                if (hasOverflow !== descriptionHasOverflow) {
                  setDescriptionHasOverflow(hasOverflow);
                }
              }}
            >
              {descriptionText}
            </Text>
            {descriptionHasOverflow && (
              <TouchableOpacity
                style={styles.readMoreRow}
                activeOpacity={0.8}
                onPress={() => setExpanded(!expanded)}
              >
                <Text style={styles.readMoreText}>{expanded ? t("readLess") : t("readMore")}</Text>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="#1f6b2a"
                  style={{ marginLeft: 2 }}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Facilities */}
          <Text style={styles.sectionTitle}>{t("facilities")}</Text>
          <View style={styles.facilityGrid}>
            {(() => {
              const featuresList = packageDetail?.features?.map((f, idx) => ({
                key: `feature_${idx}`,
                label: f.name,
                icon: f.icon || "checkmark-circle-outline",
              })) || trip.facilities || [];
              
              const contentWidth = windowWidth - 16 * 2 - 10 * 2;
              const cardWidth = (contentWidth - (COLS - 1) * CARD_GAP) / COLS;
              const rows = [];
              for (let i = 0; i < featuresList.length; i += COLS) {
                rows.push(featuresList.slice(i, i + COLS));
              }
              return rows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={[styles.facilityRow, rowIndex === rows.length - 1 && styles.facilityRowLast]}>
                  {row.map((facility, colIndex) => (
                    <View
                      key={facility.key || `${rowIndex}-${colIndex}`}
                      style={[
                        styles.facilityCard,
                        { width: cardWidth, marginRight: colIndex < row.length - 1 ? CARD_GAP : 0 },
                      ]}
                    >
                      <View style={styles.facilityIcon}>
                        <Ionicons name={facility.icon || "checkmark-circle-outline"} size={22} color="#8b9096" />
                      </View>
                      <Text style={styles.facilityLabel} numberOfLines={2}>{facility.label || facility.name || ""}</Text>
                    </View>
                  ))}
                </View>
              ));
            })()}
          </View>

          {/* Agent/Host Info */}
          {agent && (
            <>
              <Text style={styles.sectionTitle}>{t("hostedBy")}</Text>
              <View style={styles.agentCard}>
                <View style={styles.agentCardTop}>
                  <TouchableOpacity
                    style={styles.agentProfileTapArea}
                    onPress={handleOpenAgentProfile}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: agent.profile_picture_url || DEFAULT_AVATAR_URL }}
                      style={styles.agentAvatar}
                    />
                    <View style={styles.agentInfo}>
                      <View style={styles.agentNameRow}>
                        <Text style={styles.agentName}>{agent.full_name || t("travelAgent")}</Text>
                        {agent.is_verified && (
                          <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={16} color="#1f6b2a" />
                            <Text style={styles.verifiedText}>{t("verified")}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.agentRatingInline}>
                        <StarRating rating={agentRatingDisplayValue} size={13} />
                        <Text style={styles.agentRatingInlineText}>{agentRatingText}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {session?.access && (
                    <TouchableOpacity
                      style={[styles.agentReviewButton, { marginRight: 8 }]}
                      onPress={() => onMessageAgent({
                        agent_id: agent.agent_id,
                        full_name: agent.full_name || t("travelAgent"),
                        profile_picture_url: agent.profile_picture_url,
                      })}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1f6b2a" />
                      <Text style={styles.agentReviewButtonText}>{t("message")}</Text>
                    </TouchableOpacity>
                  )}
                  {!userHasReviewed && (
                    <TouchableOpacity
                      style={styles.agentReviewButton}
                      onPress={() => {
                        const tripEndDate = packageDetail?.trip_end_date || trip.trip_end_date;
                        const hasBooked = userHasBooked || trip.user_has_booked;
                        if (hasBooked && tripEndDate) {
                          const todayStr = new Date().toISOString().slice(0, 10);
                          if (tripEndDate > todayStr) {
                            Alert.alert(
                              t("cannotReviewYet"),
                              t("tripNotCompleted")
                            );
                            return;
                          }
                        }
                        setReviewModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="create-outline" size={18} color="#1f6b2a" />
                      <Text style={styles.agentReviewButtonText}>{t("review")}</Text>
                    </TouchableOpacity>
                  )}
                  {userHasReviewed && (
                    <View style={styles.reviewedBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#1f6b2a" />
                      <Text style={styles.reviewedBadgeText}>{t("reviewed")}</Text>
                    </View>
                  )}
                </View>
              </View>
            </>
          )}

          {/* Participants Section */}
          <View style={styles.participantsSectionWrap}>
          <Text style={styles.sectionTitle}>
            {t("travelersJoined")} ({packageDetail?.participants_count || participants.length})
          </Text>
          {loading ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color="#1f6b2a" />
            </View>
          ) : participants.length > 0 ? (
            <View style={styles.participantsSection}>
              <View style={styles.participantsAvatars}>
                {participants.slice(0, 8).map((participant, index) => (
                  <ParticipantAvatar key={participant.id || index} participant={participant} index={index} />
                ))}
                {participants.length > 8 && (
                  <View style={[styles.participantAvatarWrap, styles.moreParticipants, { marginLeft: -12 }]}>
                    <Text style={styles.moreParticipantsText}>+{participants.length - 8}</Text>
                  </View>
                )}
              </View>
              {participants.length > 0 && (
                <View style={styles.participantNames}>
                  {participants.slice(0, 3).map((p, i) => (
                    <Text key={i} style={styles.participantName}>
                      {p.traveler_name}{i < Math.min(2, participants.length - 1) ? ", " : ""}
                    </Text>
                  ))}
                  {participants.length > 3 && (
                    <Text style={styles.participantName}> and {participants.length - 3} others</Text>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noParticipantsCard}>
              <Ionicons name="people-outline" size={32} color="#d1d5db" />
              <Text style={styles.noParticipantsText}>{t("noTravelersYet")}</Text>
              <Text style={styles.noParticipantsSubtext}>{t("beFirstToBook")}</Text>
            </View>
          )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.priceWrap}>
          <Text style={styles.priceLabel}>{t("price")}</Text>
          <Text style={styles.priceValue}>{formatPrice(packageDetail?.price_per_person || trip.price)}</Text>
        </View>
        {(userHasBooked || trip.user_has_booked) ? (
          <View style={styles.alreadyBookedBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#1f6b2a" />
            <Text style={styles.alreadyBookedText}>{t("alreadyBooked")}</Text>
          </View>
        ) : hasTripStarted ? (
          <View style={styles.alreadyBookedBadge}>
            <Ionicons name="time-outline" size={20} color="#b45309" />
            <Text style={styles.alreadyBookedText}>{t("tripAlreadyStarted")}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.bookButton} activeOpacity={0.88} onPress={handleBookNowPress}>
            <Text style={styles.bookText}>{t("bookNow")}</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      <ReviewModal
        visible={reviewModalVisible}
        onClose={() => setReviewModalVisible(false)}
        onSubmit={handleSubmitReview}
        submitting={submittingReview}
        t={t}
      />

      <AgentProfileDetailsModal
        visible={agentProfileModalVisible}
        onClose={() => setAgentProfileModalVisible(false)}
        loading={agentProfileLoading}
        error={agentProfileError}
        data={agentProfileData}
        fallbackAgent={agent}
        t={t}
      />

      <Modal
        visible={bookingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeBookingModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("bookTrip")}</Text>
              <TouchableOpacity onPress={closeBookingModal} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#6b7076" />
              </TouchableOpacity>
            </View>

            {bookingStep === "traveler_count" ? (
              <>
                <Text style={styles.modalLabel}>{t("numberOfTravelers")}</Text>
                <TextInput
                  style={styles.travelerCountInput}
                  keyboardType="number-pad"
                  value={travelerCountInput}
                  onChangeText={(text) => setTravelerCountInput(text.replace(/[^0-9]/g, "").slice(0, 3) || "1")}
                  placeholder={t("enterTravelers")}
                  placeholderTextColor="#9aa0a6"
                />

                <View style={styles.paymentSummaryCard}>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>{t("pricePerTraveler")}</Text>
                    <Text style={styles.paymentSummaryValue}>{formatPrice(unitPrice)}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>{t("travelers")}</Text>
                    <Text style={styles.paymentSummaryValue}>{travelerCount}</Text>
                  </View>
                  <View style={[styles.paymentSummaryRow, styles.paymentSummaryRowTotal]}>
                    <Text style={styles.paymentSummaryTotalLabel}>{t("totalToPay")}</Text>
                    <Text style={styles.paymentSummaryTotalValue}>{formatPrice(computedTotal)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, initiatingPayment && styles.submitButtonDisabled]}
                  onPress={handleContinueToPayment}
                  disabled={initiatingPayment}
                  activeOpacity={0.85}
                >
                  {initiatingPayment ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>{t("continueToEsewa")}</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalLabel}>{t("paymentMethod")}</Text>
                <View style={styles.esewaCard}>
                  <View style={styles.esewaCardHeader}>
                    <View style={styles.esewaBadge}>
                      <Ionicons name="wallet-outline" size={18} color="#166534" />
                      <Text style={styles.esewaBadgeText}>eSewa</Text>
                    </View>
                    <Text style={styles.esewaAmount}>{formatPrice(paymentSession?.total_amount || computedTotal)}</Text>
                  </View>
                  <Text style={styles.esewaMetaText}>
                    Travelers: {paymentSession?.traveler_count || travelerCount} | Per person: {formatPrice(paymentSession?.price_per_person || unitPrice)}
                  </Text>
                  <Text style={styles.esewaMetaText}>
                    Transaction: {paymentSession?.transaction_uuid || "-"}
                  </Text>
                </View>

                <TouchableOpacity style={styles.bookButton} activeOpacity={0.88} onPress={handleOpenEsewaCheckout}>
                  <Text style={styles.bookText}>{t("openEsewaPayment")}</Text>
                  <Ionicons name="open-outline" size={18} color="#ffffff" />
                </TouchableOpacity>

                <View style={styles.autoVerifyInfoCard}>
                  {verifyingPayment ? (
                    <View style={styles.autoVerifyInfoRow}>
                      <ActivityIndicator size="small" color="#1f6b2a" />
                      <Text style={styles.autoVerifyInfoText}>
                        {t("verifyingPayment")}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.autoVerifyInfoText}>
                      {t("afterEsewaSuccess")}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.bookingBackLink}
                  onPress={() => setBookingStep("traveler_count")}
                  activeOpacity={0.75}
                >
                  <Text style={styles.bookingBackLinkText}>{t("editTravelerCount")}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={esewaWebViewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setEsewaWebViewVisible(false)}
      >
        <SafeAreaView style={styles.esewaWebViewSafe}>
          <View style={styles.esewaWebViewHeader}>
            <TouchableOpacity
              style={styles.esewaWebViewCloseBtn}
              onPress={() => setEsewaWebViewVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={22} color="#1f1f1f" />
            </TouchableOpacity>
            <View style={styles.esewaWebViewHeaderCenter}>
              <Text style={styles.esewaWebViewTitle}>{t("esewaPayment")}</Text>
              <Text style={styles.esewaWebViewSubtitle}>
                {t("completePaymentInside")}
              </Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          {esewaWebViewLoading ? (
            <View style={styles.esewaWebViewLoadingBar}>
              <ActivityIndicator size="small" color="#1f6b2a" />
              <Text style={styles.esewaWebViewLoadingText}>{t("loadingSecurePayment")}</Text>
            </View>
          ) : null}

          {esewaPostSource ? (
            <WebView
              source={esewaPostSource}
              style={styles.esewaWebView}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              startInLoadingState
              onLoadStart={() => setEsewaWebViewLoading(true)}
              onLoadEnd={() => setEsewaWebViewLoading(false)}
              onLoadProgress={(event) => {
                const progress = Number(event?.nativeEvent?.progress ?? 0);
                const url = String(event?.nativeEvent?.url || "");
                // eSewa sometimes keeps internal requests alive; hide the banner once the page is mostly rendered.
                if (progress >= 0.5 || url.includes("esewa.com.np")) {
                  setEsewaWebViewLoading(false);
                }
              }}
              onError={(event) => {
                setEsewaWebViewLoading(false);
                const msg = event?.nativeEvent?.description || t("failedToLoadEsewaPage");
                Alert.alert(t("paymentPageError"), msg);
              }}
              onHttpError={(event) => {
                setEsewaWebViewLoading(false);
                const statusCode = event?.nativeEvent?.statusCode;
                Alert.alert(t("paymentPageError"), `${t("esewaPageReturnedHttp")} ${statusCode || "error"}.`);
              }}
              onNavigationStateChange={(navState) => {
                const url = String(navState?.url || "");
                if (url && !url.includes("/api/auth/payments/esewa/callback/")) {
                  setEsewaWebViewLoading(false);
                }
                handleEsewaCallbackUrl(navState?.url);
              }}
              onShouldStartLoadWithRequest={(request) => {
                const intercepted = handleEsewaCallbackUrl(request?.url);
                return !intercepted;
              }}
            />
          ) : (
            <View style={styles.esewaWebViewFallback}>
              <Ionicons name="alert-circle-outline" size={28} color="#b91c1c" />
              <Text style={styles.esewaWebViewFallbackText}>Payment checkout URL is missing.</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f2f3f5",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 130,
  },
  heroCard: {
    position: "relative",
    height: 300,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  body: {
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    fontSize: 23,
    fontWeight: "800",
    color: "#1f1f1f",
    flex: 1,
  },
  mapLink: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 14,
    color: "#6f747a",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  ratingValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f1f1f",
    marginLeft: 4,
  },
  ratingMeta: {
    fontSize: 14,
    color: "#6f747a",
  },
  tripDatesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  tripDatesText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  descriptionWrap: {
    marginBottom: 18,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5f6369",
  },
  readMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  readMoreText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f6b2a",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f1f1f",
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 8,
  },
  facilityGrid: {
    flexDirection: "column",
    width: "100%",
    marginBottom: 20,
  },
  facilityRow: {
    flexDirection: "row",
    marginBottom: ROW_GAP,
    width: "100%",
  },
  facilityRowLast: {
    marginBottom: 0,
  },
  facilityCard: {
    backgroundColor: "#f1f4f6",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e1e5ea",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  facilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(31,107,42,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  facilityLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6f747a",
    marginTop: 8,
    textAlign: "center",
    alignSelf: "stretch",
    paddingHorizontal: 2,
  },
  // Agent Card
  agentCard: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e1e5ea",
  },
  agentCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  agentProfileTapArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  agentAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginRight: 14,
  },
  agentInfo: {
    flex: 1,
  },
  agentNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  agentRatingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  agentRatingInlineText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
  },
  agentName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#166534",
  },
  agentLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  agentLocationText: {
    fontSize: 13,
    color: "#6f747a",
  },
  agentReviewsInline: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  noReviewsInline: {
    fontSize: 14,
    color: "#94a3b8",
  },
  agentReviewButton: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    gap: 4,
    flexShrink: 0,
    minWidth: 70,
  },
  agentReviewButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f6b2a",
  },
  reviewedBadge: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    gap: 4,
  },
  reviewedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f6b2a",
  },
  agentProfileModalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 28,
    maxHeight: "88%",
  },
  agentProfileHero: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  agentProfileHeroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    marginRight: 14,
  },
  agentProfileHeroInfo: {
    flex: 1,
  },
  agentProfileHeroName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    flexShrink: 1,
  },
  agentProfileLoadingWrap: {
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  agentProfileLoadingText: {
    fontSize: 13,
    color: "#6b7280",
  },
  agentProfileErrorCard: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  agentProfileErrorText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "600",
  },
  agentProfileInfoCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  agentProfileInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  agentProfileInfoText: {
    flex: 1,
    color: "#374151",
    fontSize: 13,
  },
  agentStatsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  agentStatCard: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  agentStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  agentStatLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  agentProfileReviewsSection: {
    marginTop: 2,
  },
  agentProfileReviewsTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  agentProfileReviewCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  agentProfileReviewHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  agentProfileReviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  agentProfileReviewMeta: {
    flex: 1,
    marginRight: 8,
  },
  agentProfileReviewName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  agentProfileReviewDate: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 1,
  },
  agentProfileReviewComment: {
    marginTop: 8,
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },
  agentProfileEmptyReviews: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
  },
  agentProfileEmptyReviewsText: {
    fontSize: 13,
    color: "#6b7280",
  },
  reviewReminderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  reviewReminderCardHighlight: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  reviewReminderText: {
    flex: 1,
    fontSize: 14,
    color: "#6f747a",
    lineHeight: 20,
  },
  reviewReminderTextHighlight: {
    color: "#166534",
    fontWeight: "500",
  },
  // Reviews
  writeReviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  writeReviewText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f6b2a",
  },
  reviewsList: {
    gap: 12,
    marginBottom: 20,
  },
  reviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e1e5ea",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  reviewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f1f1f",
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: "#9aa0a6",
  },
  reviewRating: {
    alignSelf: "flex-start",
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    color: "#5f6369",
  },
  noReviewsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e5ea",
    marginBottom: 20,
  },
  noReviewsText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6f747a",
    marginTop: 12,
  },
  noReviewsSubtext: {
    fontSize: 13,
    color: "#9aa0a6",
    marginTop: 4,
  },
  // Participants
  participantsSectionWrap: {
    marginTop: 28,
  },
  participantsSection: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e1e5ea",
    marginBottom: 20,
  },
  participantsAvatars: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  participantAvatarWrap: {
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: 22,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  moreParticipants: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  moreParticipantsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6f747a",
  },
  participantNames: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  participantName: {
    fontSize: 13,
    color: "#6f747a",
  },
  noParticipantsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e5ea",
    marginBottom: 20,
  },
  noParticipantsText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6f747a",
    marginTop: 12,
  },
  noParticipantsSubtext: {
    fontSize: 13,
    color: "#9aa0a6",
    marginTop: 4,
  },
  loadingSection: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  // Bottom Bar
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#e8ecef",
  },
  priceWrap: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1f6b2a",
    letterSpacing: -0.5,
  },
  bookButton: {
    flexShrink: 0,
    backgroundColor: "#1f6b2a",
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#1f6b2a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  bookText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  alreadyBookedBadge: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  alreadyBookedText: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "700",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  bookingModalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f1f1f",
  },
  modalClose: {
    padding: 4,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5f6369",
    marginBottom: 10,
  },
  travelerCountInput: {
    backgroundColor: "#f6f7f9",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#e1e5ea",
    marginBottom: 14,
  },
  paymentSummaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 18,
  },
  paymentSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  paymentSummaryRowTotal: {
    marginTop: 4,
    marginBottom: 0,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  paymentSummaryLabel: {
    fontSize: 14,
    color: "#64748b",
  },
  paymentSummaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  paymentSummaryTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f1f1f",
  },
  paymentSummaryTotalValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#166534",
  },
  esewaCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 14,
    marginBottom: 16,
  },
  esewaCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  esewaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dcfce7",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  esewaBadgeText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 13,
  },
  esewaAmount: {
    color: "#166534",
    fontWeight: "800",
    fontSize: 16,
  },
  esewaMetaText: {
    color: "#166534",
    fontSize: 12,
    lineHeight: 18,
  },
  bookingBackLink: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 14,
  },
  bookingBackLinkText: {
    color: "#1f6b2a",
    fontWeight: "700",
    fontSize: 14,
  },
  autoVerifyInfoCard: {
    marginTop: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  autoVerifyInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  autoVerifyInfoText: {
    flex: 1,
    color: "#475569",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  esewaWebViewSafe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  esewaWebViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
  },
  esewaWebViewCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  esewaWebViewHeaderCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  esewaWebViewTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  esewaWebViewSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  esewaWebViewLoadingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f0fdf4",
    borderBottomWidth: 1,
    borderBottomColor: "#dcfce7",
  },
  esewaWebViewLoadingText: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "600",
  },
  esewaWebView: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  esewaWebViewFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  esewaWebViewFallbackText: {
    fontSize: 15,
    color: "#b91c1c",
    textAlign: "center",
    fontWeight: "600",
  },
  ratingSelector: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  reviewInput: {
    backgroundColor: "#f6f7f9",
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: "#1f1f1f",
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#e1e5ea",
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: "#1f6b2a",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default DetailsScreen;

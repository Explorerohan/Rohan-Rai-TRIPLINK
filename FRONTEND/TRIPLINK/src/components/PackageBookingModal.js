import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useLanguage } from "../context/LanguageContext";
import { initiateEsewaPayment, verifyEsewaPayment } from "../utils/api";
import { useAppAlert } from "./AppAlertProvider";

const formatPrice = (price) => {
  let numericValue = 0;
  if (typeof price === "number") {
    numericValue = price;
  } else if (typeof price === "string") {
    const cleaned = price.replace(/[^0-9.]/g, "");
    numericValue = parseFloat(cleaned) || 0;
  }
  return `Rs. ${numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
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

/**
 * Booking + eSewa flow extracted for reuse (e.g. custom package detail without navigating to DetailsScreen).
 */
const PackageBookingModal = ({
  visible,
  onClose,
  packageId,
  packageDetail,
  packageDetailLoading,
  session,
  initialProfile,
  onBook,
}) => {
  const { t } = useLanguage();
  const { showAlert } = useAppAlert();
  const [bookingStep, setBookingStep] = useState("traveler_count");
  const [travelerCountInput, setTravelerCountInput] = useState("1");
  const [paymentSession, setPaymentSession] = useState(null);
  const [initiatingPayment, setInitiatingPayment] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [esewaWebViewVisible, setEsewaWebViewVisible] = useState(false);
  const [esewaWebViewLoading, setEsewaWebViewLoading] = useState(false);
  const paymentCallbackHandledRef = useRef(false);
  const [rewardPointsInput, setRewardPointsInput] = useState("");

  useEffect(() => {
    if (!visible) return;
    setBookingStep("traveler_count");
    setTravelerCountInput("1");
    setPaymentSession(null);
    setRewardPointsInput("");
    setInitiatingPayment(false);
    setVerifyingPayment(false);
    setEsewaWebViewVisible(false);
    setEsewaWebViewLoading(false);
    paymentCallbackHandledRef.current = false;
  }, [visible, packageId]);

  const unitPrice =
    packageDetail?.has_active_deal && packageDetail?.deal_price != null
      ? parsePriceValue(packageDetail.deal_price)
      : parsePriceValue(packageDetail?.price_per_person ?? 0);
  const travelerCount = Math.max(parseInt(travelerCountInput, 10) || 1, 1);
  const computedTotal = unitPrice * travelerCount;
  const availableRewardPoints =
    (paymentSession?.available_reward_points ?? initialProfile?.reward_points ?? 0) || 0;
  const maxRewardPointsForBooking = Math.min(availableRewardPoints, Math.floor(computedTotal) || 0);
  const normalizedRewardPointsToUse = Math.max(
    0,
    Math.min(parseInt(rewardPointsInput, 10) || 0, maxRewardPointsForBooking)
  );
  const discountedTotal = Math.max(0, computedTotal - normalizedRewardPointsToUse);
  const esewaPostSource = useMemo(() => buildEsewaPostSource(paymentSession), [paymentSession]);

  const closeBookingModal = () => {
    onClose();
  };

  const handleContinueToPayment = async () => {
    if (!session?.access) {
      showAlert({ title: t("loginRequired"), message: t("pleaseLoginToContinue"), type: "warning" });
      return;
    }
    if (!packageId) {
      showAlert({ title: t("error"), message: t("invalidPackage"), type: "error" });
      return;
    }

    try {
      setInitiatingPayment(true);
      const { data } = await initiateEsewaPayment(
        packageId,
        travelerCount,
        session.access,
        normalizedRewardPointsToUse
      );
      if (data?.zero_payment) {
        onBook?.(data || null);
        closeBookingModal();
        showAlert({ title: t("paymentSuccessful"), message: t("bookingCompletedWithRewardPoints"), type: "success" });
        return;
      }

      setPaymentSession(data || null);
      paymentCallbackHandledRef.current = false;
      setBookingStep("payment");
    } catch (error) {
      showAlert({ title: t("paymentSetupFailed"), message: error?.message || t("couldNotStartEsewa"), type: "error" });
    } finally {
      setInitiatingPayment(false);
    }
  };

  const verifyEsewaPaymentAndBook = async ({ silent = false } = {}) => {
    const transactionUuid = paymentSession?.transaction_uuid;
    if (!session?.access || !transactionUuid) {
      if (!silent) showAlert({ title: t("error"), message: t("paymentSessionMissing"), type: "error" });
      return;
    }

    try {
      setVerifyingPayment(true);
      const { data } = await verifyEsewaPayment(transactionUuid, session.access);
      onBook?.(data || null);
      closeBookingModal();
      showAlert({ title: t("paymentSuccessful"), message: t("paymentCompleteBooked"), type: "success" });
      return true;
    } catch (error) {
      if (!silent) {
        showAlert({ title: t("verificationFailed"), message: error?.message || t("paymentNotVerified"), type: "error" });
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
      showAlert({ title: t("paymentFailed"), message: t("esewaCancelledOrFailed"), type: "error" });
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
      showAlert({ title: t("paymentSubmitted"), message: t("verificationTakingLonger"), type: "warning" });
    })();
    return true;
  };

  const handleOpenEsewaCheckout = async () => {
    if (!esewaPostSource) {
      showAlert({ title: t("error"), message: t("paymentCheckoutMissingError"), type: "error" });
      return;
    }
    paymentCallbackHandledRef.current = false;
    setEsewaWebViewVisible(true);
    setEsewaWebViewLoading(true);
  };

  const alreadyBooked = !!packageDetail?.user_has_booked;

  const renderBody = () => {
    if (packageDetailLoading || !packageDetail) {
      return (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color="#1f6b2a" />
          <Text style={styles.loadingLabel}>{t("loading")}</Text>
        </View>
      );
    }

    if (alreadyBooked) {
      return (
        <View style={styles.loadingBlock}>
          <Ionicons name="checkmark-circle" size={40} color="#1f6b2a" />
          <Text style={styles.alreadyBookedModalText}>{t("alreadyBooked")}</Text>
          <TouchableOpacity style={styles.submitButton} onPress={closeBookingModal} activeOpacity={0.85}>
            <Text style={styles.submitButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (bookingStep === "traveler_count") {
      return (
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
            <View style={styles.paymentSummaryDivider} />
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryLabel}>{t("availableRewardPoints")}</Text>
              <Text style={styles.paymentSummaryValue}>{availableRewardPoints}</Text>
            </View>
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryLabel}>{t("useRewardPoints")}</Text>
              <TextInput
                style={styles.rewardPointsInput}
                keyboardType="number-pad"
                value={rewardPointsInput}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, "").slice(0, 7);
                  const numeric = parseInt(cleaned || "0", 10);
                  const clamped = Math.max(0, Math.min(numeric, maxRewardPointsForBooking));
                  setRewardPointsInput(clamped === 0 ? "" : String(clamped));
                }}
                placeholder="0"
                placeholderTextColor="#9aa0a6"
              />
            </View>
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryHint}>
                {t("maxRewardPointsNote")}: {maxRewardPointsForBooking}
              </Text>
            </View>
            <View style={styles.paymentSummaryRow}>
              <Text style={styles.paymentSummaryLabel}>{t("discountFromPoints")}</Text>
              <Text style={styles.paymentSummaryValue}>
                {normalizedRewardPointsToUse > 0 ? `- ${formatPrice(normalizedRewardPointsToUse)}` : formatPrice(0)}
              </Text>
            </View>
            <View style={[styles.paymentSummaryRow, styles.paymentSummaryRowTotal]}>
              <Text style={styles.paymentSummaryTotalLabel}>{t("amountToPayWithEsewa")}</Text>
              <Text style={styles.paymentSummaryTotalValue}>{formatPrice(discountedTotal)}</Text>
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
              <Text style={styles.submitButtonText}>
                {normalizedRewardPointsToUse > 0 && discountedTotal === 0
                  ? t("bookWithRewardPoints")
                  : t("continueToEsewa")}
              </Text>
            )}
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <Text style={styles.modalLabel}>{t("paymentMethod")}</Text>
        <View style={styles.esewaCard}>
          <View style={styles.esewaCardHeader}>
            <View style={styles.esewaBadge}>
              <Ionicons name="wallet-outline" size={18} color="#166534" />
              <Text style={styles.esewaBadgeText}>eSewa</Text>
            </View>
            <Text style={styles.esewaAmount}>
              {formatPrice(
                parsePriceValue(paymentSession?.payable_amount || paymentSession?.total_amount || computedTotal)
              )}
            </Text>
          </View>
          <Text style={styles.esewaMetaText}>
            Travelers: {paymentSession?.traveler_count || travelerCount} | Per person:{" "}
            {formatPrice(paymentSession?.price_per_person || unitPrice)}
          </Text>
          <Text style={styles.esewaMetaText}>Transaction: {paymentSession?.transaction_uuid || "-"}</Text>
          {paymentSession?.reward_points_used ? (
            <Text style={styles.esewaMetaText}>
              {t("rewardPointsApplied")}: {paymentSession.reward_points_used} ({t("amountToPayWithEsewa")}{" "}
              {formatPrice(
                parsePriceValue(paymentSession?.payable_amount || paymentSession?.total_amount || computedTotal)
              )}
              )
            </Text>
          ) : null}
        </View>

        <TouchableOpacity style={styles.esewaOpenButton} activeOpacity={0.88} onPress={handleOpenEsewaCheckout}>
          <Text style={styles.esewaOpenButtonText}>{t("openEsewaPayment")}</Text>
          <Ionicons name="open-outline" size={18} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.autoVerifyInfoCard}>
          {verifyingPayment ? (
            <View style={styles.autoVerifyInfoRow}>
              <ActivityIndicator size="small" color="#1f6b2a" />
              <Text style={styles.autoVerifyInfoText}>{t("verifyingPayment")}</Text>
            </View>
          ) : (
            <Text style={styles.autoVerifyInfoText}>{t("afterEsewaSuccess")}</Text>
          )}
        </View>

        <TouchableOpacity style={styles.bookingBackLink} onPress={() => setBookingStep("traveler_count")} activeOpacity={0.75}>
          <Text style={styles.bookingBackLinkText}>{t("editTravelerCount")}</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={closeBookingModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("bookTrip")}</Text>
              <TouchableOpacity onPress={closeBookingModal} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#6b7076" />
              </TouchableOpacity>
            </View>
            {renderBody()}
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
              <Text style={styles.esewaWebViewSubtitle}>{t("completePaymentInside")}</Text>
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
                if (progress >= 0.5 || url.includes("esewa.com.np")) {
                  setEsewaWebViewLoading(false);
                }
              }}
              onError={(event) => {
                setEsewaWebViewLoading(false);
                const msg = event?.nativeEvent?.description || t("failedToLoadEsewaPage");
                showAlert({ title: t("paymentPageError"), message: msg, type: "error" });
              }}
              onHttpError={(event) => {
                setEsewaWebViewLoading(false);
                const statusCode = event?.nativeEvent?.statusCode;
                showAlert({
                  title: t("paymentPageError"),
                  message: `${t("esewaPageReturnedHttp")} ${statusCode || "error"}.`,
                  type: "error",
                });
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
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
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
  paymentSummaryDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 8,
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
  paymentSummaryHint: {
    fontSize: 12,
    color: "#64748b",
    flex: 1,
  },
  rewardPointsInput: {
    minWidth: 72,
    textAlign: "right",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  loadingBlock: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  loadingLabel: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 8,
  },
  alreadyBookedModalText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#166534",
    textAlign: "center",
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
  esewaOpenButton: {
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
  esewaOpenButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
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
});

export default PackageBookingModal;

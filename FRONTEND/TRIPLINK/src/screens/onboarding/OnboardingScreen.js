import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import slideFinal from "./slides/SlideFinal";
import slideOne from "./slides/SlideOne";
import slideThree from "./slides/SlideThree";
import slideTwo from "./slides/SlideTwo";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const imageHeight = Math.min(screenHeight * 0.53, 500);
const STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
const FINAL_HERO = require("../../Assets/Login screen image.png");
const LOGO = require("../../Assets/Logo.png");

const slides = [slideOne, slideTwo, slideThree, slideFinal];

const Dot = ({ active }) => <View style={[styles.dot, active ? styles.dotActive : styles.dotInactive]} />;

const StandardCard = ({ item, onSkip, onNext }) => (
  <View style={styles.slide}>
    <View style={styles.card}>
      <View style={styles.imageWrapper}>
        <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
        <TouchableOpacity onPress={onSkip} style={styles.skipButton} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{item.titleTop}</Text>
          <Text style={styles.title}>
            {item.titleBottom} <Text style={styles.accent}>{item.accent}</Text>
          </Text>
          <Text style={styles.description} numberOfLines={3} ellipsizeMode="tail">
            {item.description}
          </Text>

          <View style={styles.dotsRow}>
            {slides
              .filter((s) => s.type === "standard")
              .map((slide) => (
                <Dot key={slide.id} active={slide.id === item.id} />
              ))}
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cta} activeOpacity={0.8} onPress={onNext}>
            <Text style={styles.ctaText}>{item.cta}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </View>
);

const FinalCard = ({ item, onLoginPress, onSignupPress }) => (
  <View style={styles.finalSlide}>
    <View style={styles.header}>
      <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
    </View>
    <View style={styles.finalContent}>
      <Text style={styles.finalTitle}>{item.titleTop}</Text>
      <Text style={[styles.finalTitle, styles.finalAccent]}>{item.titleBottom}</Text>
      <Image source={FINAL_HERO} style={styles.finalImage} resizeMode="contain" />
      <Text style={styles.finalBody}>{item.description}</Text>
      <View style={styles.finalActions}>
        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={onLoginPress}>
          <Text style={styles.primaryText}>{item.primary}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={onSignupPress}>
          <Text style={styles.secondaryText}>{item.secondary}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const OnboardingScreen = ({ onLoginPress = () => {}, onSignupPress = () => {} }) => {
  const listRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSkip = () => {
    const lastIndex = slides.length - 1;
    listRef.current?.scrollToIndex({ index: lastIndex, animated: true });
  };

  const handleNext = () => {
    const nextIndex = Math.min(currentIndex + 1, slides.length - 1);
    if (nextIndex !== currentIndex) {
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
  };

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0;
      setCurrentIndex(idx);
    }
  }).current;

  const renderItem = ({ item }) => {
    if (item.type === "final") {
      return <FinalCard item={item} onLoginPress={onLoginPress} onSignupPress={onSignupPress} />;
    }
    return <StandardCard item={item} onSkip={handleSkip} onNext={handleNext} />;
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  slide: {
    width: screenWidth,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  card: {
    width: screenWidth,
    flex: 1,
    backgroundColor: "#ffffff",
  },
  imageWrapper: {
    width: screenWidth,
    height: imageHeight,
    overflow: "hidden",
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  skipButton: {
    position: "absolute",
    right: 22,
    top: 50,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skipText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
  },
  content: {
    width: screenWidth,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    minHeight: screenHeight - imageHeight,
  },
  textBlock: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 8,
    marginBottom: 12,
    height: 240,
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1f1f1f",
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 10,
  },
  accent: {
    color: "#f27f1b",
    fontWeight: "800",
  },
  description: {
    fontSize: 14,
    color: "#6f747a",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
    paddingHorizontal: 12,
    width: "100%",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 22,
  },
  footer: {
    width: "100%",
    paddingBottom: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: "#1f6b2a",
  },
  dotInactive: {
    backgroundColor: "#c6cdd3",
  },
  cta: {
    backgroundColor: "#1f6b2a",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  // Final screen styles
  finalSlide: {
    width: screenWidth,
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 10 + STATUS_BAR_HEIGHT,
    paddingBottom: 12,
  },
  header: {
    paddingTop: 0,
    paddingBottom: 14,
    alignItems: "flex-start",
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  finalContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  finalTitle: {
    fontSize: 35,
    fontWeight: "900",
    color: "#1c1c1c",
    textAlign: "center",
    marginTop: -6,
  },
  finalAccent: {
    color: "#3f7540",
    marginBottom: 10,
  },
  finalImage: {
    width: "100%",
    height: 550,
    marginBottom: 10,
  },
  finalBody: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5f6369",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  finalActions: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
    marginBottom: 0,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#1f6b2a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e5ea",
  },
  secondaryText: {
    color: "#1f1f1f",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default OnboardingScreen;

import React, { useRef, useState } from "react";
import { Dimensions, FlatList, Image, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const imageHeight = Math.min(screenHeight * 0.55, 520);

const slides = [
  {
    id: "1",
    titleTop: "Life is short and the",
    titleBottom: "world is",
    accent: "wide",
    description:
      "At Friends tours and travel, we customize reliable and trustworthy educational tours to destinations all over the world",
    cta: "Get Started",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "2",
    titleTop: "It's a big world out",
    titleBottom: "there go",
    accent: "explore",
    description: "To get the best of your adventure you just need to leave and go where you like. we are waiting for you",
    cta: "Next",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "3",
    titleTop: "People don't take trips,",
    titleBottom: "trips take",
    accent: "people",
    description: "To get the best of your adventure you just need to leave and go where you like. we are waiting for you",
    cta: "Next",
    image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
  },
];

const Dot = ({ active }) => <View style={[styles.dot, active ? styles.dotActive : styles.dotInactive]} />;

const OnboardingCard = ({ item, onSkip, onNext }) => (
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
          <Text style={styles.description}>{item.description}</Text>

          <View style={styles.dotsRow}>
            {slides.map((slide) => (
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

const OnboardingScreen = () => {
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <OnboardingCard item={item} onSkip={handleSkip} onNext={handleNext} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
    </SafeAreaView>
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
    paddingTop: 10,
    paddingBottom: 32,
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    minHeight: screenHeight - imageHeight,
  },
  textBlock: {
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 8,
    marginBottom: 18,
    minHeight: 180,
    justifyContent: "center",
  },
  title: {
    fontSize: 35,
    fontWeight: "800",
    color: "#1f1f1f",
    textAlign: "center",
    lineHeight: 40,
    marginBottom: 16,
  },
  accent: {
    color: "#f27f1b",
    fontWeight: "800",
  },
  description: {
    fontSize: 14,
    color: "#6f747a",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 10,
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
});

export default OnboardingScreen;

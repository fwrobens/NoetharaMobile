import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sparkles, ArrowRight } from 'lucide-react-native';
import { colors, radius, space, type } from './theme';

export default function App() {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View
          style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}
        >
          <View style={styles.badge}>
            <Sparkles size={14} color={colors.accent} />
            <Text style={styles.badgeText}>READY</Text>
          </View>
          <Text style={styles.title}>Your app starts here</Text>
          <Text style={styles.body}>Edit src/App.tsx. This screen runs in Expo and in the live preview.</Text>
          <Pressable style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]} accessibilityRole="button">
            <Text style={styles.ctaText}>Get started</Text>
            <ArrowRight size={18} color={colors.bg} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.xl, maxWidth: 560, width: '100%', alignSelf: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.accentSoft, marginBottom: space.lg },
  badgeText: { ...type.overline, color: colors.accent },
  title: { ...type.display, color: colors.text, marginBottom: space.sm },
  body: { ...type.body, color: colors.textMuted, marginBottom: space.xxl },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.lg, backgroundColor: colors.text },
  ctaPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  ctaText: { ...type.headline, color: colors.bg },
});

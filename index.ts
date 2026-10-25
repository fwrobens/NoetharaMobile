import React from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// Important: load App *inside* a child render rather than importing it at
// module scope. A JS error while evaluating one of its imports can then be
// displayed by the error boundary instead of leaving an unexplained blank app.
function MainApp() {
  // Metro supports dynamic module evaluation through its require function.
  // Keep this string literal so Metro can still bundle the complete project.
  const NoetharaApp = require('./App').default as React.ComponentType;
  return React.createElement(NoetharaApp);
}

type BootState = { error: Error | null; attempt: number };
class BootBoundary extends React.Component<{ children: React.ReactNode }, BootState> {
  state: BootState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<BootState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Noethara boot error]', error.message, info.componentStack);
  }

  retry = () => {
    this.setState(({ attempt }) => ({ error: null, attempt: attempt + 1 }));
  };

  render() {
    if (!this.state.error) {
      return React.createElement(React.Fragment, { key: this.state.attempt }, this.props.children);
    }
    const error = this.state.error;
    return React.createElement(View, { style: styles.root },
      React.createElement(View, { style: styles.panel },
        React.createElement(Text, { style: styles.eyebrow }, 'NOETHARA DEV · STARTUP CHECK'),
        React.createElement(Text, { style: styles.title }, 'Could not finish starting.'),
        React.createElement(Text, { style: styles.description },
          'A JavaScript error occurred while opening Noethara. Your account and cloud projects are unchanged.'),
        React.createElement(ScrollView, { style: styles.errorPanel, contentContainerStyle: styles.errorContent },
          React.createElement(Text, { selectable: true, style: styles.error },
            String(error?.message || error))),
        React.createElement(Pressable, { onPress: this.retry, style: styles.button, accessibilityRole: 'button' },
          React.createElement(Text, { style: styles.buttonText }, 'Try opening again')),
        React.createElement(Text, { style: styles.hint },
          'Share the error above to help diagnose the failed startup.'),
      ),
    );
  }
}

function Root() {
  // Exporting the web bundle downloads font assets but doesn't guarantee the
  // browser registered their @font-face definitions before drawing glyphs.
  // Preload both icon families used by Noethara to avoid square tofu icons.
  const [fontsLoaded, fontError] = useFonts({
    ...Feather.font,
    ...MaterialCommunityIcons.font,
  });
  if (!fontsLoaded && !fontError) return null;
  return React.createElement(
    BootBoundary,
    null,
    React.createElement(MainApp),
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FCFAF7', justifyContent: 'center', paddingHorizontal: 24 },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 24, borderColor: '#EAE6E1', borderWidth: 1, padding: 24 },
  eyebrow: { fontSize: 11, color: '#7859BA', fontWeight: '700', letterSpacing: 1.5, marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#292629', letterSpacing: -0.7 },
  description: { fontSize: 14, lineHeight: 21, color: '#7F7B81', marginTop: 12, marginBottom: 18 },
  errorPanel: { maxHeight: 170, backgroundColor: '#F9F4F2', borderColor: '#EFDAD3', borderWidth: 1, borderRadius: 12 },
  errorContent: { padding: 13 },
  error: { color: '#AD6151', fontSize: 12, lineHeight: 18 },
  button: { backgroundColor: '#7552BA', alignItems: 'center', justifyContent: 'center', borderRadius: 13, minHeight: 48, marginTop: 20 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  hint: { color: '#948F93', fontSize: 11, marginTop: 17, lineHeight: 17 },
});

registerRootComponent(Root);

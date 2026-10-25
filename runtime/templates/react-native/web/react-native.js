// react-native -> react-native-web bridge for the live preview.
// Adds no-op stubs for native-only APIs that some libraries import at module load.
export * from 'react-native-web';
export const TurboModuleRegistry = { get: () => null, getEnforcing: () => null };

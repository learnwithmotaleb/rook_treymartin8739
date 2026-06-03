import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 *
 * This app uses a fixed dark-only theme (both light and dark keys in
 * constants/colors.ts resolve to the same dark palette). We intentionally
 * avoid calling useColorScheme() here: react-native-web's implementation
 * causes an "Invalid hook call" in Metro's Expo web bundle due to a React
 * reconciler mismatch. Since the palettes are identical, skipping the hook
 * has no visual effect and makes the function safe to call from any component
 * on all platforms including web.
 */
export function useColors() {
  const palette = "dark" in colors
    ? (colors as Record<string, typeof colors.light>).dark
    : colors.light;
  return { ...palette, radius: colors.radius };
}

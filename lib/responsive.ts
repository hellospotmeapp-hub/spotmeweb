import { Platform, useWindowDimensions } from 'react-native';

// Web layouts switch from the phone UI (bottom tabs, single column) to the
// website UI (top navigation, centered content, grids) at this width.
export const WIDE_BREAKPOINT = 768;
export const DESKTOP_BREAKPOINT = 1100;

export const PAGE_MAX_WIDTH = 1200;     // tab pages (home, browse, ...)
export const READING_MAX_WIDTH = 880;   // detail pages (need, settings, legal, ...)

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  return {
    width,
    isWide,
    isDesktop,
    // How many need cards fit side by side
    columns: isDesktop ? 3 : isWide ? 2 : 1,
  };
}

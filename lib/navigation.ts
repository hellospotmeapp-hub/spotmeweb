import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

// Back when there's history; otherwise (e.g. a page opened from a shared link) go home.
export function goBack(router: Router) {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

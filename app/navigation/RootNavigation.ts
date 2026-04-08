// app/navigation/RootNavigation.ts
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Add a queue for navigation actions while container is not ready
let pendingNavigation: { name: keyof RootStackParamList; params?: any } | null = null;

export function navigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    // @ts-ignore
    navigationRef.navigate(name, params);
    pendingNavigation = null;
  } else {
    console.log('Navigation not ready, queuing navigation to:', name);
    pendingNavigation = { name, params };
    // Try again after a short delay
    setTimeout(() => {
      if (navigationRef.isReady() && pendingNavigation) {
        // @ts-ignore
        navigationRef.navigate(pendingNavigation.name, pendingNavigation.params);
        pendingNavigation = null;
      }
    }, 500);
  }
}

// Call this when navigation is ready (optional)
export function onNavigationReady() {
  if (pendingNavigation && navigationRef.isReady()) {
    // @ts-ignore
    navigationRef.navigate(pendingNavigation.name, pendingNavigation.params);
    pendingNavigation = null;
  }
}
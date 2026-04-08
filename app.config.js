export default {
  expo: {
    name: "Vesphe",
    slug: "Vespher",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0a0a0a"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.femi-ceo.Vespher",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Vesphe needs your location to show nearby deliveries and track rides",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Vesphe needs your location to track deliveries in real-time",
        NSLocationAlwaysUsageDescription: "Vesphe needs your location to track deliveries even when app is in background"
      }
    },
    android: {
       "googleServicesFile": "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#0a0a0a",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png"
      },
      predictiveBackGestureEnabled: false,
      package: "com.femi_ceo.Vespher",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "WAKE_LOCK"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-web-browser",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Vesphe to track your location for deliveries",
          locationWhenInUsePermission: "Allow Vesphe to find nearby deliveries",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true
        }
      ],
      // ✅ Simplified expo-notifications plugin - uses defaults, no custom icon/sound required
      "expo-notifications"
    ],
    extra: {
      eas: {
        projectId: "2bea9b11-6d4d-4aad-98a7-4708269a65c2"
      }
    }
  }
};
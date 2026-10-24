export default {
  expo: {
    
    name: "Vesphe",
    slug: "Vespher",
    // Deep links (Google sign-in returns to vesphe://auth-callback)
    scheme: "vesphe",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.femi-ceo.Vespher",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Vesphe uses your location to show nearby vendors and set your delivery address."
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
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#0a0a0a"
        }
      ],
      "expo-status-bar",
      "@react-native-community/datetimepicker",
      "expo-font",
      "expo-web-browser",
      [
        "expo-location",
        {
          // Foreground only: background location is for the rider app and gets
          // store-rejected without a background feature that needs it.
          locationWhenInUsePermission: "Allow Vesphe to use your location to find nearby vendors and set your delivery address.",
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false
        }
      ],
      "expo-notifications",
      [
        "expo-image-picker",
        {
          photosPermission: "Vesphe needs access to your photos so you can upload profile, store and menu images.",
          cameraPermission: "Vesphe uses the camera so you can take photos for your profile, store and menu."
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "2bea9b11-6d4d-4aad-98a7-4708269a65c2"
      }
    }
  }
};
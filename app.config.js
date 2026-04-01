// app.config.js
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
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Vesphe needs your location to show nearby deliveries and track rides",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Vesphe needs your location to track deliveries in real-time",
        NSLocationAlwaysUsageDescription: "Vesphe needs your location to track deliveries even when app is in background"
      }
    },
    android: {
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
        "FOREGROUND_SERVICE"
      ]
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
      [
        "@rnmapbox/maps",
        {
          // ✅ Use process.env here - it works in .js file!
          RNMapboxMapsDownloadToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
          RNMapboxMapsVersion: "10.16.4"
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
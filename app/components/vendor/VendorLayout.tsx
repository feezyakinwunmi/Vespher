// app/components/vendor/VendorLayout.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

export type VendorTab = 
  | 'overview' 
  | 'orders' 
  | 'menu' 
  | 'earnings' 
  | 'settings' 
  | 'history'
  | 'promos' 
  | 'analytics';

interface VendorLayoutProps {
  children: React.ReactNode;
  activeTab: VendorTab;
  onTabChange: (tab: VendorTab) => void;
  title?: string;
  showHeader?: boolean;
  headerRight?: React.ReactNode;
}



export function VendorLayout({ 
  children, 
  activeTab, 
  onTabChange,
  title,
  showHeader = true,
  headerRight,
}: VendorLayoutProps) {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      {/* Header */}
      {/* {showHeader && (
       // app/components/vendor/VendorLayout.tsx
// Update the back button handler:

<View style={styles.header}>
  <View style={styles.headerLeft}>
    <TouchableOpacity 
      onPress={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          // If can't go back, navigate to appropriate tab
          navigation.navigate('VendorTabs' as never);
        }
      }} 
      style={styles.backButton}
    >
      <Feather name="arrow-left" size={24} color="#fff" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title || activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</Text>
  </View>
  {headerRight && (
    <View style={styles.headerRight}>
      {headerRight}
    </View>
  )}
</View>
      )} */}

      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {children}
      </ScrollView>

     
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100, // Space for bottom nav
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'transparent',
  },
  navGradient: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  navLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  navLabelActive: {
    color: '#f97316',
  },
});
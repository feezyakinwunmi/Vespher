// app/screens/SuspendedScreen.tsx
import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export function SuspendedScreen() {
  const { user, signOut } = useAuth();

  const handleContactEmail = () => {
    Linking.openURL('mailto:support@vesphe.com?subject=Account%20Suspension%20Appeal');
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:+2349161460898');
  };

  const handleDispute = () => {
    Linking.openURL('https://vesphe.com/support/dispute');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconContainer}>
          <Feather name="alert-octagon" size={80} color="#ef4444" />
        </View>

        <Text style={styles.title}>Account Suspended</Text>

        <Text style={styles.subtitle}>
          Your account has been suspended due to suspicious activity or a violation of our terms of service.
        </Text>

        {user && (
          <View style={styles.userInfoCard}>
            <Text style={styles.userName}>{user.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.userRole}>{user.role.toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.messageCard}>
          <Text style={styles.message}>
            You currently cannot access any features of the app. If you believe this suspension is a mistake or would like to appeal, please contact our support team.
          </Text>
        </View>

        <View style={styles.supportSection}>
          <Text style={styles.supportTitle}>Contact Support</Text>

          <TouchableOpacity style={styles.supportButton} onPress={handleCallSupport}>
            <View style={[styles.iconBg, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Feather name="phone" size={24} color="#10b981" />
            </View>
            <View>
              <Text style={styles.supportButtonText}>Call Support</Text>
              <Text style={styles.supportButtonSub}>+234 916 146 0898</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.supportButton} onPress={handleContactEmail}>
            <View style={[styles.iconBg, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Feather name="mail" size={24} color="#3b82f6" />
            </View>
            <View>
              <Text style={styles.supportButtonText}>Email Support</Text>
              <Text style={styles.supportButtonSub}>support@vesphe.com</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.disputeButton} onPress={handleDispute}>
            <Feather name="file-text" size={20} color="#f97316" />
            <Text style={styles.disputeButtonText}>File a Dispute</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  userInfoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 15,
    color: '#bbb',
    marginBottom: 8,
  },
  userRole: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '600',
    backgroundColor: 'rgba(249,115,22,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  message: {
    fontSize: 15,
    color: '#ffcccc',
    textAlign: 'center',
    lineHeight: 22,
  },
  supportSection: {
    width: '100%',
    marginBottom: 40,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 16,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  supportButtonSub: {
    fontSize: 13,
    color: '#888',
  },
  disputeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(249,115,22,0.12)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f97316',
    marginTop: 8,
  },
  disputeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f97316',
  },
  signOutButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
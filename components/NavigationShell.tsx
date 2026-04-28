import React from 'react';
import { View, Text, useWindowDimensions, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Home, Package, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/Colors';
import { Nav } from '@expo/html-elements';

export default function NavigationShell({ children, currentTab, onTabChange }) {
  const { width } = useWindowDimensions();
  const isWeb = width > 768;

  const { t } = useTranslation();

  const TABS = [
    { key: 'home', label: t('nav.home', 'Home'), icon: Home },
    { key: 'orders', label: t('nav.shipping', 'Orders'), icon: Package },
    { key: 'account', label: t('nav.account', 'Account'), icon: User },
  ];

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        {/* Sidebar */}
        <Nav style={styles.sidebar}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>RENAX</Text>
          </View>
          <View style={styles.sidebarNav}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                  onPress={() => onTabChange && onTabChange(tab.key)}
                >
                  <Icon color={isActive ? Colors.accent : '#FFFFFF'} size={24} />
                  <Text style={[styles.sidebarItemText, isActive && styles.sidebarItemTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Nav>
        {/* Content */}
        <View style={styles.webContent}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mobileContainer}>
      <View style={styles.mobileContent}>
        {children}
      </View>
      {/* Bottom Tab Bar */}
      <View style={styles.bottomTabBar}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabBtn}
              onPress={() => onTabChange && onTabChange(tab.key)}
            >
              <Icon color={isActive ? Colors.accent : '#FFFFFF'} size={24} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 250,
    backgroundColor: Colors.primary,
    paddingTop: 40,
    paddingHorizontal: 20,
    height: '100%',
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logoText: {
    color: Colors.accent,
    fontSize: 28,
    fontWeight: 'bold',
  },
  sidebarNav: {
    gap: 15,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    gap: 15,
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sidebarItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sidebarItemTextActive: {
    color: Colors.accent,
  },
  webContent: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mobileContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mobileContent: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#003328',
  },
  tabBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  tabLabelActive: {
    color: Colors.accent,
    fontWeight: 'bold',
  },
});

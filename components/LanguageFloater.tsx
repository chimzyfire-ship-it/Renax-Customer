// LanguageFloater.tsx — Floating language switcher with real i18next integration
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../i18n';
import { Languages, Check } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOut, useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';

const LANGS = [
  { code: 'en',  label: 'English',         flag: '🇬🇧' },
  { code: 'pcm', label: 'Nigerian Pidgin',  flag: '🇳🇬' },
  { code: 'ha',  label: 'Hausa',            flag: '🟢' },
  { code: 'yo',  label: 'Yoruba',           flag: '🟡' },
  { code: 'ig',  label: 'Igbo',             flag: '🔵' },
];

export default function LanguageFloater() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const glass = Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {};

  const select = async (code) => {
    await setAppLanguage(code);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      {open && (
          <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut} style={[styles.menu, glass]}>
          <Text style={styles.menuTitle}>🌍 {t('lang.title', 'Language')}</Text>
          {LANGS.map(lang => (
            <Pressable
              key={lang.code}
              style={({ hovered }) => [styles.item, hovered && styles.itemHover]}
              onPress={() => select(lang.code)}
            >
              <Text style={styles.flag}>{lang.flag}</Text>
              <Text style={[styles.itemText, i18n.language === lang.code && { color: '#ccfd3a' }]}>
                {lang.label}
              </Text>
              {i18n.language === lang.code && <Check color="#ccfd3a" size={14} style={{ marginLeft: 'auto' }} />}
            </Pressable>
          ))}
        </Animated.View>
      )}
      <Pressable
        onHoverIn={() => { if (Platform.OS === 'web') scale.value = withSpring(1.12); }}
        onHoverOut={() => { if (Platform.OS === 'web') scale.value = withSpring(1); }}
        onPress={() => setOpen(p => !p)}
      >
        <Animated.View style={[styles.fab, open && styles.fabOpen, anim]}>
          <Languages color={open ? '#002B22' : '#ccfd3a'} size={22} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as any,
    bottom: 32,
    right: 32,
    alignItems: 'flex-end',
    zIndex: 9999,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0, 77, 61, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(204, 253, 58, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ccfd3a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  fabOpen: {
    backgroundColor: '#ccfd3a',
    borderColor: '#ccfd3a',
  },
  menu: {
    backgroundColor: 'rgba(4, 25, 16, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(204, 253, 58, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  menuTitle: {
    fontFamily: 'Outfit_6',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
  },
  itemHover: {
    backgroundColor: 'rgba(204,253,58,0.07)',
  },
  flag: {
    fontSize: 18,
  },
  itemText: {
    fontFamily: 'Outfit_6',
    fontSize: 14,
    color: '#e8f5ee',
  },
});

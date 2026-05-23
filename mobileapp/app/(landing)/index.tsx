import React from 'react';
import {
  View, Text, StyleSheet, ImageBackground, TouchableOpacity,
  Linking, Platform, SafeAreaView
} from 'react-native';
import { useRouter, Stack } from 'expo-router';

export default function LandingPage() {
  const router = useRouter();

  const handleOpenWebsite = async () => {
    const url = 'https://hassanskdev.online/';
    //const url = 'https://amfofana.vercel.app/';
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/fofana.png')}
      style={s.background}
      resizeMode="cover"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.overlay, { backgroundColor: 'rgba(15, 23, 42, 0.75)' }]}>
        <SafeAreaView style={s.safeArea}>
          <View style={s.container}>

            {/* Header / Logo section */}
            <View style={s.header}>
              <View style={s.badge}>
                <Text style={s.badgeText}>ACADEMIC EXCELLENCE</Text>
              </View>
              <Text style={s.title}>AMF</Text>
              <Text style={s.subtitle}>ENGLISH & ISLAMIC</Text>
              <Text style={s.subtitle}>HIGH SCHOOL</Text>
              <View style={s.divider} />
              <Text style={s.description}>
                Empowering the next generation of leaders with quality education, modern tools, and an environment of excellence.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={s.footer}>
              {/* Access Web App Button */}
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={handleOpenWebsite}
                activeOpacity={0.8}
              >
                <Text style={s.primaryBtnText}>Access School Website</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={() => router.push('/(auth)/login')}
                activeOpacity={0.8}
              >
                <Text style={s.secondaryBtnText}>Member Portal Login</Text>
              </TouchableOpacity>

              <Text style={s.footerMeta}>Secure System Access • © AMF School</Text>
            </View>

          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, paddingHorizontal: 24 },
  safeArea: { flex: 1 },
  container: { flex: 1, justifyContent: 'space-between', paddingVertical: Platform.OS === 'ios' ? 20 : 40 },
  header: { flex: 1, justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(56, 189, 248, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)' },
  badgeText: { color: '#38bdf8', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: 64, fontWeight: '900', color: '#fff', fontStyle: 'italic', letterSpacing: -2, lineHeight: 64 },
  subtitle: { fontSize: 36, fontWeight: '900', color: '#f8fafc', letterSpacing: -1, lineHeight: 38 },
  divider: { width: 60, height: 4, backgroundColor: '#3b82f6', borderRadius: 2, marginVertical: 24 },
  description: { color: '#94a3b8', fontSize: 16, fontWeight: '500', lineHeight: 26, paddingRight: 40 },
  footer: { paddingBottom: 20 },
  primaryBtn: { backgroundColor: '#2563eb', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  secondaryBtn: { backgroundColor: 'rgba(255, 255, 255, 0.1)', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', marginBottom: 30 },
  secondaryBtnText: { color: '#f8fafc', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  footerMeta: { textAlign: 'center', color: '#475569', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
});

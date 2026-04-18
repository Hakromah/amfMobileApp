import { Stack, useSegments, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function RootNavigationGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    // Wait until the auth rehydration has completed
    if (isLoading) return;

    // Check if the current route is protected
    const inProtectedGroup = ['(admin)', '(student)', '(teacher)'].includes(segments[0]);

    if (!user && inProtectedGroup) {
      // User logged out, safely kick them back to the landing page
      router.replace('/(landing)');
    }
  }, [user, isLoading, segments]);

  return (
    <Stack>
      {/* Required base entry point intercept */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Root Landing Page */}
      <Stack.Screen name="(landing)" options={{ headerShown: false }} />
      {/* Authenticated portal */}
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen name="(student)" options={{ headerShown: false }} />
      <Stack.Screen name="(teacher)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigationGuard />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

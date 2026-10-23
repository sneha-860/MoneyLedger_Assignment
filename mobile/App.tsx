import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { tokenStorage } from './src/tokenStorage';

// Only two screens, so no navigation library: show Login until we have a token, then Home.
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Stay logged in across app restarts.
  useEffect(() => {
    tokenStorage.get().then(setToken).finally(() => setRestoring(false));
  }, []);

  const login = useCallback((t: string) => {
    tokenStorage.set(t);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {restoring ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : token ? (
        <HomeScreen token={token} onLogout={logout} />
      ) : (
        <LoginScreen onLoggedIn={login} />
      )}
    </SafeAreaProvider>
  );
}

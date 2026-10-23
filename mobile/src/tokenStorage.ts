import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Keeps the login token between app launches. SecureStore (Keychain/Keystore) on
// phones; it isn't available on web, so fall back to localStorage there.
const KEY = 'miniledger.token';
const isWeb = Platform.OS === 'web';

export const tokenStorage = {
  get: (): Promise<string | null> =>
    isWeb ? Promise.resolve(localStorage.getItem(KEY)) : SecureStore.getItemAsync(KEY),

  set: async (token: string) => {
    if (isWeb) localStorage.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token);
  },

  clear: async () => {
    if (isWeb) localStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  },
};

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { Button } from '../components/Button';
import { colors } from '../theme';

// Two steps on one screen: enter phone -> enter the OTP (printed in the backend log).
export function LoginScreen({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    setLoading(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const sendOtp = () =>
    run(async () => {
      await api.requestOtp(phone);
      setStep('otp');
    });

  const verify = () =>
    run(async () => {
      const { token } = await api.verifyOtp(phone, code);
      onLoggedIn(token);
    });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.brand}>MiniLedger</Text>
      <Text style={styles.tagline}>Keep track of money you’ve lent to friends.</Text>

      <View style={styles.card}>
        {step === 'phone' ? (
          <>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="98765 43210"
              keyboardType="phone-pad"
              autoFocus
              onSubmitEditing={sendOtp}
            />
            <Button title="Send OTP" onPress={sendOtp} loading={loading} disabled={!phone.trim()} />
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter the 6-digit OTP sent to {phone}</Text>
            <Text style={styles.hint}>(Mock SMS: check the backend server log.)</Text>
            <TextInput
              style={[styles.input, styles.otp]}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              placeholder="••••••"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              onSubmitEditing={verify}
            />
            <Button title="Verify & log in" onPress={verify} loading={loading} disabled={code.length !== 6} />
            <View style={{ height: 10 }} />
            <Button
              title="Change number"
              variant="secondary"
              onPress={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            />
          </>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  brand: { fontSize: 34, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  tagline: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 14, color: colors.text, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.muted, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 17,
    marginBottom: 14,
    color: colors.text,
  },
  otp: { letterSpacing: 8, textAlign: 'center', fontSize: 22 },
  error: { color: colors.danger, marginTop: 12, textAlign: 'center' },
});

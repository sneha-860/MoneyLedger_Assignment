import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NewLoan } from '../api';
import { isoDateFromToday } from '../format';
import { colors } from '../theme';
import { Button } from './Button';

type Props = {
  onSubmit: (loan: NewLoan) => Promise<void>;
  onCancel: () => void;
};

// Same rules as the backend's zod schema, checked here first for instant feedback.
// The server validates again, and its message is shown if it disagrees.
function validate(friendName: string, amount: string, dueDate: string): string | null {
  if (!friendName.trim()) return 'Enter your friend’s name';
  if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0)
    return 'Enter an amount greater than 0 (up to 2 decimals)';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) return 'Due date must be YYYY-MM-DD';
  return null;
}

export function AddLoanForm({ onSubmit, onCancel }: Props) {
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(isoDateFromToday(7));
  const [receipt, setReceipt] = useState<NewLoan['receipt']>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickReceipt() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    setReceipt({
      uri: asset.uri,
      mimeType,
      fileName: asset.fileName ?? `receipt.${mimeType.split('/')[1] ?? 'jpg'}`,
    });
  }

  async function submit() {
    const problem = validate(friendName, amount, dueDate);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ friendName: friendName.trim(), amount: amount.trim(), dueDate: dueDate.trim(), receipt });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the entry');
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>New entry</Text>

      <Text style={styles.label}>Friend’s name</Text>
      <TextInput style={styles.input} value={friendName} onChangeText={setFriendName} placeholder="e.g. Asha" autoFocus />

      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="500" keyboardType="decimal-pad" />

      <Text style={styles.label}>Due date</Text>
      <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" maxLength={10} />

      <View style={styles.receiptRow}>
        {receipt && <Image source={{ uri: receipt.uri }} style={styles.thumb} />}
        <Pressable onPress={pickReceipt}>
          <Text style={styles.link}>{receipt ? 'Change receipt photo' : '+ Attach receipt photo (optional)'}</Text>
        </Pressable>
        {receipt && (
          <Pressable onPress={() => setReceipt(undefined)}>
            <Text style={[styles.link, { color: colors.muted }]}>Remove</Text>
          </Pressable>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={saving} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Save" onPress={submit} loading={saving} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { backgroundColor: colors.card, borderRadius: 16, padding: 20 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  label: { fontSize: 13, color: colors.muted, marginTop: 12, marginBottom: 4 },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
  },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  thumb: { width: 48, height: 48, borderRadius: 6 },
  link: { color: colors.primary, fontWeight: '600' },
  error: { color: colors.danger, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
});

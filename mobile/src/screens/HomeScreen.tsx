import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError, type Loan, type NewLoan, type Summary } from '../api';
import { AddLoanForm } from '../components/AddLoanForm';
import { Button } from '../components/Button';
import { LoanItem } from '../components/LoanItem';
import { SummaryCard } from '../components/SummaryCard';
import { colors } from '../theme';

type Props = { token: string; onLogout: () => void };

export function HomeScreen({ token, onLogout }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [repayingId, setRepayingId] = useState<number | null>(null);

  // List and summary are fetched together after every change so the totals stay in sync.
  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([api.listLoans(token), api.summary(token)]);
      setLoans(l);
      setSummary(s);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onLogout(); // token expired
      else setError(e instanceof Error ? e.message : 'Could not load entries');
    }
  }, [token, onLogout]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function addLoan(loan: NewLoan) {
    await api.addLoan(token, loan); // errors bubble up to the form, which shows them
    setAdding(false);
    await load();
  }

  async function markRepaid(loan: Loan) {
    setRepayingId(loan.id);
    try {
      await api.markRepaid(token, loan.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the entry');
    } finally {
      setRepayingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MiniLedger</Text>
        <Pressable onPress={onLogout}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={
            <View style={{ marginBottom: 16 }}>
              {summary && <SummaryCard summary={summary} />}
              {error && <Text style={styles.error}>{error}</Text>}
              <Text style={styles.section}>Entries</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No entries yet. Tap “Add entry” to record a loan.</Text>}
          renderItem={({ item }) => (
            <LoanItem loan={item} onMarkRepaid={markRepaid} busy={repayingId === item.id} />
          )}
        />
      )}

      <View style={styles.footer}>
        <Button title="+ Add entry" onPress={() => setAdding(true)} />
      </View>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={styles.modalBackdrop}>
          <AddLoanForm onSubmit={addLoan} onCancel={() => setAdding(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.primary },
  logout: { color: colors.muted, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 20, textTransform: 'uppercase' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
  error: { color: colors.danger, marginTop: 12 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.4)' },
});

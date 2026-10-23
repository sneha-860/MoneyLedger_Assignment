import { StyleSheet, Text, View } from 'react-native';
import type { Summary } from '../api';
import { formatRupees } from '../format';
import { colors } from '../theme';

export function SummaryCard({ summary }: { summary: Summary }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Outstanding</Text>
      <Text style={styles.big}>{formatRupees(summary.outstanding)}</Text>
      <View style={styles.row}>
        <Stat label="Total lent" value={formatRupees(summary.totalLent)} />
        <Stat label="Repaid" value={formatRupees(summary.totalRepaid)} color={colors.success} />
        <Stat
          label={summary.overdueCount ? `Overdue (${summary.overdueCount})` : 'Overdue'}
          value={formatRupees(summary.overdueAmount)}
          color={summary.overdueAmount > 0 ? colors.danger : undefined}
        />
      </View>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  big: { fontSize: 30, fontWeight: '700', color: colors.text, marginTop: 2, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1 },
  label: { fontSize: 12, color: colors.muted },
  value: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 2 },
});

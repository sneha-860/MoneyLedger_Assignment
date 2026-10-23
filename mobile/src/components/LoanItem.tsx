import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { API_URL, type Loan } from '../api';
import { formatDate, formatRupees } from '../format';
import { colors } from '../theme';

type Props = {
  loan: Loan;
  onMarkRepaid: (loan: Loan) => void;
  busy: boolean;
};

// One entry in the list. Overdue entries get a red border and badge; repaid ones are dimmed.
export function LoanItem({ loan, onMarkRepaid, busy }: Props) {
  const repaid = loan.repaidAt !== null;
  const receiptUri = loan.receiptUrl ? API_URL + loan.receiptUrl : null;

  return (
    <View style={[styles.card, loan.isOverdue && styles.overdueCard, repaid && styles.repaidCard]}>
      {receiptUri && (
        <Pressable onPress={() => Linking.openURL(receiptUri)} accessibilityLabel="Open receipt">
          <Image source={{ uri: receiptUri }} style={styles.thumb} />
        </Pressable>
      )}

      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>{loan.friendName}</Text>
        <Text style={[styles.meta, loan.isOverdue && { color: colors.danger }]}>
          {repaid ? 'Repaid' : `Due ${formatDate(loan.dueDate)}`}
        </Text>
        {loan.isOverdue && <Text style={styles.badge}>OVERDUE</Text>}
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, repaid && styles.struck]}>{formatRupees(loan.amount)}</Text>
        {!repaid && (
          <Pressable onPress={() => onMarkRepaid(loan)} disabled={busy} style={styles.repayBtn}>
            <Text style={styles.repayText}>{busy ? 'Saving…' : 'Mark repaid'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overdueCard: { borderColor: colors.danger, borderLeftWidth: 5, backgroundColor: colors.dangerBg },
  repaidCard: { opacity: 0.55 },
  thumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: colors.border },
  middle: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.danger,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 17, fontWeight: '700', color: colors.text },
  struck: { textDecorationLine: 'line-through' },
  repayBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.primary },
  repayText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
});

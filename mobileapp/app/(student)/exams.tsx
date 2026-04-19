import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import api from '@/hooks/lib/api';

interface Exam {
  id: number;
  name: string;
  date: string;
  term?: string;
  startTime?: string;
  endTime?: string;
  weight?: number;
  closed?: boolean;
  classe?: { name: string };
}

export default function StudentExamsScreen() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchExams = async () => {
    try {
      const { data } = await api.get('/student/exams');
      const sorted = (data || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setExams(sorted);
    } catch {
      Alert.alert('Error', 'Failed to load assessment schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchExams(); }, []);

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={s.loadingText}>Syncing Academic Calendar...</Text>
    </View>
  );

  return (
    <FlatList
      data={exams}
      keyExtractor={i => String(i.id)}
      contentContainerStyle={s.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchExams(); }} tintColor="#2563eb" />}
      ListHeaderComponent={
        <>
          <View style={s.header}>
            <View>
              <Text style={s.titleText}>Exam <Text style={{ color: '#2563eb' }}>Pulse.</Text></Text>
              <Text style={s.subText}>UPCOMING ASSESSMENTS</Text>
            </View>
            <View style={s.totalCard}>
              <View style={s.totalIcon}><Text>📖</Text></View>
              <View>
                <Text style={s.totalLabel}>TOTAL</Text>
                <Text style={s.totalValue}>{exams.length}</Text>
              </View>
            </View>
          </View>
          {exams.length > 0 && <Text style={s.listLabel}>ASSESSMENT RECORD</Text>}
        </>
      }
      ListEmptyComponent={
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>NO ASSESSMENTS</Text>
        </View>
      }
      renderItem={({ item }) => {
        return (
          <View style={s.card}>
            {/* Top row: Name & Subject */}
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.examName}>{item.name}</Text>
                <Text style={s.className}>CLASS: {item.classe?.name || 'N/A'}</Text>
              </View>
              <View style={s.termBox}>
                <Text style={s.termText}>{item.term || 'TERM'}</Text>
                <Text style={s.weightText}>WEIGHT: {item.weight || 0}%</Text>
              </View>
            </View>

            {/* Bottom Row: Date & Status */}
            <View style={s.cardBottom}>
              <View style={s.dateGroup}>
                <Text style={s.dateText}>📅 {item.date}</Text>
                <Text style={s.timeText}>🕒 {item.startTime?.slice(0, 5)} - {item.endTime?.slice(0, 5)}</Text>
              </View>

              {item.closed ? (
                <View style={s.statusPending}>
                  <Text style={s.statusPendingText}>⌛ RESULTS PENDING</Text>
                </View>
              ) : (
                <View style={s.statusUpcoming}>
                  <Text style={s.statusUpcomingText}>🔥 UPCOMING</Text>
                </View>
              )}
            </View>
          </View>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', gap: 12 },
  loadingText: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', fontStyle: 'italic' },
  list: { padding: 16, backgroundColor: '#f8fafc', flexGrow: 1, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, marginTop: 10 },
  titleText: { fontSize: 28, fontWeight: '900', color: '#0f172a', fontStyle: 'italic', letterSpacing: -1 },
  subText: { fontSize: 9, color: '#64748b', fontWeight: '800', letterSpacing: 2, marginTop: 4 },
  totalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  totalIcon: { backgroundColor: '#eff6ff', width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  totalLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '900', letterSpacing: 1 },
  totalValue: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  listLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '900', letterSpacing: 2, marginBottom: 12, marginLeft: 4 },
  emptyBox: { padding: 40, alignItems: 'center', opacity: 0.5 },
  emptyTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  examName: { fontSize: 15, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: -0.5 },
  className: { fontSize: 10, color: '#3b82f6', fontWeight: '800', marginTop: 4, letterSpacing: 1 },
  termBox: { alignItems: 'flex-end', gap: 4 },
  termText: { fontSize: 10, fontWeight: '900', color: '#64748b', fontStyle: 'italic' },
  weightText: { fontSize: 9, fontWeight: '800', color: '#94a3b8', backgroundColor: '#f8fafc', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  dateGroup: { gap: 6 },
  dateText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  timeText: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' },
  statusPending: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusPendingText: { color: '#94a3b8', fontSize: 9, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
  statusUpcoming: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusUpcomingText: { color: '#059669', fontSize: 9, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
});

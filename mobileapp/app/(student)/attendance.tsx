import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, Modal, ScrollView
} from 'react-native';
import api from '@/hooks/lib/api';

interface AttendanceSession {
  id: number;
  date: string;
  classe?: { name: string };
  records: { id: number; present: boolean }[];
}

const MONTHS = ['All Months', 'January', 'February', 'March', 'April'];

export default function StudentAttendanceScreen() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>('All Months');
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchAttendance = async () => {
    try {
      const res = await api.get('/student/attendance');
      setSessions(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      console.error('[Student Attendance]', e);
      Alert.alert('Error', 'Failed to load registry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAttendance(); }, []);

  const filtered = sessions.filter(session => {
    if (monthFilter === 'All Months') return true;
    const date = new Date(session.date);
    const monthName = date.toLocaleString('default', { month: 'long' });
    return monthName === monthFilter;
  });

  const total = filtered.length;
  const present = filtered.filter(s => s.records?.[0]?.present).length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={s.loadingText}>Decrypting Registry...</Text>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Registry <Text style={{ color: '#2563eb' }}>Pulse</Text></Text>
          <Text style={s.headerSub}>Academic Tracking • Term 2 Year 2026</Text>
        </View>
        <TouchableOpacity style={s.filterBtn} onPress={() => setPickerOpen(true)}>
          <Text style={s.filterText}>{monthFilter}</Text>
          <Text style={s.filterIcon}>▼</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAttendance(); }} tintColor="#2563eb" />}
        ListHeaderComponent={
          <>
            {/* Stats Card */}
            <View style={s.statsCard}>
              <View style={s.statsTop}>
                <View>
                  <Text style={s.statsLabel}>ATTENDANCE RATE</Text>
                  <Text style={s.statsValue}>{rate}%</Text>
                </View>
                <View style={s.liveBadge}><Text style={s.liveText}>LIVE DATA</Text></View>
              </View>
              <View style={s.statsBottom}>
                <View style={s.trackRow}>
                  <Text style={s.trackLabel}>CONSISTENCY TRACK</Text>
                  <Text style={[s.trackVal, rate > 75 ? { color: '#34d399' } : { color: '#fb7185' }]}>
                    {present} / {total} Sessions
                  </Text>
                </View>
                <View style={s.progressBar}><View style={[s.progressFill, { width: `${rate}%` }]} /></View>
              </View>
            </View>

            {/* Last Entry Card */}
            <View style={s.lastCard}>
              <View style={s.lastIcon}><Text style={{ fontSize: 20 }}>🕒</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.lastLabel}>LAST ENTRY</Text>
                <Text style={s.lastValue}>
                  {sessions[0] ? new Date(sessions[0].date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'N/A'}
                </Text>
              </View>
            </View>
            <Text style={s.sectionTitle}>REGISTRY LOG</Text>
          </>
        }
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyTitle}>No Registry Data Found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isPresent = item.records?.[0]?.present;
          return (
            <View style={s.card}>
              <View style={s.cardIcon}>
                <Text style={{ fontSize: 16 }}>📅</Text>
              </View>
              <View style={s.cardInfo}>
                <Text style={s.cardClass}>{item.classe?.name || 'Class Session'}</Text>
                <Text style={s.cardDate}>{new Date(item.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
              </View>
              <View style={[s.statusBadge, isPresent ? s.statusPresent : s.statusAbsent]}>
                <Text style={[s.statusText, isPresent ? s.statusTextPresent : s.statusTextAbsent]}>
                  {isPresent ? 'Verified Present' : 'Marked Absent'}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Picker Modal */}
      <Modal visible={pickerOpen} animationType="fade" transparent onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Filter by Month</Text>
            <ScrollView>
              {MONTHS.map(m => (
                <TouchableOpacity key={m} style={s.modalItem} onPress={() => { setMonthFilter(m); setPickerOpen(false); }}>
                  <Text style={[s.modalItemText, monthFilter === m && s.modalItemTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748b', fontWeight: '700', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' },
  header: { padding: 20, paddingTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', letterSpacing: -1 },
  headerSub: { fontSize: 9, color: '#64748b', fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  filterText: { fontSize: 12, fontWeight: '800', color: '#2563eb' },
  filterIcon: { fontSize: 10, color: '#2563eb' },
  list: { padding: 16, gap: 12, paddingTop: 0 },
  statsCard: { backgroundColor: '#0f172a', borderRadius: 24, padding: 24, marginBottom: 12, overflow: 'hidden' },
  statsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  statsLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  statsValue: { color: '#fff', fontSize: 44, fontWeight: '900', fontStyle: 'italic', marginTop: 4, letterSpacing: -2 },
  liveBadge: { backgroundColor: '#1e3a8a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  liveText: { color: '#60a5fa', fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  statsBottom: {},
  trackRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  trackLabel: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  trackVal: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  progressBar: { height: 10, backgroundColor: '#1e293b', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 5 },
  lastCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4 },
  lastIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  lastLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  lastValue: { color: '#1e293b', fontSize: 18, fontWeight: '900', fontStyle: 'italic', marginTop: 2 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4 },
  cardIcon: { backgroundColor: '#2563eb', padding: 10, borderRadius: 12 },
  cardInfo: { flex: 1 },
  cardClass: { fontSize: 13, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', textTransform: 'uppercase' },
  cardDate: { fontSize: 11, color: '#64748b', fontWeight: '800', marginTop: 2 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  statusPresent: { backgroundColor: '#ecfdf5' }, statusTextPresent: { color: '#059669' },
  statusAbsent: { backgroundColor: '#fff1f2' }, statusTextAbsent: { color: '#e11d48' },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 12, fontWeight: '900', color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, maxHeight: 400 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 16 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalItemText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  modalItemTextActive: { color: '#2563eb', fontWeight: '900' },
});

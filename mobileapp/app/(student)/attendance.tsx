import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, Modal, ScrollView
} from 'react-native';
import api from '@/hooks/lib/api';

interface AttendanceSession {
  id: number;
  date: string;
  classe?: { name: string };
  subjectName?: string;
  sessionTime?: string;
  notes?: string;
  records: { id: number; present: boolean; status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'SICK' }[];
}

const STATUS_STYLES = {
  PRESENT: { label: 'Present', color: '#10b981', bg: '#ecfdf5' },
  ABSENT: { label: 'Absent', color: '#ef4444', bg: '#fef2f2' },
  LATE: { label: 'Late', color: '#f59e0b', bg: '#fffbeb' },
  EXCUSED: { label: 'Excused', color: '#3b82f6', bg: '#eff6ff' },
  SICK: { label: 'Sick', color: '#8b5cf6', bg: '#f5f3ff' },
};

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

  const uniqueMonths = useMemo(() => {
    const months = sessions.map(session => {
      if (!session.date) return null;
      const date = new Date(session.date);
      return date.toLocaleString('default', { month: 'long' });
    }).filter(Boolean) as string[];
    return ['All Months', ...Array.from(new Set(months))];
  }, [sessions]);

  const filtered = useMemo(() => {
    if (monthFilter === 'All Months') return sessions;
    return sessions.filter(session => {
      if (!session.date) return false;
      const date = new Date(session.date);
      const monthName = date.toLocaleString('default', { month: 'long' });
      return monthName === monthFilter;
    });
  }, [sessions, monthFilter]);

  const stats = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let sickCount = 0;

    filtered.forEach(session => {
      const rec = session.records?.[0];
      const status = rec?.status || (rec?.present ? 'PRESENT' : 'ABSENT');
      if (status === 'PRESENT') presentCount++;
      else if (status === 'ABSENT') absentCount++;
      else if (status === 'LATE') lateCount++;
      else if (status === 'EXCUSED') excusedCount++;
      else if (status === 'SICK') sickCount++;
    });

    const total = filtered.length;
    const rate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

    return { total, presentCount, absentCount, lateCount, excusedCount, sickCount, rate };
  }, [filtered]);

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
          <Text style={s.headerSub}>Academic Tracking • Year 2026</Text>
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
                  <Text style={s.statsValue}>{stats.rate}%</Text>
                </View>
                <View style={s.liveBadge}><Text style={s.liveText}>LIVE DATA</Text></View>
              </View>
              <View style={s.statsBottom}>
                <View style={s.trackRow}>
                  <Text style={s.trackLabel}>SUMMARY MATRIX</Text>
                  <Text style={[s.trackVal, stats.rate >= 75 ? { color: '#34d399' } : { color: '#fb7185' }]}>
                    {stats.presentCount}P · {stats.lateCount}L · {stats.absentCount}A · {stats.excusedCount}E · {stats.sickCount}S
                  </Text>
                </View>
                <View style={s.progressBar}><View style={[s.progressFill, { width: `${stats.rate}%` }]} /></View>
              </View>
            </View>

            {/* Low Attendance Warning */}
            {stats.total > 5 && stats.rate < 75 && (
              <View style={s.warningCard}>
                <Text style={s.warningIcon}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.warningTitle}>CRITICAL ATTENDANCE WARNING</Text>
                  <Text style={s.warningSub}>Your attendance rate has fallen below 75% ({stats.rate}%). Please contact your class teacher to prevent academic probation.</Text>
                </View>
              </View>
            )}

            {/* Last Entry Card */}
            <View style={s.lastCard}>
              <View style={s.lastIcon}><Text style={{ fontSize: 20 }}>🕒</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.lastLabel}>LAST LOG ENTRY</Text>
                <Text style={s.lastValue}>
                  {sessions[0] ? new Date(sessions[0].date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
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
          const rec = item.records?.[0];
          const status = rec?.status || (rec?.present ? 'PRESENT' : 'ABSENT');
          const details = STATUS_STYLES[status] || STATUS_STYLES.PRESENT;
          return (
            <View style={[s.card, { borderLeftWidth: 6, borderLeftColor: details.color }]}>
              <View style={s.cardIcon}>
                <Text style={{ fontSize: 16 }}>📅</Text>
              </View>
              <View style={s.cardInfo}>
                <Text style={s.cardClass}>{item.classe?.name || 'Class Session'}</Text>
                <Text style={s.cardSubject}>{item.subjectName || item.notes || 'General Session'}</Text>
                <View style={s.metaRow}>
                  <Text style={s.cardDate}>{new Date(item.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                  {item.sessionTime && <Text style={s.cardTime}>⏰ {item.sessionTime}</Text>}
                </View>
              </View>
              <View style={[s.statusBadge, { backgroundColor: details.bg }]}>
                <Text style={[s.statusText, { color: details.color }]}>
                  {details.label}
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
              {uniqueMonths.map(m => (
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
  
  // Warning card
  warningCard: { flexDirection: 'row', backgroundColor: '#fff1f2', borderColor: '#ffe4e6', borderWidth: 1, borderRadius: 20, padding: 16, gap: 12, marginBottom: 16 },
  warningIcon: { fontSize: 24 },
  warningTitle: { color: '#e11d48', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  warningSub: { color: '#f43f5e', fontSize: 11, fontWeight: '700', marginTop: 4, lineHeight: 16 },

  lastCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4 },
  lastIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  lastLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  lastValue: { color: '#1e293b', fontSize: 18, fontWeight: '900', fontStyle: 'italic', marginTop: 2 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4 },
  cardIcon: { backgroundColor: '#eff6ff', padding: 10, borderRadius: 12 },
  cardInfo: { flex: 1, gap: 2 },
  cardClass: { fontSize: 13, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', textTransform: 'uppercase' },
  cardSubject: { fontSize: 11, color: '#475569', fontWeight: '800' },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cardDate: { fontSize: 10, color: '#94a3b8', fontWeight: '700' },
  cardTime: { fontSize: 10, color: '#94a3b8', fontWeight: '700' },
  
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  statusText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
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

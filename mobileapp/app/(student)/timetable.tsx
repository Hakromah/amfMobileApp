import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, RefreshControl, Alert
} from 'react-native';
import api from '@/hooks/lib/api';

interface TimetableEntry {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject?: { name: string };
  classe?: { name: string };
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_BG: Record<string, string> = {
  MONDAY: '#0f172a', TUESDAY: '#1e3a5f', WEDNESDAY: '#1e3565',
  THURSDAY: '#1e2d5a', FRIDAY: '#0f2359',
};
const DAY_ACCENT: Record<string, string> = {
  MONDAY: '#2563eb', TUESDAY: '#8b5cf6', WEDNESDAY: '#10b981',
  THURSDAY: '#f59e0b', FRIDAY: '#ef4444',
};

export default function StudentTimetableScreen() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Default to today's weekday
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const [activeDay, setActiveDay] = useState(DAYS.includes(todayStr) ? todayStr : 'MONDAY');

  const fetchTimetable = async () => {
    try {
      // ✅ Correct endpoint matches frontend
      const res = await api.get('/student/timetables');
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      console.error('[Student Timetable]', e);
      Alert.alert('Error', 'Could not sync schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchTimetable(); }, []);

  const dayEntries = entries
    .filter(e => e.dayOfWeek === activeDay)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const accent = DAY_ACCENT[activeDay] || '#2563eb';

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={s.loadingText}>Syncing Schedule...</Text>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Day Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabs}>
        {DAYS.map(day => (
          <TouchableOpacity
            key={day}
            style={[s.tab, activeDay === day && { backgroundColor: DAY_ACCENT[day] }]}
            onPress={() => setActiveDay(day)}
          >
            <Text style={[s.tabText, activeDay === day && s.tabTextActive]}>
              {day.substring(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Date Header */}
      <View style={[s.header, { backgroundColor: DAY_BG[activeDay] || '#0f172a' }]}>
        <Text style={[s.headerTitle, { color: accent }]}>● {activeDay}</Text>
        <Text style={s.headerSub}>{dayEntries.length} {dayEntries.length === 1 ? 'class' : 'classes'} scheduled</Text>
      </View>

      <FlatList
        data={dayEntries}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTimetable(); }} tintColor="#2563eb" />}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyTitle}>SCHEDULE EMPTY</Text>
            <Text style={s.emptyText}>No classes for {activeDay.toLowerCase()}.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            {/* Time block */}
            <View style={[s.timeBlock, { backgroundColor: DAY_BG[item.dayOfWeek] || '#0f172a' }]}>
              <Text style={s.timeStart}>{(item.startTime || '').substring(0, 5)}</Text>
              <Text style={s.timeSep}>→</Text>
              <Text style={s.timeEnd}>{(item.endTime || '').substring(0, 5)}</Text>
            </View>
            {/* Details */}
            <View style={s.details}>
              <View style={s.typeBadge}>
                <Text style={s.typeText}>LECTURE</Text>
              </View>
              <Text style={s.subject} numberOfLines={1}>{item.subject?.name || 'Subject Missing'}</Text>
              <View style={s.metaRow}>
                <Text style={s.className}>🎓 {item.classe?.name || 'Class'}</Text>
                <Text style={s.className}>🏫 Room 404</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748b', fontWeight: '700', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  tabBar: { backgroundColor: '#fff', flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabs: { flexDirection: 'row', padding: 10, gap: 8 },
  tab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  tabText: { fontSize: 11, fontWeight: '900', color: '#64748b', letterSpacing: 1 },
  tabTextActive: { color: '#fff' },
  header: { padding: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', fontStyle: 'italic' },
  headerSub: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginTop: 4 },
  list: { padding: 16, gap: 14 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  timeBlock: { width: 90, padding: 16, justifyContent: 'center', alignItems: 'center', gap: 4 },
  timeStart: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: -0.5 },
  timeSep: { color: '#3b82f6', fontSize: 12 },
  timeEnd: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  details: { flex: 1, padding: 16, justifyContent: 'center', gap: 6 },
  typeBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  typeText: { color: '#16a34a', fontSize: 8, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  subject: { fontSize: 16, fontWeight: '900', color: '#1e293b', textTransform: 'uppercase', letterSpacing: -0.5, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  className: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  emptyBox: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', letterSpacing: 2 },
  emptyText: { fontSize: 13, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
});

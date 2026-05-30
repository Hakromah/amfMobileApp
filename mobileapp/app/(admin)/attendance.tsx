import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, ScrollView, TextInput, Modal
} from 'react-native';
import api from '@/hooks/lib/api';

interface AttendanceSession {
  id: number;
  date: string;
  sessionTime: string | null;
  subjectName: string | null;
  notes: string | null;
  className: string;
  classId: number;
  totalCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  attendanceRate: number;
  records: { studentId: number; studentName: string; userId: string; status: string }[];
}

interface Analytics {
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  overallRate: number;
  byClass: { name: string; total: number; present: number; late: number; rate: number }[];
}

const STATUS_DETAILS: Record<string, { label: string; color: string; bg: string }> = {
  PRESENT: { label: 'Present', color: '#10b981', bg: '#ecfdf5' },
  ABSENT: { label: 'Absent', color: '#ef4444', bg: '#fef2f2' },
  LATE: { label: 'Late', color: '#f59e0b', bg: '#fffbeb' },
  EXCUSED: { label: 'Excused', color: '#3b82f6', bg: '#eff6ff' },
  SICK: { label: 'Sick', color: '#8b5cf6', bg: '#f5f3ff' },
};

export default function AdminAttendanceScreen() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'sessions'>('analytics');
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);

  // Filters
  const [classFilter, setClassFilter] = useState('all');
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  const fetchData = async () => {
    try {
      const [sessionsRes, analyticsRes, classesRes] = await Promise.all([
        api.get('/admin/attendance'),
        api.get('/admin/attendance/analytics'),
        api.get('/admin/classes'),
      ]);
      setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
      setAnalytics(analyticsRes.data);
      setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
    } catch (e: any) {
      console.error('[Admin Attendance]', e);
      Alert.alert('Error', 'Failed to retrieve academic attendance registries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchesClass = classFilter === 'all' || String(s.classId) === classFilter;
      const matchesDate = !dateFilter || s.date === dateFilter;
      return matchesClass && matchesDate;
    });
  }, [sessions, classFilter, dateFilter]);

  const handleDeleteSession = (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this session? All student records associated with it will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/attendance/${id}`);
              setSessions(prev => prev.filter(s => s.id !== id));
              Alert.alert('Success', 'Session deleted successfully.');
            } catch {
              Alert.alert('Error', 'Failed to delete session.');
            }
          }
        }
      ]
    );
  };

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color="#10b981" />
      <Text style={s.loadingText}>Syncing Ledger...</Text>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Top Filter Bar */}
      <View style={s.headerCard}>
        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'analytics' && s.tabBtnActive]} onPress={() => setActiveTab('analytics')}>
            <Text style={[s.tabBtnText, activeTab === 'analytics' && s.tabBtnTextActive]}>📊 Analytics</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'sessions' && s.tabBtnActive]} onPress={() => setActiveTab('sessions')}>
            <Text style={[s.tabBtnText, activeTab === 'sessions' && s.tabBtnTextActive]}>📋 Sessions</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'sessions' && (
          <View style={s.filterRow}>
            <TouchableOpacity style={s.classBtn} onPress={() => setClassPickerOpen(true)}>
              <Text style={s.classBtnText} numberOfLines={1}>
                🏫 {classFilter === 'all' ? 'All Classes' : (classes.find(c => String(c.id) === classFilter)?.name || 'Class')}
              </Text>
              <Text style={s.classBtnIcon}>▼</Text>
            </TouchableOpacity>

            <TextInput
              style={s.dateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
              value={dateFilter}
              onChangeText={setDateFilter}
            />
          </View>
        )}
      </View>

      {activeTab === 'analytics' ? (
        // Analytics Tab
        analytics ? (
          <ScrollView
            contentContainerStyle={s.scrollContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#10b981" />}
          >
            {/* Overall Rate Card */}
            <View style={s.overallCard}>
              <Text style={s.overallLabel}>CAMPUS ATTENDANCE RATE</Text>
              <Text style={s.overallRate}>{analytics.overallRate}%</Text>
              <View style={s.progressBar}><View style={[s.progressFill, { width: `${analytics.overallRate}%` }]} /></View>
            </View>

            {/* Stat Cards */}
            <Text style={s.sectionTitle}>REGISTRY STATISTICS</Text>
            <View style={s.statsGrid}>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Present</Text>
                <Text style={[s.statVal, { color: '#10b981' }]}>{analytics.presentCount}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Absent</Text>
                <Text style={[s.statVal, { color: '#ef4444' }]}>{analytics.absentCount}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Late</Text>
                <Text style={[s.statVal, { color: '#f59e0b' }]}>{analytics.lateCount}</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Excused</Text>
                <Text style={[s.statVal, { color: '#3b82f6' }]}>{analytics.excusedCount}</Text>
              </View>
            </View>

            {/* Per-Class breakdown */}
            <Text style={s.sectionTitle}>CLASSROOM METRICS</Text>
            <View style={s.classMetrics}>
              {analytics.byClass?.map((cl, idx) => (
                <View key={idx} style={s.classMetricRow}>
                  <View style={s.classMetricMeta}>
                    <Text style={s.classNameText}>{cl.name}</Text>
                    <Text style={s.classRateText}>{cl.rate}%</Text>
                  </View>
                  <View style={s.miniProgressBar}>
                    <View style={[s.miniProgressFill, { width: `${cl.rate}%`, backgroundColor: cl.rate >= 75 ? '#10b981' : '#f59e0b' }]} />
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={s.emptyCentered}><Text style={s.emptyText}>Failed to load analytics registry.</Text></View>
        )
      ) : (
        // Sessions Tab
        <FlatList
          data={filteredSessions}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#10b981" />}
          ListEmptyComponent={
            <View style={s.emptyCentered}>
              <Text style={s.emptyIcon}>📅</Text>
              <Text style={s.emptyText}>No registered sessions found.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isExpanded = expandedSessionId === item.id;
            return (
              <View style={s.sessionCard}>
                <TouchableOpacity style={s.sessionCardHeader} onPress={() => setExpandedSessionId(isExpanded ? null : item.id)}>
                  <View style={{ flex: 1 }}>
                    <View style={s.sessionMetaRow}>
                      <Text style={s.sessionClass}>{item.className}</Text>
                      {item.sessionTime && <Text style={s.sessionTime}>⏰ {item.sessionTime}</Text>}
                    </View>
                    <Text style={s.sessionSubject}>{item.subjectName || item.notes || 'General Session'}</Text>
                    <Text style={s.sessionDate}>{new Date(item.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                  </View>
                  <View style={s.sessionStatsBlock}>
                    <Text style={s.sessionRate}>{item.attendanceRate}%</Text>
                    <Text style={s.sessionRateLabel}>Attendance</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={s.sessionExpandedContent}>
                    <Text style={s.expandedTitle}>Student Ledger ({item.records?.length || 0} registered)</Text>
                    {item.records?.map((rec, index) => {
                      const details = STATUS_DETAILS[rec.status] || STATUS_DETAILS.PRESENT;
                      return (
                        <View key={index} style={s.studentLeadRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.studentLeadName}>{rec.studentName}</Text>
                            <Text style={s.studentLeadId}>ID: {rec.userId || '-'}</Text>
                          </View>
                          <View style={[s.leadBadge, { backgroundColor: details.bg }]}>
                            <Text style={[s.leadBadgeText, { color: details.color }]}>{details.label}</Text>
                          </View>
                        </View>
                      );
                    })}

                    <TouchableOpacity style={s.deleteBtn} onPress={() => handleDeleteSession(item.id)}>
                      <Text style={s.deleteBtnText}>🗑 Delete Session Record</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Class picker modal */}
      <Modal visible={classPickerOpen} animationType="slide" transparent onRequestClose={() => setClassPickerOpen(false)}>
        <View style={s.pickerOverlay}>
          <View style={s.pickerCard}>
            <Text style={s.pickerTitle}>Filter by Class</Text>
            <ScrollView>
              {[{ id: 'all', name: 'All Classes' }, ...classes].map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.pickerItem, classFilter === String(c.id) && s.pickerItemActive]}
                  onPress={() => { setClassFilter(String(c.id)); setClassPickerOpen(false); }}
                >
                  <Text style={[s.pickerItemText, classFilter === String(c.id) && s.pickerItemTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.pickerClose} onPress={() => setClassPickerOpen(false)}>
              <Text style={s.pickerCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },

  // Header & Tabs
  headerCard: { backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 10 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  tabBtnActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  tabBtnText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  tabBtnTextActive: { color: '#fff' },

  filterRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  classBtn: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#dbeafe' },
  classBtnText: { fontSize: 12, fontWeight: '800', color: '#2563eb' },
  classBtnIcon: { fontSize: 10, color: '#2563eb' },
  dateInput: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, fontWeight: '600', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },

  // Scroll details
  scrollContainer: { padding: 16, paddingBottom: 40 },
  overallCard: { backgroundColor: '#0f172a', padding: 24, borderRadius: 24, marginBottom: 20 },
  overallLabel: { color: '#64748b', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  overallRate: { color: '#fff', fontSize: 44, fontWeight: '900', fontStyle: 'italic', marginVertical: 8 },
  progressBar: { height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },

  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: '48%', backgroundColor: '#fff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabel: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  statVal: { fontSize: 20, fontWeight: '900', marginTop: 4 },

  classMetrics: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  classMetricRow: { marginVertical: 8 },
  classMetricMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  classNameText: { fontSize: 12, fontWeight: '800', color: '#1e293b' },
  classRateText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  miniProgressBar: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  miniProgressFill: { height: '100%', borderRadius: 3 },

  // Sessions List
  listContainer: { padding: 14, gap: 10 },
  sessionCard: { backgroundColor: '#fff', borderRadius: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 },
  sessionCardHeader: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  sessionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionClass: { fontSize: 14, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', textTransform: 'uppercase' },
  sessionTime: { fontSize: 10, color: '#94a3b8', fontWeight: '700' },
  sessionSubject: { fontSize: 12, color: '#475569', fontWeight: '700', marginTop: 4 },
  sessionDate: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginTop: 4 },
  sessionStatsBlock: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 12 },
  sessionRate: { fontSize: 18, fontWeight: '900', color: '#10b981' },
  sessionRateLabel: { fontSize: 7, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginTop: 2 },

  sessionExpandedContent: { padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafbfb', gap: 8 },
  expandedTitle: { fontSize: 11, fontWeight: '900', color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  studentLeadRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  studentLeadName: { fontSize: 12, fontWeight: '800', color: '#1e293b' },
  studentLeadId: { fontSize: 9, color: '#94a3b8', fontWeight: '700' },
  leadBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, minWidth: 70, alignItems: 'center' },
  leadBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },

  deleteBtn: { backgroundColor: '#fef2f2', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  deleteBtnText: { color: '#ef4444', fontWeight: '900', fontSize: 11 },

  emptyCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, minHeight: 300 },
  emptyIcon: { fontSize: 44, marginBottom: 8 },
  emptyText: { color: '#94a3b8', fontSize: 12, fontWeight: '700', fontStyle: 'italic' },

  // Picker Overlay
  pickerOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%' },
  pickerTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 16 },
  pickerItem: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemActive: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12 },
  pickerItemText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  pickerItemTextActive: { color: '#10b981', fontWeight: '800' },
  pickerClose: { marginTop: 16, backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  pickerCloseText: { color: '#64748b', fontWeight: '800', fontSize: 14 },
});

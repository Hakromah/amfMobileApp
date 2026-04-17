import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, RefreshControl, Alert, Switch,
} from 'react-native';
import api from '@/lib/api';

interface Student {
  id: number;
  name?: string;
  username?: string;
  userId?: string;
}
interface ClassItem { id: number; name: string; }
interface AttendanceRecord { studentId: number; present: boolean; }
interface HistorySession {
  id: number;
  date: string;
  presentCount: number;
  totalCount: number;
  records: { studentId: number; status: string }[];
}

export default function TeacherAttendanceScreen() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [view, setView] = useState<'mark' | 'history'>('mark');
  const [isEditing, setIsEditing] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classPickerOpen, setClassPickerOpen] = useState(false);

  // Fetch teacher's classes on mount
  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/teacher/classes');
        setClasses(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        console.error('[Attendance] classes:', e?.response?.status);
        Alert.alert('Error', 'Failed to load classes.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchStudentsByClass = useCallback(async (classId: string) => {
    try {
      // ✅ Correct endpoint: /teacher/classes/:id/students
      const res = await api.get(`/teacher/classes/${classId}/students`);
      const list = Array.isArray(res.data) ? res.data : [];
      setStudents(list);
      if (!isEditing) {
        setAttendance(list.map((s: Student) => ({ studentId: s.id, present: true })));
      }
    } catch (e: any) {
      console.error('[Attendance] students:', e?.response?.status);
    }
  }, [isEditing]);

  const fetchHistory = async (classId: string) => {
    try {
      // ✅ Correct endpoint: /teacher/classes/:id/attendance-history
      const res = await api.get(`/teacher/classes/${classId}/attendance-history`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      console.error('[Attendance] history:', e?.response?.status);
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setIsEditing(false);
    setCurrentSessionId(null);
    setClassPickerOpen(false);
    if (view === 'mark') {
      fetchStudentsByClass(classId);
    } else {
      fetchHistory(classId);
    }
  };

  const handleEditSession = async (session: HistorySession) => {
    try {
      setIsEditing(true);
      setCurrentSessionId(session.id);
      const studentRes = await api.get(`/teacher/classes/${selectedClass}/students`);
      setStudents(Array.isArray(studentRes.data) ? studentRes.data : []);
      setAttendance(session.records.map(r => ({
        studentId: r.studentId,
        present: r.status === 'PRESENT',
      })));
      setView('mark');
    } catch (e) {
      Alert.alert('Error', 'Failed to load session details.');
    }
  };

  const handleSubmit = async () => {
    if (!selectedClass) return;
    setSubmitting(true);
    const payload = {
      classId: parseInt(selectedClass),
      date: new Date().toISOString().split('T')[0],
      records: attendance.map(a => ({
        studentId: a.studentId,
        status: a.present ? 'PRESENT' : 'ABSENT',
      })),
    };
    try {
      if (isEditing && currentSessionId) {
        // ✅ Correct endpoint: PUT /teacher/attendance/:sessionId
        await api.put(`/teacher/attendance/${currentSessionId}`, payload);
        Alert.alert('Success', 'Session updated successfully.');
        setIsEditing(false);
        setCurrentSessionId(null);
        setView('history');
        fetchHistory(selectedClass);
      } else {
        // ✅ Correct endpoint: POST /teacher/attendance
        await api.post('/teacher/attendance', payload);
        Alert.alert('Success', 'Attendance finalized.');
        setSelectedClass('');
        setStudents([]);
        setAttendance([]);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Sync failed. Please try again.');
      console.error('[Attendance] submit:', e?.response?.status, e?.response?.data);
    } finally {
      setSubmitting(false);
    }
  };

  const togglePresence = (studentId: number) => {
    setAttendance(prev => prev.map(a => a.studentId === studentId ? { ...a, present: !a.present } : a));
  };

  const presentCount = attendance.filter(a => a.present).length;
  const rate = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;

  if (loading) return (
    <View style={s.centered}><ActivityIndicator size="large" color="#10b981" /></View>
  );

  return (
    <View style={s.container}>
      {/* Header with class picker */}
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <Text style={s.topTitle}>Academic Registry</Text>
          <Text style={s.topDate}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>
        <TouchableOpacity style={s.classSelector} onPress={() => setClassPickerOpen(true)}>
          <Text style={s.classSelectorText} numberOfLines={1}>
            {selectedClass ? (classes.find(c => String(c.id) === selectedClass)?.name || 'Class') : 'Select Class'}
          </Text>
          <Text style={s.classSelectorArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      {selectedClass ? (
        <>
          {/* View toggle */}
          <View style={s.viewToggle}>
            <TouchableOpacity
              style={[s.toggleBtn, view === 'mark' && s.toggleBtnActive]}
              onPress={() => setView('mark')}
            >
              <Text style={[s.toggleBtnText, view === 'mark' && s.toggleBtnTextActive]}>
                {isEditing ? '✏ Editing Session' : '+ New Session'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, view === 'history' && s.toggleBtnDark]}
              onPress={() => { setView('history'); fetchHistory(selectedClass); }}
            >
              <Text style={[s.toggleBtnText, view === 'history' && s.toggleBtnTextActive]}>📋 History</Text>
            </TouchableOpacity>
          </View>

          {view === 'mark' ? (
            <>
              {/* Stats bar */}
              <View style={s.statsBar}>
                <View style={s.statBox}>
                  <Text style={s.statNum}>{students.length}</Text>
                  <Text style={s.statLabel}>Enrolled</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={[s.statNum, { color: '#10b981' }]}>{presentCount}</Text>
                  <Text style={s.statLabel}>Present</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={[s.statNum, { color: '#ef4444' }]}>{students.length - presentCount}</Text>
                  <Text style={s.statLabel}>Absent</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={[s.statNum, { color: '#3b82f6' }]}>{rate}%</Text>
                  <Text style={s.statLabel}>Rate</Text>
                </View>
              </View>

              {/* Student list */}
              <FlatList
                data={students}
                keyExtractor={i => String(i.id)}
                contentContainerStyle={s.studentList}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStudentsByClass(selectedClass).finally(() => setRefreshing(false)); }} />}
                ListEmptyComponent={<Text style={s.empty}>No students found for this class.</Text>}
                renderItem={({ item }) => {
                  const rec = attendance.find(a => a.studentId === item.id);
                  const isPresent = rec?.present ?? true;
                  return (
                    <View style={[s.studentRow, !isPresent && s.studentRowAbsent]}>
                      <View style={[s.studentAvatar, { backgroundColor: isPresent ? '#10b981' + '22' : '#ef4444' + '22' }]}>
                        <Text style={[s.studentAvatarText, { color: isPresent ? '#10b981' : '#ef4444' }]}>
                          {(item.name || item.username || 'S').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={s.studentInfo}>
                        <Text style={s.studentName}>{item.username || item.name || 'Unknown'}</Text>
                        <Text style={s.studentId}>#{item.userId || item.id}</Text>
                      </View>
                      <View style={s.presenceRight}>
                        <Text style={[s.presenceLabel, { color: isPresent ? '#10b981' : '#ef4444' }]}>
                          {isPresent ? 'Present' : 'Absent'}
                        </Text>
                        <Switch
                          value={isPresent}
                          onValueChange={() => togglePresence(item.id)}
                          trackColor={{ false: '#fecaca', true: '#bbf7d0' }}
                          thumbColor={isPresent ? '#10b981' : '#ef4444'}
                        />
                      </View>
                    </View>
                  );
                }}
                ListFooterComponent={
                  <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
                    {submitting
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.submitText}>{isEditing ? '💾 Update Session' : '✅ Finalize Registry'}</Text>
                    }
                  </TouchableOpacity>
                }
              />
            </>
          ) : (
            /* History view */
            <FlatList
              data={history}
              keyExtractor={i => String(i.id)}
              contentContainerStyle={s.historyList}
              ListEmptyComponent={<Text style={s.empty}>No previous sessions for this class.</Text>}
              renderItem={({ item, index }) => (
                <View style={s.historyCard}>
                  <View style={s.historyLeft}>
                    <Text style={s.historySession}>Session #{index + 1}</Text>
                    <Text style={s.historyDate}>{new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                    <Text style={s.historySub}>{item.presentCount} Present · {item.totalCount - item.presentCount} Absent</Text>
                  </View>
                  <TouchableOpacity style={s.historyEditBtn} onPress={() => handleEditSession(item)}>
                    <Text style={s.historyEditText}>Modify</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </>
      ) : (
        <View style={s.emptyState}>
          <Text style={s.emptyStateIcon}>👥</Text>
          <Text style={s.emptyStateTitle}>Select a Class</Text>
          <Text style={s.emptyStateSub}>Tap the class selector above to begin marking attendance.</Text>
        </View>
      )}

      {/* Class Picker Sheet */}
      {classPickerOpen && (
        <View style={s.pickerOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setClassPickerOpen(false)} />
          <View style={s.pickerCard}>
            <Text style={s.pickerTitle}>Select Class Session</Text>
            <ScrollView>
              {classes.map(c => (
                <TouchableOpacity key={c.id} style={[s.pickerItem, selectedClass === String(c.id) && s.pickerItemActive]} onPress={() => handleClassChange(String(c.id))}>
                  <Text style={[s.pickerItemText, selectedClass === String(c.id) && s.pickerItemTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.pickerCancel} onPress={() => setClassPickerOpen(false)}>
              <Text style={s.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { backgroundColor: '#fff', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  topBarLeft: {},
  topTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  topDate: { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 2 },
  classSelector: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 160 },
  classSelectorText: { fontSize: 13, fontWeight: '800', color: '#1e293b', flex: 1 },
  classSelectorArrow: { color: '#64748b', fontSize: 10 },
  viewToggle: { flexDirection: 'row', padding: 12, gap: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#2563eb' },
  toggleBtnDark: { backgroundColor: '#1e293b' },
  toggleBtnText: { fontWeight: '800', fontSize: 12, color: '#64748b' },
  toggleBtnTextActive: { color: '#fff' },
  statsBar: { flexDirection: 'row', backgroundColor: '#1e293b', padding: 16, gap: 0 },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#f8fafc' },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  studentList: { padding: 12, gap: 10, paddingBottom: 24 },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 12, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  studentRowAbsent: { opacity: 0.75, backgroundColor: '#fef2f2' },
  studentAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  studentAvatarText: { fontSize: 16, fontWeight: '900' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  studentId: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  presenceRight: { alignItems: 'flex-end', gap: 4 },
  presenceLabel: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  submitBtn: { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 16, alignItems: 'center', margin: 12, marginTop: 16 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  historyList: { padding: 14, gap: 12 },
  historyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  historyLeft: {},
  historySession: { fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 },
  historyDate: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginTop: 4 },
  historySub: { fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 4 },
  historyEditBtn: { backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  historyEditText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  empty: { textAlign: 'center', padding: 40, color: '#94a3b8', fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
  emptyStateIcon: { fontSize: 64 },
  emptyStateTitle: { fontSize: 22, fontWeight: '900', color: '#1e293b', textTransform: 'uppercase' },
  emptyStateSub: { fontSize: 13, fontWeight: '600', color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
  pickerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%' },
  pickerTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 16 },
  pickerItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingHorizontal: 4 },
  pickerItemActive: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12 },
  pickerItemText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  pickerItemTextActive: { color: '#2563eb', fontWeight: '800' },
  pickerCancel: { marginTop: 12, backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  pickerCancelText: { color: '#64748b', fontWeight: '800' },
});

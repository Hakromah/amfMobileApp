import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput, Alert, RefreshControl, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '@/lib/api';

interface Exam {
  id: number;
  name: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  semester?: string;
  term?: string;
  weight?: number;
  closed?: boolean;
  locked?: boolean;
  subject?: { id: number; name: string };
  classe?: { id: number; name: string };
}

const SEMESTERS = ['Fall 2025', 'Spring 2026'];
const TERMS = ['QUIZ_1', 'MIDTERM', 'FINAL'];
const TERM_LABELS: Record<string, string> = { QUIZ_1: 'Quiz 1', MIDTERM: 'Midterm', FINAL: 'Final Exam' };
const GRADE_COLORS: Record<string, string> = { QUIZ_1: '#f59e0b', MIDTERM: '#3b82f6', FINAL: '#ef4444' };

const formatTime = (t: string) => t && t.length === 5 ? `${t}:00.000` : t.length === 8 ? `${t}.000` : t;

export default function TeacherExamsScreen() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    subjectId: '', classId: '', date: '', startTime: '', endTime: '',
    semester: 'Fall 2025', term: 'MIDTERM', weight: '30',
  });

  // Picker states
  const [semesterPicker, setSemesterPicker] = useState(false);
  const [termPicker, setTermPicker] = useState(false);
  const [subjectPicker, setSubjectPicker] = useState(false);
  const [classPicker, setClassPicker] = useState(false);

  const setField = (key: keyof typeof form, val: string) => setForm(f => ({ ...f, [key]: val }));

  const loadData = async () => {
    try {
      // ✅ All correct teacher endpoints
      const [examsRes, subjectsRes, classesRes] = await Promise.all([
        api.get('/teacher/exams'),
        api.get('/teacher/subjects'),
        api.get('/teacher/classes'),
      ]);
      setExams(Array.isArray(examsRes.data) ? examsRes.data : []);
      setSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
      setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
    } catch (e: any) {
      console.error('[Exams] load:', e?.response?.status, e?.response?.data);
      Alert.alert('Error', 'Failed to load exam data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    if (!form.subjectId || !form.classId || !form.date || !form.startTime || !form.endTime) {
      Alert.alert('Validation', 'Please fill in all required fields.');
      return;
    }
    const selectedSubject = subjects.find(s => String(s.id) === form.subjectId);
    const payload = {
      name: selectedSubject?.name || 'Exam',
      date: form.date,
      startTime: formatTime(form.startTime),
      endTime: formatTime(form.endTime),
      semester: form.semester,
      term: form.term,
      weight: parseInt(form.weight) || 30,
      classe: { id: parseInt(form.classId) },
      subject: { id: parseInt(form.subjectId) },
    };
    setSaving(true);
    try {
      if (editing) {
        // ✅ PUT /teacher/exams/:id
        await api.put(`/teacher/exams/${editing.id}`, payload);
        Alert.alert('Success', 'Exam updated.');
      } else {
        // ✅ POST /teacher/exams
        await api.post('/teacher/exams', payload);
        Alert.alert('Success', 'Exam created.');
      }
      setIsFormOpen(false);
      setEditing(null);
      setForm({ subjectId: '', classId: '', date: '', startTime: '', endTime: '', semester: 'Fall 2025', term: 'MIDTERM', weight: '30' });
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save exam.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = (exam: Exam) => {
    Alert.alert(
      exam.closed ? 'Re-open Exam' : 'Close Exam',
      `${exam.closed ? 'Re-open' : 'Close'} "${exam.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            try {
              // ✅ PATCH /teacher/exams/:id/toggle-status
              await api.patch(`/teacher/exams/${exam.id}/toggle-status`, { closed: !exam.closed });
              loadData();
            } catch (e) { Alert.alert('Error', 'Status update failed.'); }
          }
        }
      ]
    );
  };

  const handleDelete = (exam: Exam) => {
    if (exam.locked) { Alert.alert('Locked', 'Locked exams cannot be deleted.'); return; }
    Alert.alert('Delete Exam', `Delete "${exam.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/teacher/exams/${exam.id}`);
            loadData();
          } catch { Alert.alert('Error', 'Deletion failed.'); }
        }
      }
    ]);
  };

  const openEdit = (exam: Exam) => {
    setEditing(exam);
    setForm({
      subjectId: String(exam.subject?.id || ''),
      classId: String(exam.classe?.id || ''),
      date: exam.date || '',
      startTime: (exam.startTime || '').substring(0, 5),
      endTime: (exam.endTime || '').substring(0, 5),
      semester: exam.semester || 'Fall 2025',
      term: exam.term || 'MIDTERM',
      weight: String(exam.weight || 30),
    });
    setIsFormOpen(true);
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  const selectedSubjectName = subjects.find(sub => String(sub.id) === form.subjectId)?.name;
  const selectedClassName = classes.find(c => String(c.id) === form.classId)?.name;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Exam Center.</Text>
          <Text style={s.headerSub}>Registry & Assessments • 2026</Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => { setEditing(null); setForm({ subjectId: '', classId: '', date: '', startTime: '', endTime: '', semester: 'Fall 2025', term: 'MIDTERM', weight: '30' }); setIsFormOpen(true); }}>
          <Text style={s.newBtnText}>+ NEW ASSESSMENT</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={exams}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        ListEmptyComponent={<Text style={s.empty}>No exams found. Create your first assessment.</Text>}
        renderItem={({ item }) => {
          const termColor = GRADE_COLORS[item.term || ''] || '#64748b';
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={s.cardLeft}>
                  <Text style={s.examName}>{item.name}</Text>
                  <Text style={s.examClass}>{item.classe?.name || 'Unknown Class'}</Text>
                  <View style={s.examTags}>
                    <View style={[s.termBadge, { backgroundColor: termColor + '22' }]}>
                      <Text style={[s.termText, { color: termColor }]}>{TERM_LABELS[item.term || ''] || item.term}</Text>
                    </View>
                    <Text style={s.examSemester}>{item.semester}</Text>
                  </View>
                </View>
                <View style={[s.weightBadge, { backgroundColor: '#1e293b' }]}>
                  <Text style={s.weightText}>{item.weight}%</Text>
                </View>
              </View>
              <View style={s.cardMeta}>
                <Text style={s.metaText}>📅 {item.date} &nbsp; 🕐 {(item.startTime || '').substring(0, 5)}-{(item.endTime || '').substring(0, 5)}</Text>
                <View style={[s.statusBadge, { backgroundColor: item.closed ? '#f1f5f9' : '#f0fdf4' }]}>
                  <Text style={[s.statusText, { color: item.closed ? '#94a3b8' : '#10b981' }]}>
                    {item.closed ? 'CLOSED' : 'ACTIVE'}
                  </Text>
                </View>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => handleToggleStatus(item)}>
                  <Text style={s.actionText}>⚡ {item.closed ? 'Re-open' : 'Close'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, item.locked && s.actionBtnDisabled]} onPress={() => !item.locked && openEdit(item)} disabled={!!item.locked}>
                  <Text style={s.actionText}>✏ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger, item.locked && s.actionBtnDisabled]} onPress={() => handleDelete(item)} disabled={!!item.locked}>
                  <Text style={[s.actionText, { color: '#ef4444' }]}>🗑 Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Create/Edit Modal */}
      <Modal visible={isFormOpen} animationType="slide" transparent onRequestClose={() => { setIsFormOpen(false); setEditing(null); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{editing ? 'Edit' : 'Create'} Assessment.</Text>
                <TouchableOpacity onPress={() => { setIsFormOpen(false); setEditing(null); }} style={s.modalClose}>
                  <Text style={s.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                {/* Semester + Term */}
                <View style={s.row}>
                  <View style={s.half}>
                    <Text style={s.label}>SEMESTER *</Text>
                    <TouchableOpacity style={s.pickerTrigger} onPress={() => setSemesterPicker(true)}>
                      <Text style={s.pickerTriggerText}>{form.semester}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.half}>
                    <Text style={s.label}>TERM *</Text>
                    <TouchableOpacity style={s.pickerTrigger} onPress={() => setTermPicker(true)}>
                      <Text style={s.pickerTriggerText}>{TERM_LABELS[form.term] || form.term}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Subject + Weight */}
                <View style={s.row}>
                  <View style={s.half}>
                    <Text style={s.label}>SUBJECT *</Text>
                    <TouchableOpacity style={s.pickerTrigger} onPress={() => setSubjectPicker(true)}>
                      <Text style={selectedSubjectName ? s.pickerTriggerText : s.pickerPlaceholder}>
                        {selectedSubjectName || 'Select...'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.half}>
                    <Text style={s.label}>WEIGHT (%)</Text>
                    <TextInput style={s.input} value={form.weight} onChangeText={v => setField('weight', v)} keyboardType="numeric" placeholderTextColor="#94a3b8" />
                  </View>
                </View>

                {/* Class */}
                <Text style={s.label}>CLASSROOM *</Text>
                <TouchableOpacity style={s.pickerTrigger} onPress={() => setClassPicker(true)}>
                  <Text style={selectedClassName ? s.pickerTriggerText : s.pickerPlaceholder}>
                    {selectedClassName || 'Select class...'}
                  </Text>
                </TouchableOpacity>

                {/* Date + Start + End */}
                <Text style={s.label}>DATE (YYYY-MM-DD) *</Text>
                <TextInput style={s.input} value={form.date} onChangeText={v => setField('date', v)} placeholder="2026-01-15" placeholderTextColor="#94a3b8" />

                <View style={s.row}>
                  <View style={s.half}>
                    <Text style={s.label}>START TIME *</Text>
                    <TextInput style={s.input} value={form.startTime} onChangeText={v => setField('startTime', v)} placeholder="08:00" placeholderTextColor="#94a3b8" />
                  </View>
                  <View style={s.half}>
                    <Text style={s.label}>END TIME *</Text>
                    <TextInput style={s.input} value={form.endTime} onChangeText={v => setField('endTime', v)} placeholder="10:00" placeholderTextColor="#94a3b8" />
                  </View>
                </View>

                <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>CONFIRM ACADEMIC RECORD</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Picker Sheets */}
      {[
        { open: semesterPicker, setOpen: setSemesterPicker, items: SEMESTERS.map(s => ({ id: s, name: s })), key: 'semester', title: 'Select Semester' },
        { open: termPicker, setOpen: setTermPicker, items: TERMS.map(t => ({ id: t, name: TERM_LABELS[t] })), key: 'term', title: 'Select Term' },
        { open: subjectPicker, setOpen: setSubjectPicker, items: subjects, key: 'subjectId', title: 'Select Subject' },
        { open: classPicker, setOpen: setClassPicker, items: classes, key: 'classId', title: 'Select Class' },
      ].map(({ open, setOpen, items, key, title }) => (
        <Modal key={key} visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
          <View style={s.sheetOverlay}>
            <View style={s.sheetCard}>
              <Text style={s.sheetTitle}>{title}</Text>
              <ScrollView>
                {items.map((item: any) => (
                  <TouchableOpacity key={item.id} style={s.sheetItem} onPress={() => { setField(key as keyof typeof form, String(item.id)); setOpen(false); }}>
                    <Text style={[s.sheetItemText, form[key as keyof typeof form] === String(item.id) && s.sheetItemActive]}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={s.sheetCancel} onPress={() => setOpen(false)}>
                <Text style={s.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexWrap: 'wrap', gap: 12 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#1e293b', fontStyle: 'italic' },
  headerSub: { fontSize: 10, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  newBtn: { backgroundColor: '#1e293b', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  newBtnText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  list: { padding: 14, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardLeft: { flex: 1 },
  examName: { fontSize: 16, fontWeight: '900', color: '#1e293b', textTransform: 'uppercase', fontStyle: 'italic' },
  examClass: { fontSize: 11, fontWeight: '700', color: '#3b82f6', marginTop: 3, textTransform: 'uppercase', letterSpacing: 1 },
  examTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  termBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  termText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  examSemester: { fontSize: 9, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  weightBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  weightText: { color: '#fff', fontWeight: '900', fontSize: 13, fontStyle: 'italic' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 4 },
  metaText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center' },
  actionBtnDanger: { backgroundColor: '#fef2f2' },
  actionBtnDisabled: { opacity: 0.4 },
  actionText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  empty: { textAlign: 'center', padding: 40, color: '#94a3b8', fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 12 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, maxHeight: '95%', overflow: 'hidden' },
  modalHeader: { backgroundColor: '#1e293b', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  modalClose: { backgroundColor: '#ffffff22', borderRadius: 10, padding: 6 },
  modalCloseText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalScroll: { padding: 20 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  label: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, fontWeight: '600', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  pickerTrigger: { backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', minHeight: 44 },
  pickerTriggerText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  pickerPlaceholder: { fontSize: 13, color: '#94a3b8' },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 2 },
  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 16 },
  sheetItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sheetItemText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  sheetItemActive: { color: '#2563eb', fontWeight: '800' },
  sheetCancel: { marginTop: 12, backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  sheetCancelText: { color: '#64748b', fontWeight: '800' },
});

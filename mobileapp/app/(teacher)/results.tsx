import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput, Alert, RefreshControl, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '@/hooks/lib/api';

interface ResultItem {
  id: number;
  marks: number;
  grade?: string;
  status?: string;
  student?: { id: number; name?: string; username?: string; userId?: string };
  exam?: { id: number; name?: string; term?: string; weight?: number; locked?: boolean; classe?: { id: number; name: string } };
}

const calcGrade = (marks: number): string => {
  if (marks >= 90) return 'AA'; if (marks >= 85) return 'BA';
  if (marks >= 80) return 'BB'; if (marks >= 75) return 'CB';
  if (marks >= 70) return 'CC'; if (marks >= 60) return 'DC';
  if (marks >= 50) return 'DD'; return 'FF';
};

export default function TeacherResultsScreen() {
  const [classes, setClasses] = useState<any[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [filterStudentId, setFilterStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<ResultItem | null>(null);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Result form state (mirrors ResultForm.tsx)
  const [formClassId, setFormClassId] = useState('');
  const [formExamId, setFormExamId] = useState('');
  const [formStudentId, setFormStudentId] = useState('');
  const [formMarks, setFormMarks] = useState('');
  const [formGrade, setFormGrade] = useState('');
  const [formExams, setFormExams] = useState<any[]>([]);
  const [formStudents, setFormStudents] = useState<any[]>([]);
  const [formClasses, setFormClasses] = useState<any[]>([]);
  const [formExamPicker, setFormExamPicker] = useState(false);
  const [formStudentPicker, setFormStudentPicker] = useState(false);
  const [formClassPicker, setFormClassPicker] = useState(false);
  const [formGradePicker, setFormGradePicker] = useState(false);

  // Fetch classes
  const fetchClasses = async () => {
    try {
      const res = await api.get('/teacher/classes');
      setClasses(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error('[Results] classes', e); }
  };

  // ✅ Correct endpoint: /teacher/results/filter with optional params
  const fetchResults = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedClassId !== 'all') params.append('classId', selectedClassId);
      if (filterStudentId.trim()) params.append('studentId', filterStudentId.trim());
      const res = await api.get(`/teacher/results/filter?${params.toString()}`);
      setResults(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setResults([]);
      console.error('[Results] fetch', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClassId, filterStudentId]);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchResults(), 300);
    return () => clearTimeout(timer);
  }, [fetchResults]);

  // Open form for create or edit
  const openForm = async (result: ResultItem | null) => {
    setEditingResult(result);
    setFormMarks(result ? String(result.marks) : '');
    setFormGrade(result?.grade || '');
    setFormClassId(result?.exam?.classe?.id ? String(result.exam.classe.id) : '');
    setFormExamId(result?.exam?.id ? String(result.exam.id) : '');
    setFormStudentId(result?.student?.id ? String(result.student.id) : '');
    try {
      const [classRes, examRes] = await Promise.all([
        api.get('/teacher/classes'),
        api.get('/teacher/exams'),
      ]);
      setFormClasses(Array.isArray(classRes.data) ? classRes.data : []);
      setFormExams(Array.isArray(examRes.data) ? examRes.data : []);
      if (result?.exam?.classe?.id) {
        const studentRes = await api.get(`/teacher/classes/${result.exam.classe.id}/students`);
        setFormStudents(Array.isArray(studentRes.data) ? studentRes.data : []);
      }
    } catch (e) { console.error('[ResultForm] load', e); }
    setIsFormOpen(true);
  };

  const handleFormClassChange = async (classId: string) => {
    setFormClassId(classId);
    setFormStudentId('');
    try {
      const res = await api.get(`/teacher/classes/${classId}/students`);
      setFormStudents(Array.isArray(res.data) ? res.data : []);
    } catch { setFormStudents([]); }
  };

  const handleSubmitResult = async () => {
    if (!formExamId || !formStudentId || !formMarks) {
      Alert.alert('Validation', 'Exam, student, and marks are required.');
      return;
    }
    setSubmitting(true);
    const payload = {
      exam: { id: parseInt(formExamId) },
      student: { id: parseInt(formStudentId) },
      marks: parseFloat(formMarks),
      grade: formGrade || null,
    };
    try {
      if (editingResult) {
        // ✅ PUT /teacher/results/:id
        await api.put(`/teacher/results/${editingResult.id}`, payload);
        Alert.alert('Success', 'Record updated.');
      } else {
        // ✅ POST /teacher/results
        await api.post('/teacher/results', payload);
        Alert.alert('Success', 'Draft saved.');
      }
      setIsFormOpen(false);
      fetchResults();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishDrafts = async () => {
    const draftIds = results.filter(r => r.status === 'DRAFT' && !r.exam?.locked).map(r => r.id);
    if (!draftIds.length) { Alert.alert('No Drafts', 'No publishable drafts found.'); return; }
    try {
      // ✅ POST /teacher/results/submit
      await api.post('/teacher/results/submit', draftIds);
      Alert.alert('Success', 'Results published!');
      fetchResults();
    } catch { Alert.alert('Error', 'Submission failed.'); }
  };

  const hasDrafts = results.some(r => r.status === 'DRAFT' && !r.exam?.locked);
  const selectedClassName = classes.find(c => String(c.id) === selectedClassId)?.name;
  const formExamsFiltered = formExams.filter(e => !formClassId || String(e.classe?.id) === formClassId);
  const formStudentsFiltered = formStudents.filter(s => {
    if (editingResult) return true;
    if (!formExamId) return true;
    const graded = results.filter(r => String(r.exam?.id) === formExamId).map(r => String(r.student?.id));
    return !graded.includes(String(s.id));
  });

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <View style={s.container}>
      {/* Controls */}
      <View style={s.controls}>
        <View style={s.controlsRow}>
          <TouchableOpacity style={s.classFilter} onPress={() => setClassPickerOpen(true)}>
            <Text style={s.classFilterText} numberOfLines={1}>
              🏫 {selectedClassId === 'all' ? 'All Classes' : (selectedClassName || selectedClassId)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={() => openForm(null)}>
            <Text style={s.addBtnText}>+ Add Record</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={s.searchInput}
          placeholder="Search by Student ID..."
          placeholderTextColor="#94a3b8"
          value={filterStudentId}
          onChangeText={setFilterStudentId}
          returnKeyType="search"
        />
        {hasDrafts && (
          <TouchableOpacity style={s.publishBtn} onPress={handlePublishDrafts}>
            <Text style={s.publishBtnText}>📤 Publish Drafts to Students</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchResults(); }} tintColor="#3b82f6" />}
        ListEmptyComponent={<Text style={s.empty}>No results found. Use filters or add a record.</Text>}
        renderItem={({ item }) => {
          const grade = item.grade || calcGrade(item.marks);
          const passing = item.marks >= 50;
          return (
            <View style={s.resultCard}>
              <View style={s.resultLeft}>
                <Text style={s.resultStudent}>{item.student?.name || item.student?.username || 'Unknown'}</Text>
                <Text style={s.resultStudentId}>{item.student?.userId || '—'}</Text>
                <Text style={s.resultExam}>{item.exam?.name || 'Unknown Assessment'}</Text>
                <View style={s.resultTags}>
                  {item.exam?.term && <View style={s.termTag}><Text style={s.termTagText}>{item.exam.term}</Text></View>}
                  <Text style={[s.statusTag, { color: item.status === 'DRAFT' ? '#f97316' : '#10b981' }]}>{item.status}</Text>
                </View>
              </View>
              <View style={s.resultRight}>
                <Text style={[s.marks, !passing && { color: '#ef4444' }]}>{item.marks}%</Text>
                <View style={[s.gradeBadge, { backgroundColor: passing ? '#f0fdf4' : '#fef2f2' }]}>
                  <Text style={[s.gradeText, { color: passing ? '#10b981' : '#ef4444' }]}>{grade}</Text>
                </View>
                {!item.exam?.locked ? (
                  <TouchableOpacity style={s.editBtn} onPress={() => openForm(item)}>
                    <Text style={s.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={s.lockedText}>🔒 Locked</Text>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Result Form Modal */}
      <Modal visible={isFormOpen} animationType="slide" transparent onRequestClose={() => setIsFormOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{editingResult ? 'Update Assessment' : 'New Mark Entry'}</Text>
                <TouchableOpacity onPress={() => setIsFormOpen(false)} style={s.modalCloseBtn}>
                  <Text style={s.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                {/* Class (only for new records) */}
                {!editingResult && (
                  <>
                    <Text style={s.formLabel}>CLASS</Text>
                    <TouchableOpacity style={s.pickerTrigger} onPress={() => setFormClassPicker(true)}>
                      <Text style={formClassId ? s.pickerVal : s.pickerPlaceholder}>
                        {formClasses.find(c => String(c.id) === formClassId)?.name || 'Select class...'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Exam (filtered by class) */}
                <Text style={s.formLabel}>ASSESSMENT PERIOD *</Text>
                <TouchableOpacity style={s.pickerTrigger} onPress={() => setFormExamPicker(true)} disabled={!!editingResult}>
                  <Text style={formExamId ? s.pickerVal : s.pickerPlaceholder}>
                    {formExams.find(e => String(e.id) === formExamId)?.name || 'Select exam...'}
                  </Text>
                </TouchableOpacity>

                {/* Student (filtered to show only ungraded) */}
                <Text style={s.formLabel}>STUDENT NAME *</Text>
                <TouchableOpacity style={s.pickerTrigger} onPress={() => setFormStudentPicker(true)} disabled={!!editingResult || !formExamId}>
                  <Text style={formStudentId ? s.pickerVal : s.pickerPlaceholder}>
                    {formStudents.find(s => String(s.id) === formStudentId)?.name || formStudents.find(s => String(s.id) === formStudentId)?.username || (formExamId ? 'Select student...' : 'Select exam first')}
                  </Text>
                </TouchableOpacity>

                {/* Marks + Grade */}
                <View style={s.row}>
                  <View style={s.half}>
                    <Text style={s.formLabel}>MARKS (%) *</Text>
                    <TextInput style={s.input} value={formMarks} onChangeText={setFormMarks} keyboardType="numeric" placeholder="0-100" placeholderTextColor="#94a3b8" />
                  </View>
                  <View style={s.half}>
                    <Text style={s.formLabel}>GRADE (OPTIONAL)</Text>
                    <TouchableOpacity style={s.pickerTrigger} onPress={() => setFormGradePicker(true)}>
                      <Text style={formGrade ? s.pickerVal : s.pickerPlaceholder}>{formGrade || 'Auto'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={[s.saveBtn, submitting && s.saveBtnDisabled]} onPress={handleSubmitResult} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editingResult ? 'Update Record' : 'Save as Draft'}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Picker Sheets */}
      {/* Class picker for list filter */}
      <Modal visible={classPickerOpen} animationType="slide" transparent onRequestClose={() => setClassPickerOpen(false)}>
        <View style={s.sheetOverlay}>
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle}>Select Class</Text>
            <ScrollView>
              {[{ id: 'all', name: 'All Classes' }, ...classes].map(c => (
                <TouchableOpacity key={c.id} style={s.sheetItem} onPress={() => { setSelectedClassId(String(c.id)); setClassPickerOpen(false); }}>
                  <Text style={[s.sheetItemText, selectedClassId === String(c.id) && s.sheetItemActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.sheetCancel} onPress={() => setClassPickerOpen(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Form class picker */}
      <Modal visible={formClassPicker} animationType="slide" transparent onRequestClose={() => setFormClassPicker(false)}>
        <View style={s.sheetOverlay}>
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle}>Select Class</Text>
            <ScrollView>
              {formClasses.map(c => (
                <TouchableOpacity key={c.id} style={s.sheetItem} onPress={() => { handleFormClassChange(String(c.id)); setFormClassPicker(false); }}>
                  <Text style={[s.sheetItemText, formClassId === String(c.id) && s.sheetItemActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.sheetCancel} onPress={() => setFormClassPicker(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Exam picker */}
      <Modal visible={formExamPicker} animationType="slide" transparent onRequestClose={() => setFormExamPicker(false)}>
        <View style={s.sheetOverlay}>
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle}>Select Exam</Text>
            <ScrollView>
              {formExamsFiltered.map(e => (
                <TouchableOpacity key={e.id} style={s.sheetItem} onPress={() => { setFormExamId(String(e.id)); setFormExamPicker(false); }}>
                  <Text style={[s.sheetItemText, formExamId === String(e.id) && s.sheetItemActive]}>
                    {e.name} — {e.term} ({e.weight}%)
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.sheetCancel} onPress={() => setFormExamPicker(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Student picker */}
      <Modal visible={formStudentPicker} animationType="slide" transparent onRequestClose={() => setFormStudentPicker(false)}>
        <View style={s.sheetOverlay}>
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle}>Select Student</Text>
            <ScrollView>
              {formStudentsFiltered.length > 0 ? formStudentsFiltered.map(st => (
                <TouchableOpacity key={st.id} style={s.sheetItem} onPress={() => { setFormStudentId(String(st.id)); setFormStudentPicker(false); }}>
                  <Text style={[s.sheetItemText, formStudentId === String(st.id) && s.sheetItemActive]}>
                    {st.username || st.name}
                  </Text>
                </TouchableOpacity>
              )) : (
                <Text style={s.empty}>All students already graded for this exam.</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={s.sheetCancel} onPress={() => setFormStudentPicker(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Grade picker */}
      <Modal visible={formGradePicker} animationType="slide" transparent onRequestClose={() => setFormGradePicker(false)}>
        <View style={s.sheetOverlay}>
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle}>Select Grade</Text>
            <ScrollView>
              {['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'FF'].map(g => (
                <TouchableOpacity key={g} style={s.sheetItem} onPress={() => { setFormGrade(g); setFormGradePicker(false); }}>
                  <Text style={[s.sheetItemText, formGrade === g && s.sheetItemActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.sheetCancel} onPress={() => setFormGradePicker(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: { backgroundColor: '#fff', padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  controlsRow: { flexDirection: 'row', gap: 10 },
  classFilter: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#dbeafe' },
  classFilterText: { fontSize: 12, fontWeight: '800', color: '#2563eb' },
  addBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  searchInput: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontWeight: '600', color: '#1e293b' },
  publishBtn: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  publishBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  list: { padding: 14, gap: 10 },
  resultCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  resultLeft: { flex: 1 },
  resultStudent: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  resultStudentId: { fontSize: 10, color: '#94a3b8', fontWeight: '700', marginTop: 2 },
  resultExam: { fontSize: 12, color: '#475569', fontWeight: '600', marginTop: 6 },
  resultTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  termTag: { backgroundColor: '#dbeafe', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  termTagText: { fontSize: 9, fontWeight: '900', color: '#2563eb', textTransform: 'uppercase' },
  statusTag: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  resultRight: { alignItems: 'flex-end', gap: 6, justifyContent: 'center' },
  marks: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  gradeText: { fontSize: 11, fontWeight: '900' },
  editBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  editBtnText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  lockedText: { fontSize: 10, color: '#94a3b8', fontWeight: '700' },
  empty: { textAlign: 'center', padding: 40, color: '#94a3b8', fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 12 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, maxHeight: '90%', overflow: 'hidden' },
  modalHeader: { backgroundColor: '#1e293b', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  modalCloseBtn: { backgroundColor: '#ffffff22', borderRadius: 10, padding: 6 },
  modalCloseBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalScroll: { padding: 20 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  formLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  pickerTrigger: { backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', minHeight: 44 },
  pickerVal: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  pickerPlaceholder: { fontSize: 13, color: '#94a3b8' },
  input: { backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13, fontWeight: '600', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 16 },
  sheetItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sheetItemText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  sheetItemActive: { color: '#2563eb', fontWeight: '800' },
  sheetCancel: { marginTop: 12, backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  sheetCancelText: { color: '#64748b', fontWeight: '800' },
});

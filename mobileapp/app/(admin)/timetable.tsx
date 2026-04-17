import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '@/lib/api';

interface TimetableEntry {
  id: number;
  dayOfWeek?: string;   // ✅ correct field name (not 'day')
  startTime?: string;
  endTime?: string;
  subject?: { id?: number; name?: string };
  classe?: { id?: number; name?: string };
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const DAY_COLORS: Record<string, string> = {
  MONDAY: '#3b82f6', TUESDAY: '#10b981', WEDNESDAY: '#f59e0b',
  THURSDAY: '#8b5cf6', FRIDAY: '#ef4444', SATURDAY: '#ec4899',
};

export default function AdminTimetableScreen() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDay, setActiveDay] = useState('MONDAY');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    classId: '', subjectId: '', dayOfWeek: 'MONDAY',
    startTime: '', endTime: '',
  });

  // Class/Subject picker state
  const [classPicker, setClassPicker] = useState(false);
  const [subjectPicker, setSubjectPicker] = useState(false);
  const [dayPicker, setDayPicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // ✅ Correct endpoint: /admin/timetables (plural)
      const [tRes, cRes, sRes] = await Promise.all([
        api.get('/admin/timetables'),
        api.get('/admin/classes'),
        api.get('/admin/subjects'),
      ]);
      setEntries(Array.isArray(tRes.data) ? tRes.data : []);
      setClasses(Array.isArray(cRes.data) ? cRes.data : []);
      setSubjects(Array.isArray(sRes.data) ? sRes.data : []);
    } catch (e: any) {
      console.error('[Timetable]', e?.response?.status, e?.response?.data);
      Alert.alert('Error', 'Failed to load timetable. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const toStrapiTime = (t: string) => (t && t.length === 5 ? `${t}:00` : t);

  const handleSave = async () => {
    if (!form.classId || !form.subjectId || !form.startTime || !form.endTime) {
      Alert.alert('Validation', 'Please fill in all required fields.');
      return;
    }
    setSaving(true);
    const payload = {
      classe: { id: parseInt(form.classId) },
      subject: { id: parseInt(form.subjectId) },
      dayOfWeek: form.dayOfWeek,
      startTime: toStrapiTime(form.startTime),
      endTime: toStrapiTime(form.endTime),
    };
    try {
      if (editing) {
        await api.put(`/admin/timetables/${editing.id}`, payload);
        Alert.alert('Success', 'Entry updated.');
      } else {
        await api.post('/admin/timetables', payload);
        Alert.alert('Success', 'Entry added to schedule.');
      }
      setIsFormOpen(false);
      setEditing(null);
      setForm({ classId: '', subjectId: '', dayOfWeek: 'MONDAY', startTime: '', endTime: '' });
      fetchData();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Server error';
      Alert.alert('Error', `Failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Entry', 'Remove this timetable slot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/admin/timetables/${id}`);
            fetchData();
          } catch { Alert.alert('Error', 'Failed to delete.'); }
        }
      }
    ]);
  };

  const openEdit = (entry: TimetableEntry) => {
    setEditing(entry);
    setForm({
      classId: String(entry.classe?.id || ''),
      subjectId: String(entry.subject?.id || ''),
      dayOfWeek: entry.dayOfWeek || 'MONDAY',
      startTime: (entry.startTime || '').substring(0, 5),
      endTime: (entry.endTime || '').substring(0, 5),
    });
    setIsFormOpen(true);
  };

  const dayEntries = entries
    .filter(e => e.dayOfWeek === activeDay)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color="#8b5cf6" /></View>;

  const selectedClass = classes.find(c => String(c.id) === form.classId);
  const selectedSubject = subjects.find(sub => String(sub.id) === form.subjectId);

  return (
    <View style={s.container}>
      {/* Day Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayTabsContainer} contentContainerStyle={s.dayTabs}>
        {DAYS.map(day => (
          <TouchableOpacity
            key={day}
            style={[s.dayTab, activeDay === day && { backgroundColor: DAY_COLORS[day] }]}
            onPress={() => setActiveDay(day)}
          >
            <Text style={[s.dayTabText, activeDay === day && s.dayTabTextActive]}>
              {day.substring(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Add New Button */}
      <View style={s.addRow}>
        <Text style={s.dayLabel}>
          <Text style={{ color: DAY_COLORS[activeDay] }}>●</Text> {activeDay}
          <Text style={s.countLabel}> ({dayEntries.length} classes)</Text>
        </Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => { setEditing(null); setForm({ classId: '', subjectId: '', dayOfWeek: activeDay, startTime: '', endTime: '' }); setIsFormOpen(true); }}
        >
          <Text style={s.addBtnText}>+ Add Slot</Text>
        </TouchableOpacity>
      </View>

      {/* Entries List */}
      <FlatList
        data={dayEntries}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.empty}>No classes scheduled for {activeDay}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const color = DAY_COLORS[item.dayOfWeek || ''] || '#64748b';
          return (
            <View style={s.card}>
              <View style={[s.dayTag, { backgroundColor: color }]}>
                <Text style={s.dayTagText}>{(item.dayOfWeek || '?').substring(0, 3)}</Text>
              </View>
              <View style={s.info}>
                <Text style={s.subject}>{item.subject?.name || 'Unknown Subject'}</Text>
                <Text style={s.meta}>{item.classe?.name || 'Unknown Class'}</Text>
                <Text style={s.time}>{(item.startTime || '').substring(0, 5)} – {(item.endTime || '').substring(0, 5)}</Text>
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={s.editBtn} onPress={() => openEdit(item)}>
                  <Text style={s.editBtnText}>✏</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item.id)}>
                  <Text style={s.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Create/Edit Modal */}
      <Modal visible={isFormOpen} animationType="slide" transparent onRequestClose={() => setIsFormOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>{editing ? 'Edit Timetable Slot' : 'New Timetable Slot'}</Text>

              {/* Class picker */}
              <Text style={s.formLabel}>CLASS *</Text>
              <TouchableOpacity style={s.pickerTrigger} onPress={() => setClassPicker(true)}>
                <Text style={selectedClass ? s.pickerTriggerText : s.pickerTriggerPlaceholder}>
                  {selectedClass?.name || 'Select a class...'}
                </Text>
              </TouchableOpacity>

              {/* Subject picker */}
              <Text style={s.formLabel}>SUBJECT *</Text>
              <TouchableOpacity style={s.pickerTrigger} onPress={() => setSubjectPicker(true)}>
                <Text style={selectedSubject ? s.pickerTriggerText : s.pickerTriggerPlaceholder}>
                  {selectedSubject?.name || 'Select a subject...'}
                </Text>
              </TouchableOpacity>

              {/* Day picker */}
              <Text style={s.formLabel}>DAY *</Text>
              <TouchableOpacity style={s.pickerTrigger} onPress={() => setDayPicker(true)}>
                <Text style={s.pickerTriggerText}>{form.dayOfWeek}</Text>
              </TouchableOpacity>

              <View style={s.timeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>START TIME *</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="e.g. 08:00"
                    placeholderTextColor="#94a3b8"
                    value={form.startTime}
                    onChangeText={v => setForm(f => ({ ...f, startTime: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>END TIME *</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="e.g. 09:30"
                    placeholderTextColor="#94a3b8"
                    value={form.endTime}
                    onChangeText={v => setForm(f => ({ ...f, endTime: v }))}
                  />
                </View>
              </View>

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setIsFormOpen(false); setEditing(null); }}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.confirmBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmText}>{editing ? 'Update' : 'Create'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Class Picker Sheet */}
      {[
        { open: classPicker, setOpen: setClassPicker, items: classes, title: 'Select Class', key: 'classId' },
        { open: subjectPicker, setOpen: setSubjectPicker, items: subjects, title: 'Select Subject', key: 'subjectId' },
        { open: dayPicker, setOpen: setDayPicker, items: DAYS.map(d => ({ id: d, name: d })), title: 'Select Day', key: 'dayOfWeek' },
      ].map(({ open, setOpen, items, title, key }) => (
        <Modal key={key} visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
          <View style={s.sheetOverlay}>
            <View style={s.sheetCard}>
              <Text style={s.sheetTitle}>{title}</Text>
              <ScrollView>
                {items.map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={s.sheetItem}
                    onPress={() => { setForm(f => ({ ...f, [key]: String(item.id) })); setOpen(false); }}
                  >
                    <Text style={[s.sheetItemText, form[key as keyof typeof form] === String(item.id) && s.sheetItemActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setOpen(false)}>
                <Text style={s.cancelText}>Cancel</Text>
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
  dayTabsContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexGrow: 0 },
  dayTabs: { flexDirection: 'row', padding: 10, gap: 8 },
  dayTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  dayTabText: { fontSize: 11, fontWeight: '900', color: '#64748b', letterSpacing: 1 },
  dayTabTextActive: { color: '#fff' },
  addRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  dayLabel: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  countLabel: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },
  addBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  dayTag: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  dayTagText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  info: { flex: 1 },
  subject: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  meta: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 3 },
  time: { fontSize: 12, color: '#3b82f6', fontWeight: '700', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  editBtnText: { fontSize: 16 },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { fontSize: 16 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  empty: { color: '#94a3b8', fontWeight: '600', fontSize: 14, textAlign: 'center' },
  // Form Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 20 },
  formLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  pickerTrigger: { backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#e2e8f0' },
  pickerTriggerText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  pickerTriggerPlaceholder: { fontSize: 14, color: '#94a3b8' },
  timeRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  formInput: { backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '600', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: '800', fontSize: 14 },
  confirmBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  // Sheet Pickers
  sheetOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 16 },
  sheetItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sheetItemText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  sheetItemActive: { color: '#2563eb', fontWeight: '800' },
});

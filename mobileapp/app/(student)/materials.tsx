import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, Linking, Modal, ScrollView
} from 'react-native';
import api from '@/hooks/lib/api';
import { getStrapiMediaUrl } from '@/hooks/lib/config';

interface Material {
  id: number;
  title?: string;
  name?: string;
  description?: string;
  fileUrl?: string;
  fileSize?: number;
  createdAt: string;
  uploadedBy?: { name?: string };
}

interface ClassModel {
  id: number;
  name: string;
}

export default function StudentMaterialsScreen() {
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [fetchingMats, setFetchingMats] = useState(false);

  // 1. Initial Load: Fetch list of classes
  const fetchClasses = async () => {
    try {
      const res = await api.get('/student/classes');
      setClasses(res.data || []);
    } catch {
      Alert.alert('Error', 'Could not sync classroom registry');
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => { fetchClasses(); }, []);

  // 2. Fetch specific materials
  const fetchMaterials = async (id: string) => {
    if (!id) return;
    setFetchingMats(true);
    setSelectedClassId(id);
    try {
      const res = await api.get(`/student/materials/${id}`);
      setMaterials(res.data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to retrieve materials');
      setMaterials([]);
    } finally {
      setFetchingMats(false);
    }
  };

  const handleClassSelect = (id: string) => {
    setPickerOpen(false);
    fetchMaterials(id);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const openFile = (url?: string) => {
    if (!url) return;
    const full = getStrapiMediaUrl(url);
    Linking.openURL(full).catch(() => Alert.alert('Error', 'Cannot open file'));
  };

  if (loadingConfig) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color="#4f46e5" />
    </View>
  );

  const selectedClass = classes.find(c => String(c.id) === selectedClassId);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.kicker}>📂 KNOWLEDGE REPOSITORY</Text>
        <Text style={s.title}>Study <Text style={{ color: '#4f46e5' }}>Assets.</Text></Text>

        <TouchableOpacity style={s.selectBtn} onPress={() => setPickerOpen(true)}>
          <Text style={s.selectBtnText}>{selectedClass ? selectedClass.name : 'SELECT SUBJECT GROUP'}</Text>
          <Text style={s.selectBtnIcon}>▼</Text>
        </TouchableOpacity>
      </View>

      {fetchingMats ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={s.loadingText}>Accessing Archives...</Text>
        </View>
      ) : (
        <FlatList
          data={materials}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={fetchingMats} onRefresh={() => selectedClassId && fetchMaterials(selectedClassId)} tintColor="#4f46e5" />}
          ListEmptyComponent={
            selectedClassId ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>📪</Text>
                <Text style={s.emptyTitle}>EMPTY UNIT ARCHIVES</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={s.iconBox}><Text style={s.iconText}>📄</Text></View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.previewBtn} onPress={() => openFile(item.fileUrl)}>
                    <Text style={s.previewText}>👁️ PREVIEW</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.dlBtn} onPress={() => openFile(item.fileUrl)}>
                    <Text style={s.dlText}>⬇️ GET</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={s.cardTitle}>{item.title || item.name || 'Untitled'}</Text>
              <Text style={s.cardDesc} numberOfLines={2}>
                {item.description || 'Official course material for your curriculum.'}
              </Text>

              <View style={s.cardFooter}>
                <View style={s.teacherBox}>
                  <View style={s.avatar}><Text style={s.avatarText}>{(item.uploadedBy?.name || 'T').charAt(0).toUpperCase()}</Text></View>
                  <View>
                    <Text style={s.teacherName}>{item.uploadedBy?.name || 'Faculty Member'}</Text>
                    <Text style={s.teacherLabel}>INSTRUCTOR</Text>
                  </View>
                </View>
                <View style={s.metaBox}>
                  <Text style={s.dateText}>🕒 {new Date(item.createdAt).toLocaleDateString()}</Text>
                  <Text style={s.sizeText}>💾 {formatBytes(item.fileSize)}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Class Picker Modal */}
      <Modal visible={pickerOpen} animationType="fade" transparent onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Select Curriculum Unit</Text>
            <ScrollView>
              {classes.length === 0 && <Text style={s.noClasses}>No enrolled classes found</Text>}
              {classes.map(c => (
                <TouchableOpacity key={c.id} style={s.modalItem} onPress={() => handleClassSelect(String(c.id))}>
                  <Text style={[s.modalItemText, selectedClassId === String(c.id) && s.modalItemActive]}>{c.name}</Text>
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
  loadingText: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 2, fontStyle: 'italic', textTransform: 'uppercase' },
  header: { padding: 20, paddingTop: 24, paddingBottom: 10 },
  kicker: { color: '#4f46e5', fontSize: 10, fontWeight: '900', letterSpacing: 3 },
  title: { fontSize: 32, fontWeight: '900', color: '#0f172a', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: -1, marginVertical: 6 },
  selectBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginTop: 12 },
  selectBtnText: { fontSize: 12, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', textTransform: 'uppercase' },
  selectBtnIcon: { fontSize: 12, color: '#4f46e5' },
  list: { padding: 20, paddingBottom: 40, gap: 16 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12, borderWidth: 2, borderColor: '#f1f5f9', borderStyle: 'dashed', borderRadius: 32, marginTop: 12 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: '#cbd5e1', fontSize: 14, fontWeight: '900', fontStyle: 'italic', letterSpacing: 1 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  iconBox: { width: 56, height: 56, backgroundColor: '#eef2ff', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 24 },
  actions: { flexDirection: 'row', gap: 8 },
  previewBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  previewText: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
  dlBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#e11d48', shadowColor: '#e11d48', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  dlText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', textTransform: 'uppercase', marginBottom: 8, letterSpacing: -0.5 },
  cardDesc: { fontSize: 12, color: '#94a3b8', fontWeight: '600', fontStyle: 'italic', lineHeight: 18, marginBottom: 24 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  teacherBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 12, fontWeight: '900', color: '#64748b', fontStyle: 'italic' },
  teacherName: { fontSize: 10, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 1 },
  teacherLabel: { fontSize: 8, color: '#cbd5e1', fontWeight: '800', textTransform: 'uppercase' },
  metaBox: { alignItems: 'flex-end', gap: 4 },
  dateText: { fontSize: 9, color: '#94a3b8', fontWeight: '800', backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  sizeText: { fontSize: 9, color: '#818cf8', fontWeight: '900', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, maxHeight: 400 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', marginBottom: 16 },
  noClasses: { textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalItemText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  modalItemActive: { color: '#4f46e5', fontWeight: '900' },
});

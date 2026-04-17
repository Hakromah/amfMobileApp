import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput, Alert, RefreshControl, Modal, ScrollView,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import api from '@/lib/api';
import { getStrapiMediaUrl } from '@/lib/config';

interface Material {
  id: number;
  title: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  createdAt?: string;
  targetClasses?: { id: number; name: string }[];
}

const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Use the shared getStrapiMediaUrl helper from config.ts (honours STRAPI_CLOUD / device IP)
const getFullUrl = (url: string): string => getStrapiMediaUrl(url);

export default function TeacherMaterialsScreen() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const fetchData = async () => {
    try {
      const [matRes, classRes] = await Promise.all([
        // ✅ Correct endpoints matching frontend
        api.get('/teacher/materials'),
        api.get('/teacher/materials/my-classes'),
      ]);
      setMaterials(Array.isArray(matRes.data) ? matRes.data : []);
      setClasses(Array.isArray(classRes.data) ? classRes.data : []);
    } catch (e: any) {
      console.error('[Materials] fetch:', e?.response?.status, e?.response?.data);
      Alert.alert('Error', 'Failed to load materials.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPickedFile(result.assets[0]);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick file.');
    }
  };

  const handleUpload = async () => {
    if (!pickedFile) { Alert.alert('Required', 'Please select a file.'); return; }
    if (!title.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    if (selectedClasses.length === 0) { Alert.alert('Required', 'Please select at least one class.'); return; }

    const formData = new FormData();

    // React Native FormData requires specific format for files
    formData.append('file', {
      uri: pickedFile.uri,
      name: pickedFile.name,
      type: pickedFile.mimeType || 'application/octet-stream',
    } as any);
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    // ✅ Matches frontend: selectedClasses.forEach(id => formData.append('classIds', String(id)))
    selectedClasses.forEach(id => formData.append('classIds', String(id)));

    setUploading(true);
    try {
      // ✅ Correct endpoint: POST /teacher/materials/upload with multipart/form-data
      await api.post('/teacher/materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Success', 'Material published successfully!');
      setIsUploadOpen(false);
      resetForm();
      fetchData();
    } catch (e: any) {
      console.error('[Materials] upload error:', e?.response?.status, JSON.stringify(e?.response?.data));
      Alert.alert('Upload Failed', e?.response?.data?.message || 'Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedClasses([]);
    setPickedFile(null);
  };

  const handleDelete = (id: number, title: string) => {
    Alert.alert('Delete Material', `Remove "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            // ✅ Correct endpoint: DELETE /teacher/materials/:id
            await api.delete(`/teacher/materials/${id}`);
            fetchData();
          } catch { Alert.alert('Error', 'Failed to delete.'); }
        }
      }
    ]);
  };

  const handlePreview = (mat: Material) => {
    if (!mat.fileUrl) return;
    const url = getFullUrl(mat.fileUrl);
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open file.'));
  };

  const toggleClass = (id: number) => {
    setSelectedClasses(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerEyebrow}>CURRICULUM MANAGEMENT</Text>
          <Text style={s.headerTitle}>Learning Assets.</Text>
        </View>
        <TouchableOpacity style={s.publishBtn} onPress={() => { resetForm(); setIsUploadOpen(true); }}>
          <Text style={s.publishBtnText}>+ PUBLISH RESOURCE</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={materials}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        numColumns={1}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#3b82f6" />}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📁</Text>
            <Text style={s.emptyTitle}>No Materials Yet</Text>
            <Text style={s.emptySub}>Publish your first educational resource above.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={s.fileIcon}>
                <Text style={s.fileIconText}>
                  {item.fileType?.includes('pdf') ? '📄' : item.fileType?.includes('image') ? '🖼️' : '📝'}
                </Text>
              </View>
              <View style={s.cardInfo}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.cardDesc} numberOfLines={2}>{item.description || 'No description'}</Text>
                <View style={s.classTags}>
                  {(item.targetClasses || []).map(c => (
                    <View key={c.id} style={s.classTag}><Text style={s.classTagText}>{c.name}</Text></View>
                  ))}
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id, item.title)} style={s.deleteBtn}>
                <Text style={s.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.cardFoot}>
              <View>
                <Text style={s.footMeta}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</Text>
                <Text style={s.footSize}>{formatBytes(item.fileSize)}</Text>
              </View>
              <TouchableOpacity style={s.previewBtn} onPress={() => handlePreview(item)}>
                <Text style={s.previewBtnText}>👁 Preview / Download</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Upload Modal */}
      <Modal visible={isUploadOpen} animationType="slide" transparent onRequestClose={() => setIsUploadOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20}>
          <View style={s.overlay}>
            <View style={s.modal}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Upload Resource.</Text>
                <TouchableOpacity onPress={() => setIsUploadOpen(false)} style={s.modalClose}>
                  <Text style={s.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                <Text style={s.fieldLabel}>RESOURCE TITLE *</Text>
                <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. Chapter 4 Notes" placeholderTextColor="#94a3b8" autoCapitalize="words" />

                <Text style={s.fieldLabel}>DESCRIPTION</Text>
                <TextInput
                  style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Instructional details..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                />

                <Text style={s.fieldLabel}>DEPLOY TO CLASSES *</Text>
                <View style={s.classPills}>
                  {classes.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[s.classPill, selectedClasses.includes(c.id) && s.classPillActive]}
                      onPress={() => toggleClass(c.id)}
                    >
                      <Text style={[s.classPillText, selectedClasses.includes(c.id) && s.classPillTextActive]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.fieldLabel}>FILE *</Text>
                <TouchableOpacity style={s.filePicker} onPress={pickFile}>
                  <Text style={s.filePickerIcon}>{pickedFile ? '✅' : '📎'}</Text>
                  <Text style={[s.filePickerText, pickedFile && { color: '#2563eb' }]} numberOfLines={1}>
                    {pickedFile ? pickedFile.name : 'Tap to select PDF, DOCX, or Image'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.uploadBtn, uploading && s.uploadBtnDisabled]} onPress={handleUpload} disabled={uploading}>
                  {uploading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.uploadBtnText}>AUTHORIZE PUBLICATION</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 12, flexWrap: 'wrap' },
  headerEyebrow: { fontSize: 9, fontWeight: '800', color: '#3b82f6', letterSpacing: 3, textTransform: 'uppercase' },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', textTransform: 'uppercase' },
  publishBtn: { backgroundColor: '#1e293b', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  publishBtnText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  list: { padding: 14, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  fileIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  fileIconText: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#1e293b', textTransform: 'uppercase', fontStyle: 'italic' },
  cardDesc: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginTop: 4, lineHeight: 18 },
  classTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  classTag: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  classTagText: { fontSize: 9, fontWeight: '900', color: '#475569', textTransform: 'uppercase', letterSpacing: 1, fontStyle: 'italic' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: '#94a3b8', fontSize: 16, fontWeight: '900' },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footMeta: { fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  footSize: { fontSize: 10, fontWeight: '700', color: '#3b82f6', marginTop: 2 },
  previewBtn: { backgroundColor: '#ef4444', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  previewBtnText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  emptyBox: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  emptySub: { fontSize: 13, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },
  // Modal styles
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 14 },
  modal: { backgroundColor: '#fff', borderRadius: 24, maxHeight: '92%', overflow: 'hidden' },
  modalHeader: { backgroundColor: '#1e293b', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '900', fontStyle: 'italic', textTransform: 'uppercase' },
  modalClose: { backgroundColor: '#ffffff22', borderRadius: 10, padding: 6 },
  modalCloseText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalScroll: { padding: 20, paddingBottom: 40 },
  fieldLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontWeight: '600', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  classPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  classPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  classPillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  classPillText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  classPillTextActive: { color: '#fff', fontWeight: '800' },
  filePicker: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed' },
  filePickerIcon: { fontSize: 22 },
  filePickerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  uploadBtn: { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 24 },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 2 },
});

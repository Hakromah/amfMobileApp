import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, TextInput, Modal, ScrollView
} from 'react-native';
import api from '@/hooks/lib/api';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

interface StudentItem {
  id: number;
  name?: string;
  username?: string;
  userId?: string;
  email?: string;
}

interface ClassItem {
  id: number;
  name: string;
  students?: { id: number }[];
}

interface TranscriptItem {
  id: number;
  referenceNumber: string;
  issuedDate: string;
  academicYears: string[];
}

export default function AdminTranscriptsScreen() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [classPickerOpen, setClassPickerOpen] = useState(false);

  // Selected student state
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Selected transcript details
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [transcriptData, setTranscriptData] = useState<any | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // Load initial filter parameters
  const loadFilterData = async () => {
    setLoading(true);
    try {
      const [classesRes, studentsRes] = await Promise.all([
        api.get('/admin/classes'),
        api.get('/admin/users?role=STUDENT')
      ]);
      setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
    } catch (error) {
      console.error('[Admin Transcripts] load:', error);
      Alert.alert('Error', 'Failed to synchronize registry databases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilterData();
  }, []);

  // Filter students based on class selection
  const classFilteredStudents = useMemo(() => {
    if (selectedClassId === 'all') return students;
    const selectedClass = classes.find(c => String(c.id) === selectedClassId);
    if (!selectedClass || !selectedClass.students) return [];
    const studentIdsInClass = selectedClass.students.map((s: any) => s.id);
    return students.filter(s => studentIdsInClass.includes(s.id));
  }, [students, classes, selectedClassId]);

  // Load transcripts list when student is selected
  const fetchStudentTranscripts = async (studentId: number) => {
    setLoadingLedger(true);
    try {
      const res = await api.get(`/admin/transcripts/student/${studentId}`);
      setTranscripts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load issued transcripts ledger.');
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentTranscripts(selectedStudent.id);
      setSelectedTranscriptId(null);
    } else {
      setTranscripts([]);
      setSelectedTranscriptId(null);
    }
  }, [selectedStudent]);

  // Fetch transcript details
  useEffect(() => {
    const fetchDetails = async () => {
      if (!selectedTranscriptId) {
        setTranscriptData(null);
        return;
      }
      setFetchingDetails(true);
      try {
        const res = await api.get(`/admin/transcripts/${selectedTranscriptId}/preview`);
        setTranscriptData(res.data);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to render transcript details.');
        setSelectedTranscriptId(null);
      } finally {
        setFetchingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedTranscriptId]);

  // Search filter
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return classFilteredStudents;
    return classFilteredStudents.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.userId || '').toLowerCase().includes(q)
    );
  }, [classFilteredStudents, searchQuery]);

  const handleExportPDF = async () => {
    if (!transcriptData) return;

    const s = transcriptData.student;
    const sch = transcriptData.school;
    const sum = transcriptData.summary;
    const meta = transcriptData.metadata;
    const date = new Date().toLocaleDateString();

    const scoreboardHtml = (transcriptData.courses || []).map((c: any) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>${c.subjectName}</strong><br/><span style="font-size: 10px; color: #64748b;">Code: ${c.subjectCode}</span></td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${c.term}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${c.semester}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${c.marks}%</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${c.grade}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; padding: 30px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 22px; color: #0f172a; }
            .header p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 24px; }
            .info-item { display: flex; flex-direction: column; }
            .info-label { font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; }
            .info-val { font-size: 14px; font-weight: bold; color: #1e293b; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th { background: #0f172a; color: white; padding: 10px; text-align: left; }
            .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${(sch.name || 'AMF ACADEMY').toUpperCase()}</h1>
              <p>Official Academic Transcript | Registry Records</p>
            </div>
            <div style="text-align: right">
              <span style="background: #2563eb; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">Ref: ${meta.referenceNumber}</span>
              <p style="margin-top: 6px; font-size: 10px; color: #94a3b8;">Issued: ${date}</p>
            </div>
          </div>

          <h3 style="font-size: 15px; margin-bottom: 10px; text-transform: uppercase;">Student Profile</h3>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">Full Name</span><span class="info-val">${s.name}</span></div>
            <div class="info-item"><span class="info-label">Student ID</span><span class="info-val">${s.userId || 'N/A'}</span></div>
            <div class="info-item"><span class="info-label">Cumulative GPA Equivalent</span><span class="info-val">${sum.weightedAverage.toFixed(1)}%</span></div>
            <div class="info-item"><span class="info-label">Academic Status</span><span style="color: ${sum.weightedAverage >= 50 ? '#10b981' : '#ef4444'}" class="info-val">${sum.weightedAverage >= 50 ? 'Good Standing' : 'Academic Probation'}</span></div>
          </div>

          <h3 style="font-size: 15px; margin-bottom: 10px; text-transform: uppercase;">Academic Scoreboard</h3>
          <table>
            <thead>
              <tr>
                <th style="padding: 10px; border: 1px solid #ddd;">Course / Subject</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Term</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Semester</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Score</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Grade</th>
              </tr>
            </thead>
            <tbody>
              ${scoreboardHtml}
            </tbody>
          </table>

          <div class="footer">
            <p><strong>Office of the Registrar</strong></p>
            <p>This is a certified academic transcript record generated from the AMF Registry Management System.</p>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Error', 'Failed to generate transcript PDF.');
    }
  };

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={s.loadingText}>Syncing Ledger...</Text>
    </View>
  );

  return (
    <View style={s.container}>
      {!selectedStudent ? (
        // Step 1: Student List
        <FlatList
          data={filteredStudents}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <View style={s.headerCard}>
              <Text style={s.headerTitle}>Transcripts <Text style={{ color: '#2563eb' }}>Matrix.</Text></Text>
              <Text style={s.headerSub}>Control and preview academic transcript ledgers.</Text>
              
              <View style={s.filterRow}>
                <TouchableOpacity style={s.classBtn} onPress={() => setClassPickerOpen(true)}>
                  <Text style={s.classBtnText} numberOfLines={1}>
                    🏫 {selectedClassId === 'all' ? 'All Classes' : (classes.find(c => String(c.id) === selectedClassId)?.name || 'Class')}
                  </Text>
                  <Text style={s.classBtnIcon}>▼</Text>
                </TouchableOpacity>

                <TextInput
                  style={s.searchInput}
                  placeholder="Search name or ID..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={s.emptyCentered}>
              <Text style={s.emptyIcon}>👥</Text>
              <Text style={s.emptyText}>No registered students found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={s.studentCard} onPress={() => setSelectedStudent(item)}>
              <View style={[s.avatar, { backgroundColor: '#2563eb' + '22' }]}>
                <Text style={[s.avatarText, { color: '#2563eb' }]}>
                  {(item.name || item.username || 'S').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.studentName}>{item.name || item.username || 'Unknown'}</Text>
                <Text style={s.studentId}>ID: {item.userId || '-'}</Text>
              </View>
              <Text style={s.nextArrow}>➡️</Text>
            </TouchableOpacity>
          )}
        />
      ) : !selectedTranscriptId ? (
        // Step 2: Transcripts list for selected student
        <View style={{ flex: 1 }}>
          <View style={s.headerSubCard}>
            <TouchableOpacity style={s.backBtn} onPress={() => setSelectedStudent(null)}>
              <Text style={s.backBtnText}>← Back to Students</Text>
            </TouchableOpacity>
            <Text style={s.studentTitle}>{selectedStudent.name || selectedStudent.username}</Text>
            <Text style={s.studentSubId}>ID: {selectedStudent.userId || '-'}</Text>
          </View>

          {loadingLedger ? (
            <View style={s.centered}><ActivityIndicator size="large" color="#2563eb" /></View>
          ) : (
            <FlatList
              data={transcripts}
              keyExtractor={i => String(i.id)}
              contentContainerStyle={s.list}
              ListEmptyComponent={
                <View style={s.emptyCentered}>
                  <Text style={s.emptyIcon}>📪</Text>
                  <Text style={s.emptyText}>No transcripts issued for this student.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={s.card}>
                  <View style={s.cardLeft}>
                    <Text style={s.refNum}>Ref: {item.referenceNumber}</Text>
                    <Text style={s.issuedDate}>Issued: {new Date(item.issuedDate).toLocaleDateString()}</Text>
                    <View style={s.semBadge}>
                      <Text style={s.semBadgeText}>{item.academicYears?.join(', ') || 'Academic Year'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={s.viewBtn} onPress={() => setSelectedTranscriptId(String(item.id))}>
                    <Text style={s.viewBtnText}>Preview</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      ) : (
        // Step 3: Transcript Preview
        fetchingDetails ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={s.loadingText}>Syncing Transcript Matrix...</Text>
          </View>
        ) : (
          transcriptData && (
            <ScrollView contentContainerStyle={s.scrollContainer}>
              <TouchableOpacity style={s.backBtn} onPress={() => setSelectedTranscriptId(null)}>
                <Text style={s.backBtnText}>← Back to Ledger</Text>
              </TouchableOpacity>

              {/* School branding */}
              <View style={s.schBranding}>
                <Text style={s.schName}>{transcriptData.school?.name || 'AMF ACADEMY'}</Text>
                <Text style={s.schRef}>Ref No: {transcriptData.metadata?.referenceNumber}</Text>
              </View>

              {/* Profile grid */}
              <View style={s.profileGrid}>
                <View style={s.profileItem}>
                  <Text style={s.pLabel}>STUDENT NAME</Text>
                  <Text style={s.pVal}>{transcriptData.student?.name}</Text>
                </View>
                <View style={s.profileItem}>
                  <Text style={s.pLabel}>STUDENT ID</Text>
                  <Text style={s.pVal}>{transcriptData.student?.userId || 'N/A'}</Text>
                </View>
                <View style={s.profileItem}>
                  <Text style={s.pLabel}>GPA EQUIVALENT</Text>
                  <Text style={s.pVal}>{transcriptData.summary?.weightedAverage.toFixed(1)}%</Text>
                </View>
                <View style={s.profileItem}>
                  <Text style={s.pLabel}>ACADEMIC STATUS</Text>
                  <Text style={[s.pVal, { color: transcriptData.summary?.weightedAverage >= 50 ? '#10b981' : '#ef4444' }]}>
                    {transcriptData.summary?.weightedAverage >= 50 ? 'GOOD STANDING' : 'PROBATION'}
                  </Text>
                </View>
              </View>

              {/* Scoreboard table */}
              <Text style={s.sectionTitle}>ACADEMIC SCOREBOARD</Text>
              <View style={s.tableContainer}>
                <View style={s.thRow}>
                  <View style={[s.thCell, { flex: 2 }]}><Text style={s.thCellText}>Course / Subject</Text></View>
                  <View style={[s.thCell, { flex: 1 }]}><Text style={s.thCellText}>Term</Text></View>
                  <View style={[s.thCell, { flex: 1 }]}><Text style={s.thCellText}>Score</Text></View>
                  <View style={[s.thCell, { flex: 1 }]}><Text style={s.thCellText}>Grade</Text></View>
                </View>

                {transcriptData.courses?.map((c: any, index: number) => (
                  <View key={index} style={s.tbRow}>
                    <View style={[s.tbCell, { flex: 2 }]}>
                      <Text style={s.courseName}>{c.subjectName}</Text>
                      <Text style={s.courseCode}>{c.subjectCode}</Text>
                    </View>
                    <View style={[s.tbCell, { flex: 1 }]}><Text style={s.courseVal}>{c.term} ({c.semester})</Text></View>
                    <View style={[s.tbCell, { flex: 1 }]}><Text style={[s.courseVal, { fontWeight: '900' }]}>{c.marks}%</Text></View>
                    <View style={[s.tbCell, { flex: 1 }]}><Text style={[s.courseVal, { fontWeight: '900', color: '#2563eb' }]}>{c.grade}</Text></View>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={s.downloadBtn} onPress={handleExportPDF}>
                <Text style={s.downloadBtnText}>📄 Export Official PDF</Text>
              </TouchableOpacity>
            </ScrollView>
          )
        )
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
                  style={[s.pickerItem, selectedClassId === String(c.id) && s.pickerItemActive]}
                  onPress={() => { setSelectedClassId(String(c.id)); setClassPickerOpen(false); }}
                >
                  <Text style={[s.pickerItemText, selectedClassId === String(c.id) && s.pickerItemTextActive]}>{c.name}</Text>
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

  // List
  list: { padding: 16, gap: 12 },
  headerCard: { backgroundColor: '#fff', padding: 14, borderRadius: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 10, marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a', fontStyle: 'italic', letterSpacing: -0.5 },
  headerSub: { fontSize: 10, color: '#64748b', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  
  filterRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  classBtn: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#dbeafe' },
  classBtnText: { fontSize: 12, fontWeight: '800', color: '#2563eb' },
  classBtnIcon: { fontSize: 10, color: '#2563eb' },
  searchInput: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, fontWeight: '600', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },

  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1, marginBottom: 8, marginHorizontal: 16 },
  avatar: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900' },
  studentName: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  studentId: { fontSize: 10, color: '#94a3b8', fontWeight: '700', marginTop: 2 },
  nextArrow: { fontSize: 14 },

  // Ledger List
  headerSubCard: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 6 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f1f5f9', borderRadius: 8, marginBottom: 8 },
  backBtnText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  studentTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', fontStyle: 'italic' },
  studentSubId: { fontSize: 11, color: '#64748b', fontWeight: '800' },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  cardLeft: { flex: 1, gap: 4 },
  refNum: { fontSize: 15, fontWeight: '900', color: '#1e293b', fontStyle: 'italic' },
  issuedDate: { fontSize: 10, color: '#94a3b8', fontWeight: '800' },
  semBadge: { alignSelf: 'flex-start', backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  semBadgeText: { fontSize: 9, fontWeight: '900', color: '#2563eb' },
  viewBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  viewBtnText: { color: '#fff', fontWeight: '900', fontSize: 11 },

  // Detail Scroll View
  scrollContainer: { padding: 16, paddingBottom: 40 },
  schBranding: { backgroundColor: '#0f172a', padding: 20, borderRadius: 20, marginBottom: 20 },
  schName: { color: '#fff', fontSize: 16, fontWeight: '900', fontStyle: 'italic' },
  schRef: { color: '#64748b', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 },

  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  profileItem: { width: '48%', backgroundColor: '#fff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  pLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5 },
  pVal: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginTop: 4 },

  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 2, marginBottom: 10 },
  tableContainer: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginBottom: 24 },
  thRow: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  thCell: { paddingHorizontal: 4 },
  thCellText: { fontSize: 9, fontWeight: '900', color: '#475569', textTransform: 'uppercase' },
  tbRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  tbCell: { paddingHorizontal: 4 },
  courseName: { fontSize: 12, fontWeight: '800', color: '#1e293b' },
  courseCode: { fontSize: 9, color: '#94a3b8', fontWeight: '700' },
  courseVal: { fontSize: 11, fontWeight: '700', color: '#475569' },

  downloadBtn: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  downloadBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

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
  pickerItemTextActive: { color: '#2563eb', fontWeight: '800' },
  pickerClose: { marginTop: 16, backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  pickerCloseText: { color: '#64748b', fontWeight: '800', fontSize: 14 },
});

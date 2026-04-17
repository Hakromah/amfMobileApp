import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, Modal, ScrollView
} from 'react-native';
import api from '@/lib/api';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

interface Result {
  id: number;
  marks: number;
  grade?: string;
  className?: string;
  examName?: string;
  term?: string;
  semester?: string;
  student?: { name?: string; userId?: string; id?: number };
}

export default function StudentResultsScreen() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string>('All Semesters');
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchResults = async () => {
    try {
      const res = await api.get('/student/results');
      setResults(res.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load your academic records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchResults(); }, []);

  const uniqueSemesters = useMemo(() => {
    const sems = results.map(r => r.semester).filter(Boolean) as string[];
    return ['All Semesters', ...Array.from(new Set(sems))];
  }, [results]);

  const filtered = useMemo(() => {
    if (selectedSemester === 'All Semesters') return results;
    return results.filter(r => r.semester === selectedSemester);
  }, [results, selectedSemester]);

  const totalScore = results.reduce((acc, curr) => acc + (curr.marks || 0), 0);
  const averageScore = results.length > 0 ? (totalScore / results.length).toFixed(1) : '0';
  const highestScore = results.length > 0 ? Math.max(...results.map(r => r.marks)) : 0;

  const downloadTranscript = async () => {
    if (filtered.length === 0) return Alert.alert('Error', 'No results for transcript');

    const sInfo = filtered[0]?.student;
    const sName = sInfo?.name || 'Unknown Student';
    const sId = sInfo?.userId || sInfo?.id || 'N/A';
    const date = new Date().toLocaleDateString();

    const fTotal = filtered.reduce((acc, curr) => acc + (curr.marks || 0), 0);
    const fAvg = (fTotal / filtered.length).toFixed(1);
    const isPassing = parseFloat(fAvg) >= 50;
    const status = isPassing ? 'GOOD STANDING' : 'PROBATION';

    let html = `
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #1e293b; }
            .header p { margin: 5px 0 0; color: #64748b; font-size: 14px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; background: #f8fafc; padding: 25px; border-radius: 12px; }
            .info-item { display: flex; flex-direction: column; }
            .info-label { font-size: 12px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
            .info-val { font-size: 16px; font-weight: bold; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #2563eb; color: white; padding: 12px; text-align: left; font-size: 14px; font-weight: bold; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
            .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>AMF INTERNATIONAL SCHOOL</h1>
              <p>Official Academic Transcript | Student Copy</p>
            </div>
            <div style="text-align: right">
              <p>Generated: ${date}</p>
            </div>
          </div>
          
          <h2 style="font-size: 18px; margin-bottom: 15px;">STUDENT PROFILE</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Full Name</span>
              <span class="info-val">${sName.toUpperCase()}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Student ID</span>
              <span class="info-val">${sId}</span>
            </div>
            <div class="info-item">
              <span class="info-label">GPA Equivalent</span>
              <span class="info-val">${fAvg}%</span>
            </div>
            <div class="info-item">
              <span class="info-label">Current Status</span>
              <span class="info-val" style="color: ${isPassing ? '#16a34a' : '#dc2626'}">${status}</span>
            </div>
          </div>

          <h2 style="font-size: 18px; margin-bottom: 15px;">EXAMINATION RECORDS</h2>
          <table>
            <tr>
              <th>Subject / Examination</th>
              <th>Term</th>
              <th>Semester</th>
              <th>Score</th>
              <th>Grade</th>
            </tr>
            ${filtered.map(r => `
              <tr>
                <td><strong>${r.examName || 'N/A'}</strong><br/><span style="font-size: 12px; color: #64748b;">${r.className || ''}</span></td>
                <td>${r.term || '-'}</td>
                <td>${r.semester || '-'}</td>
                <td><strong>${r.marks}%</strong></td>
                <td>${r.grade || 'N/A'}</td>
              </tr>
            `).join('')}
          </table>

          <div class="footer">
            <p><strong>Office of the Registrar</strong></p>
            <p>This document is a verified electronic student record issued by the AMF Management System.</p>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert('Error', 'Failed to compile transcript.');
    }
  };

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={s.loadingText}>Loading Academic Profile...</Text>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Academic <Text style={{ color: '#2563eb' }}>Portal.</Text></Text>
          <Text style={s.subText}>OVERALL AVERAGE: {averageScore}%</Text>
        </View>
        <TouchableOpacity style={s.exportBtn} onPress={downloadTranscript}>
          <Text style={s.exportIcon}>📄</Text>
          <Text style={s.exportText}>EXPORT</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchResults(); }} tintColor="#2563eb" />}
        ListHeaderComponent={
          <>
            {/* Stats Grid */}
            <View style={s.statsGrid}>
              <View style={[s.statCard, { backgroundColor: '#2563eb' }]}>
                <Text style={s.statLabelLight}>Peak Performance</Text>
                <Text style={s.statBigLight}>{highestScore}%</Text>
                <Text style={s.statDescLight}>Highest score achieved</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statLabel}>Evaluations</Text>
                <Text style={s.statBig}>{results.length}</Text>
                <Text style={s.statDesc}>Total exams taken</Text>
              </View>
            </View>

            {/* Filter */}
            <View style={s.filterRow}>
              <Text style={s.filterLabel}>Filter Results:</Text>
              <TouchableOpacity style={s.filterBtn} onPress={() => setPickerOpen(true)}>
                <Text style={s.filterBtnText}>{selectedSemester}</Text>
                <Text style={s.filterBtnIcon}>▼</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📪</Text>
            <Text style={s.emptyText}>No records found for this selection.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isPassing = item.marks >= 50;
          return (
            <View style={s.card}>
              <View style={s.cardLeft}>
                <Text style={s.examName}>{item.examName || 'Assessment'}</Text>
                <Text style={s.className}>{item.className || 'Class N/A'}</Text>
                <View style={s.badgeRow}>
                  <Text style={s.termBadge}>{item.term || 'TERM'}</Text>
                  <Text style={s.semText}>{item.semester || 'SEM'}</Text>
                </View>
              </View>
              <View style={s.cardRight}>
                <View style={s.scoreBox}>
                  <Text style={[s.scoreNum, !isPassing && { color: '#ef4444' }]}>{item.marks}%</Text>
                  <Text style={s.gradeLetter}>{item.grade || '-'}</Text>
                </View>
                <View style={[s.statusBadge, isPassing ? s.statusPass : s.statusFail]}>
                  <Text style={[s.statusText, isPassing ? { color: '#059669' } : { color: '#e11d48' }]}>
                    {isPassing ? 'PASSED' : 'FAILED'}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Semester Picker */}
      <Modal visible={pickerOpen} animationType="fade" transparent onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Filter by Semester</Text>
            <ScrollView>
              {uniqueSemesters.map(sem => (
                <TouchableOpacity key={sem} style={s.modalItem} onPress={() => { setSelectedSemester(sem); setPickerOpen(false); }}>
                  <Text style={[s.modalItemText, selectedSemester === sem && s.modalActive]}>{sem}</Text>
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
  header: { padding: 20, paddingTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 28, fontWeight: '900', color: '#0f172a', fontStyle: 'italic', letterSpacing: -0.5 },
  subText: { fontSize: 9, color: '#64748b', fontWeight: '800', letterSpacing: 2, marginTop: 6, textTransform: 'uppercase' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 6, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  exportIcon: { fontSize: 14, color: '#fff' },
  exportText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  list: { padding: 16, paddingTop: 0, gap: 12 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  statLabelLight: { color: '#93c5fd', fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  statBigLight: { color: '#fff', fontSize: 32, fontWeight: '900', fontStyle: 'italic', marginVertical: 4 },
  statDescLight: { color: '#bfdbfe', fontSize: 10, fontWeight: '600' },
  statLabel: { color: '#94a3b8', fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  statBig: { color: '#1e293b', fontSize: 32, fontWeight: '900', fontStyle: 'italic', marginVertical: 4 },
  statDesc: { color: '#64748b', fontSize: 10, fontWeight: '600' },
  filterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 14, marginBottom: 16, gap: 12 },
  filterLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', paddingLeft: 6 },
  filterBtn: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  filterBtnText: { fontSize: 11, fontWeight: '800', color: '#1e293b' },
  filterBtnIcon: { fontSize: 10, color: '#94a3b8' },
  emptyBox: { alignItems: 'center', padding: 40, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#94a3b8', fontSize: 11, fontWeight: '700', fontStyle: 'italic' },
  card: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  cardLeft: { flex: 1, gap: 4 },
  examName: { fontSize: 15, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', letterSpacing: -0.5 },
  className: { fontSize: 10, color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'center' },
  termBadge: { backgroundColor: '#eff6ff', color: '#2563eb', fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  semText: { color: '#64748b', fontSize: 10, fontWeight: '700' },
  cardRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  scoreBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreNum: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  gradeLetter: { backgroundColor: '#f1f5f9', color: '#475569', fontSize: 12, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusPass: { backgroundColor: '#ecfdf5' },
  statusFail: { backgroundColor: '#fff1f2' },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24, maxHeight: 400 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', fontStyle: 'italic', marginBottom: 16 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalItemText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  modalActive: { color: '#2563eb', fontWeight: '900' },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, TextInput, Modal, ScrollView,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '@/hooks/lib/api';

interface Result {
  id: number;
  marks: number;
  grade?: string;
  student?: { id?: number; name?: string; username?: string; userId?: string };
  exam?: { id?: number; name?: string; semester?: string; term?: string; weight?: number; locked?: boolean };
}

// ─── Grade helpers (mirrors frontend) ────────────────────────────────────────
const calcGrade = (marks: number): string => {
  if (marks >= 90) return 'AA';
  if (marks >= 85) return 'BA';
  if (marks >= 80) return 'BB';
  if (marks >= 75) return 'CB';
  if (marks >= 70) return 'CC';
  if (marks >= 60) return 'DC';
  if (marks >= 50) return 'DD';
  return 'FF';
};

const GRADE_COLORS: Record<string, string> = {
  AA: '#10b981', BA: '#10b981', BB: '#3b82f6', CB: '#3b82f6',
  CC: '#f59e0b', DC: '#f97316', DD: '#f97316', FF: '#ef4444',
};

// ─── Transcript generator (mirrors frontend PDF logic) ───────────────────────
async function generateTranscript(data: Result[]) {
  if (!data.length) {
    Alert.alert('No Data', 'No results to generate transcript for.');
    return;
  }

  const student = data[0].student;
  const total = data.reduce((acc, r) => acc + (r.marks || 0), 0);
  const avg = (total / data.length).toFixed(1);
  const passing = parseFloat(avg) >= 50;
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const rows = data.map(r => `
    <tr>
      <td>${r.exam?.semester || 'N/A'}</td>
      <td>${r.exam?.name || 'N/A'}</td>
      <td>${r.exam?.term || 'N/A'}</td>
      <td style="text-align:center">${r.exam?.weight ?? 0}%</td>
      <td style="text-align:center; font-weight:900; color:${r.marks >= 50 ? '#1e293b' : '#ef4444'}">${r.marks}%</td>
      <td style="text-align:center; font-weight:900">${r.grade || calcGrade(r.marks)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; }
        .header { display: flex; align-items: center; gap: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 28px; }
        .logo { width: 60px; height: 60px; background: #2563eb; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 900; line-height: 1.2; text-align: center; padding: 8px; }
        .school-name { font-size: 20px; font-weight: 900; }
        .school-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
        .meta { margin-bottom: 24px; display: flex; justify-content: space-between; }
        .meta-left h2 { font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 8px; }
        .meta-left p { font-size: 12px; color: #475569; margin-bottom: 4px; }
        .meta-right { text-align: right; background: ${passing ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${passing ? '#bbf7d0' : '#fecaca'}; border-radius: 12px; padding: 14px 20px; }
        .meta-right .avg { font-size: 24px; font-weight: 900; color: ${passing ? '#10b981' : '#ef4444'}; }
        .meta-right .status { font-size: 10px; font-weight: 900; text-transform: uppercase; color: ${passing ? '#10b981' : '#ef4444'}; letter-spacing: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px; }
        th { background: #1e293b; color: #fff; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
        td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
        tr:nth-child(even) td { background: #f8fafc; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
        .sig-line { width: 180px; border-bottom: 1px solid #94a3b8; margin-top: 40px; margin-bottom: 6px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">AMF<br/>ACAD</div>
        <div>
          <div class="school-name">AMF INTERNATIONAL EXCELLENCE SCHOOL</div>
          <div class="school-sub">Official Academic Transcript &bull; Generated on ${date}</div>
        </div>
      </div>

      <div class="meta">
        <div class="meta-left">
          <h2>Official Student Transcript</h2>
          <p><strong>Full Name:</strong> ${(student?.name || student?.username || 'N/A').toUpperCase()}</p>
          <p><strong>Student ID:</strong> ${student?.userId || 'N/A'}</p>
          <p><strong>Total Records:</strong> ${data.length}</p>
        </div>
        <div class="meta-right">
          <div class="avg">${avg}%</div>
          <div class="status">${passing ? '✓ Good Standing' : '⚠ Probation'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Semester</th><th>Subject / Assessment</th><th>Term</th>
            <th style="text-align:center">Weight</th>
            <th style="text-align:center">Score</th>
            <th style="text-align:center">Grade</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="footer">
        <div class="sig-line"></div>
        <p>Authorized Administrator Signature</p>
        <p style="margin-top:24px">This document is a verified electronic copy issued by the AMF School Management System.</p>
      </div>
    </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Transcript' });
    } else {
      Alert.alert('Saved', `Transcript saved to:\n${uri}`);
    }
  } catch (e: any) {
    Alert.alert('Error', `Failed to generate transcript: ${e.message}`);
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AdminResultsScreen() {
  const [results, setResults] = useState<Result[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [selectedSemester, setSelectedSemester] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [transcripting, setTranscripting] = useState(false);

  // Unique semesters from loaded results
  const uniqueSemesters = Array.from(new Set(results.map(r => r.exam?.semester).filter(Boolean)));

  // Filtered by semester client-side
  const filtered = selectedSemester === 'all'
    ? results
    : results.filter(r => r.exam?.semester === selectedSemester);

  const fetchResults = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (studentQuery.trim()) params.append('studentQuery', studentQuery.trim());
      if (selectedClassId !== 'all') params.append('classId', selectedClassId);
      // ✅ Correct endpoint: /admin/results/filter
      const r = await api.get(`/admin/results/filter?${params.toString()}`);
      setResults(Array.isArray(r.data) ? r.data : []);
      setSelectedIds(new Set());
    } catch (e: any) {
      console.error('[Results] fetch:', e?.response?.status, e?.response?.data);
      Alert.alert('Error', 'Failed to load results. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentQuery, selectedClassId]);

  useEffect(() => {
    const init = async () => {
      try {
        const c = await api.get('/admin/classes');
        setClasses(c.data);
      } catch { /* ignore */ }
    };
    init();
    fetchResults();
  }, []);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleTranscript = async () => {
    const data = selectedIds.size > 0
      ? results.filter(r => selectedIds.has(r.id))
      : filtered;
    setTranscripting(true);
    await generateTranscript(data);
    setTranscripting(false);
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color="#10b981" /></View>;

  return (
    <View style={s.container}>
      {/* Search + Filter Bar */}
      <View style={s.filterBar}>
        <TextInput
          style={s.searchInput}
          placeholder="Search student name or ID..."
          placeholderTextColor="#94a3b8"
          value={studentQuery}
          onChangeText={setStudentQuery}
          onSubmitEditing={fetchResults}
          returnKeyType="search"
        />
        <View style={s.filterRow}>
          {/* Class filter */}
          <TouchableOpacity style={s.filterChip} onPress={() => setClassPickerOpen(true)}>
            <Text style={s.filterChipText} numberOfLines={1}>
              🏫 {selectedClassId === 'all' ? 'All Classes' : (classes.find(c => String(c.id) === selectedClassId)?.name || selectedClassId)}
            </Text>
          </TouchableOpacity>

          {/* Semester filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.semesterRow}>
            {['all', ...uniqueSemesters].map(sem => (
              <TouchableOpacity
                key={sem}
                style={[s.semChip, selectedSemester === sem && s.semChipActive]}
                onPress={() => setSelectedSemester(sem as string)}
              >
                <Text style={[s.semChipText, selectedSemester === sem && s.semChipTextActive]}>
                  {sem === 'all' ? 'All Sems' : sem}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={s.searchBtn} onPress={fetchResults}>
            <Text style={s.searchBtnText}>🔍 Filter</Text>
          </TouchableOpacity>
        </View>

        {/* Transcript Button */}
        <TouchableOpacity
          style={[s.transcriptBtn, transcripting && s.transcriptBtnDisabled]}
          onPress={handleTranscript}
          disabled={transcripting || filtered.length === 0}
        >
          {transcripting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.transcriptBtnText}>
              📄 {selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export Visible Results'}
            </Text>
          }
        </TouchableOpacity>
      </View>

      {/* Results List */}
      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchResults(); }} tintColor="#10b981" />}
        ListEmptyComponent={<Text style={s.empty}>No results found. Use filters above and tap Filter.</Text>}
        renderItem={({ item }) => {
          const grade = item.grade || calcGrade(item.marks);
          const gradeColor = GRADE_COLORS[grade] || '#64748b';
          const passing = item.marks >= 50;
          const isSelected = selectedIds.has(item.id);
          return (
            <TouchableOpacity style={[s.card, isSelected && s.cardSelected]} onPress={() => toggleSelect(item.id)} activeOpacity={0.8}>
              {/* Selection indicator */}
              <View style={[s.selDot, isSelected && s.selDotActive]} />
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {(item.student?.name || item.student?.username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={s.info}>
                <Text style={s.name}>{item.student?.name || item.student?.username || 'Unknown'}</Text>
                <Text style={s.uid}>ID: {item.student?.userId || '—'}</Text>
                <Text style={s.exam} numberOfLines={1}>{item.exam?.name || 'Unknown Assessment'}</Text>
                <View style={s.tags}>
                  {item.exam?.term && <View style={s.tag}><Text style={s.tagText}>{item.exam.term}</Text></View>}
                  {item.exam?.semester && <Text style={s.semTag}>{item.exam.semester}</Text>}
                </View>
              </View>
              <View style={s.scoreBlock}>
                <Text style={[s.score, !passing && s.scoreFail]}>{item.marks}%</Text>
                <View style={[s.gradeBadge, { backgroundColor: gradeColor + '22' }]}>
                  <Text style={[s.gradeText, { color: gradeColor }]}>{grade}</Text>
                </View>
                <Text style={[s.outcome, passing ? s.outcomePassed : s.outcomeFailed]}>
                  {passing ? 'PASSED' : 'FAILED'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Class Picker Modal */}
      <Modal visible={classPickerOpen} animationType="slide" transparent onRequestClose={() => setClassPickerOpen(false)}>
        <View style={s.pickerOverlay}>
          <View style={s.pickerCard}>
            <Text style={s.pickerTitle}>Select Class</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterBar: { backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 10 },
  searchInput: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1e293b', fontWeight: '600' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#dbeafe', maxWidth: 140 },
  filterChipText: { fontSize: 11, fontWeight: '800', color: '#2563eb' },
  semesterRow: { flexDirection: 'row', gap: 6 },
  semChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  semChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  semChipText: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  semChipTextActive: { color: '#fff' },
  searchBtn: { backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  transcriptBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  transcriptBtnDisabled: { opacity: 0.6 },
  transcriptBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  list: { padding: 14, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1.5, borderColor: 'transparent' },
  cardSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  selDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#cbd5e1', backgroundColor: 'transparent' },
  selDotActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900', color: '#10b981' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  uid: { fontSize: 10, color: '#94a3b8', fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 2 },
  exam: { fontSize: 12, color: '#475569', fontWeight: '600', marginTop: 4 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  tag: { backgroundColor: '#dbeafe', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 9, fontWeight: '900', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 1 },
  semTag: { fontSize: 9, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  scoreBlock: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  scoreFail: { color: '#ef4444' },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  gradeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  outcome: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  outcomePassed: { color: '#10b981' },
  outcomeFailed: { color: '#ef4444' },
  empty: { textAlign: 'center', padding: 40, color: '#94a3b8', fontWeight: '600', lineHeight: 22 },
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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, TextInput, Modal, ScrollView, Dimensions,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '@/hooks/lib/api';
import { LineChart } from 'react-native-chart-kit';

interface Result {
  id: number;
  marks: number;
  grade?: string;
  student?: { id?: number; name?: string; username?: string; userId?: string };
  exam?: { id?: number; name?: string; semester?: string; term?: string; weight?: number; locked?: boolean };
}

// ─── Grade helpers ───────────────────────────────────────────────────────────
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

// ─── Transcript generator for List View ──────────────────────────────────────
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

  // Tabs and Gradebook
  const [activeTab, setActiveTab] = useState<'list' | 'gradebook'>('list');
  const [exams, setExams] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [gradebookLoading, setGradebookLoading] = useState(false);
  const [selectedStudentForChart, setSelectedStudentForChart] = useState<any | null>(null);

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

  // Fetch Gradebook data
  const fetchGradebookData = useCallback(async () => {
    if (selectedClassId === 'all') return;
    setGradebookLoading(true);
    try {
      const [resultsRes, examsRes] = await Promise.all([
        api.get(`/admin/results/filter?classId=${selectedClassId}`),
        api.get(`/admin/exams?classId=${selectedClassId}`),
      ]);

      const classExams = Array.isArray(examsRes.data) ? examsRes.data : [];
      setExams(classExams);

      const studentMap: any = {};
      (Array.isArray(resultsRes.data) ? resultsRes.data : []).forEach((r: any) => {
        const sId = r?.student?.userId || r?.student?.id || `unknown-${r?.id}`;
        const studentName = r.student?.username || r.student?.name || 'Unknown Student';
        const studentId = r?.student?.id || null;
        const examId = r?.exam?.id;

        if (!examId) return;

        if (!studentMap[sId]) {
          studentMap[sId] = { 
            id: studentId, 
            name: studentName,
            userId: sId, 
            marks: {} 
          };
        }

        studentMap[sId].marks[examId] = { 
          val: r?.marks || 0, 
          resultId: r?.id, 
          isLocked: r?.exam?.locked || false 
        };
      });

      setReportData(Object.values(studentMap));
    } catch (e) {
      console.error('[Admin Gradebook] fetch error', e);
    } finally {
      setGradebookLoading(false);
    }
  }, [selectedClassId]);

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

  useEffect(() => {
    if (activeTab === 'gradebook') {
      fetchGradebookData();
    }
  }, [selectedClassId, activeTab, fetchGradebookData]);

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

  // Chart data builder
  const getChartData = (student: any) => {
    return exams.map((exam) => {
      const allScores = reportData.map((s) => s.marks[exam.id]?.val).filter(v => v != null);
      const avg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
      return {
        name: exam.name || 'Assessment',
        studentScore: student.marks[exam.id]?.val || 0,
        classAverage: parseFloat(avg.toFixed(1)),
      };
    });
  };

  const handleExportGradebook = async () => {
    if (selectedClassId === 'all') {
      Alert.alert('Error', 'Please select a specific class to export.');
      return;
    }
    if (reportData.length === 0) {
      Alert.alert('Error', 'No data to export.');
      return;
    }

    const className = classes.find(c => String(c.id) === selectedClassId)?.name || 'Class';
    const date = new Date().toLocaleDateString();

    const headHtml = `
      <tr>
        <th style="padding: 8px; border: 1px solid #ddd; background: #0f172a; color: white;">#</th>
        <th style="padding: 8px; border: 1px solid #ddd; background: #0f172a; color: white; text-align: left;">Student Name</th>
        <th style="padding: 8px; border: 1px solid #ddd; background: #0f172a; color: white; text-align: left;">Student ID</th>
        ${exams.map(e => `<th style="padding: 8px; border: 1px solid #ddd; background: #0f172a; color: white; text-align: center;">${e.name || 'Exam'} (${e.weight || 0}%)</th>`).join('')}
        <th style="padding: 8px; border: 1px solid #ddd; background: #0f172a; color: white; text-align: center;">Wtd. Avg</th>
        <th style="padding: 8px; border: 1px solid #ddd; background: #0f172a; color: white; text-align: center;">Grade</th>
      </tr>
    `;

    const bodyHtml = reportData.map((student, idx) => {
      const scores = exams.map(e => student.marks[e.id]?.val);
      const validScores = scores.filter(v => v !== undefined && v !== null);
      const avg = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;
      const letterGrade = avg !== null ? calcGrade(avg) : '-';

      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${student.name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${student.userId || '-'}</td>
          ${exams.map(e => {
            const val = student.marks[e.id]?.val;
            return `<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${val !== undefined ? `${val}%` : '-'}</td>`;
          }).join('')}
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: #2563eb;">${avg !== null ? `${avg.toFixed(1)}%` : '-'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${letterGrade}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; padding: 20px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 20px; color: #0f172a; }
            .header p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th { text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>AMF INTERNATIONAL SCHOOL</h1>
              <p>Official Gradebook Matrix Report</p>
            </div>
            <div style="text-align: right">
              <span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">CLASS: ${className}</span>
              <p style="margin-top: 6px; font-size: 10px; color: #94a3b8;">Generated: ${date}</p>
            </div>
          </div>
          <table>
            <thead>${headHtml}</thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Error', 'Failed to generate report PDF.');
    }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color="#10b981" /></View>;

  return (
    <View style={s.container}>
      {/* Search + Filter Bar */}
      <View style={s.filterBar}>
        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'list' && s.tabBtnActive]} onPress={() => setActiveTab('list')}>
            <Text style={[s.tabBtnText, activeTab === 'list' && s.tabBtnTextActive]}>📋 List View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'gradebook' && s.tabBtnActive]} onPress={() => setActiveTab('gradebook')}>
            <Text style={[s.tabBtnText, activeTab === 'gradebook' && s.tabBtnTextActive]}>📊 Gradebook</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'list' && (
          <TextInput
            style={s.searchInput}
            placeholder="Search student name or ID..."
            placeholderTextColor="#94a3b8"
            value={studentQuery}
            onChangeText={setStudentQuery}
            onSubmitEditing={fetchResults}
            returnKeyType="search"
          />
        )}

        <View style={s.filterRow}>
          {/* Class filter */}
          <TouchableOpacity style={s.filterChip} onPress={() => setClassPickerOpen(true)}>
            <Text style={s.filterChipText} numberOfLines={1}>
              Class: {selectedClassId === 'all' ? 'All' : (classes.find(c => String(c.id) === selectedClassId)?.name || selectedClassId)}
            </Text>
          </TouchableOpacity>

          {activeTab === 'list' && (
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
          )}

          {activeTab === 'list' && (
            <TouchableOpacity style={s.searchBtn} onPress={fetchResults}>
              <Text style={s.searchBtnText}>🔍 Filter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons */}
        {activeTab === 'list' ? (
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
        ) : (
          selectedClassId !== 'all' && (
            <TouchableOpacity style={s.exportGradebookBtn} onPress={handleExportGradebook}>
              <Text style={s.exportGradebookBtnText}>📄 Export Gradebook PDF</Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {activeTab === 'list' ? (
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
                <View style={[s.selDot, isSelected && s.selDotActive]} />
                <View style={[s.avatar, { backgroundColor: '#10b981' + '22' }]}>
                  <Text style={[s.avatarText, { color: '#10b981' }]}>
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
      ) : (
        // Gradebook Tab View
        selectedClassId === 'all' ? (
          <View style={s.emptyCentered}>
            <Text style={s.emptyIcon}>🏫</Text>
            <Text style={s.emptyTitle}>Select a Class</Text>
            <Text style={s.emptySubtitle}>Admin performance matrix requires selecting a specific class from filters above.</Text>
          </View>
        ) : gradebookLoading ? (
          <View style={s.emptyCentered}><ActivityIndicator size="large" color="#10b981" /></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={s.gradebookTable}>
                {/* Table Header */}
                <View style={s.tableHeaderRow}>
                  <View style={[s.headerCell, { width: 120 }]}><Text style={s.headerCellText}>Student</Text></View>
                  {exams.map(e => (
                    <View key={e.id} style={[s.headerCell, { width: 80 }]}><Text style={s.headerCellText} numberOfLines={1}>{e.name}</Text></View>
                  ))}
                  <View style={[s.headerCell, { width: 80 }]}><Text style={s.headerCellText}>Avg</Text></View>
                  <View style={[s.headerCell, { width: 60 }]}><Text style={s.headerCellText}>Grade</Text></View>
                </View>
                {/* Table Body */}
                <ScrollView style={{ maxHeight: 380 }}>
                  {reportData.map((student) => {
                    const scores = exams.map(e => student.marks[e.id]?.val);
                    const validScores = scores.filter(v => v !== undefined && v !== null);
                    const avg = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;
                    return (
                      <TouchableOpacity key={student.userId} style={s.tableRow} onPress={() => setSelectedStudentForChart(student)}>
                        <View style={[s.bodyCell, { width: 120 }]}><Text style={s.studentNameText} numberOfLines={1}>{student.name}</Text></View>
                        {exams.map(e => {
                          const marks = student.marks[e.id]?.val;
                          return (
                            <View key={e.id} style={[s.bodyCell, { width: 80 }]}>
                              <Text style={s.scoreText}>{marks !== undefined ? `${marks}%` : '-'}</Text>
                            </View>
                          );
                        })}
                        <View style={[s.bodyCell, { width: 80 }]}>
                          <Text style={[s.scoreText, { fontWeight: '900', color: '#10b981' }]}>{avg !== null ? `${avg.toFixed(1)}%` : '-'}</Text>
                        </View>
                        <View style={[s.bodyCell, { width: 60 }]}>
                          <Text style={[s.gradeTextVal, { fontWeight: '900' }]}>{avg !== null ? calcGrade(avg) : '-'}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </ScrollView>
            <Text style={s.gradebookNote}>💡 Tap student row to view performance trend charts.</Text>
          </ScrollView>
        )
      )}

      {/* Chart Analysis Modal */}
      <Modal visible={!!selectedStudentForChart} animationType="slide" transparent onRequestClose={() => setSelectedStudentForChart(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Performance Trend</Text>
              <TouchableOpacity onPress={() => setSelectedStudentForChart(null)} style={s.modalCloseBtn}>
                <Text style={s.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            {selectedStudentForChart && (
              <ScrollView contentContainerStyle={s.modalScroll}>
                <Text style={s.chartStudentName}>{selectedStudentForChart.name}</Text>
                <Text style={s.chartStudentId}>ID: {selectedStudentForChart.userId}</Text>
                {getChartData(selectedStudentForChart).length > 0 ? (
                  <View style={{ marginTop: 20, alignItems: 'center' }}>
                    <LineChart
                      data={{
                        labels: getChartData(selectedStudentForChart).map(d => {
                          const name = d.name || 'Exam';
                          return name.length > 8 ? name.substring(0, 6) + '..' : name;
                        }),
                        datasets: [
                          {
                            data: getChartData(selectedStudentForChart).map(d => d.studentScore),
                            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green for admin
                            strokeWidth: 3,
                          },
                          {
                            data: getChartData(selectedStudentForChart).map(d => d.classAverage),
                            color: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                            strokeWidth: 2,
                            strokeDashArray: [4, 4],
                          }
                        ],
                        legend: ['Score', 'Class Avg']
                      }}
                      width={Dimensions.get('window').width - 64}
                      height={200}
                      chartConfig={{
                        backgroundColor: '#ffffff',
                        backgroundGradientFrom: '#ffffff',
                        backgroundGradientTo: '#ffffff',
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: { r: '4', strokeWidth: '2', stroke: '#10b981' }
                      }}
                      bezier
                      style={{ borderRadius: 16, marginLeft: -16 }}
                    />
                  </View>
                ) : (
                  <Text style={s.empty}>No exam records found for this student.</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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
  
  // Filter & Tabs
  filterBar: { backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 10 },
  tabRow: { flexDirection: 'row', gap: 8, marginVertical: 2 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  tabBtnActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  tabBtnText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  tabBtnTextActive: { color: '#fff' },

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

  exportGradebookBtn: { backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  exportGradebookBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  list: { padding: 14, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1.5, borderColor: 'transparent' },
  cardSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  selDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#cbd5e1', backgroundColor: 'transparent' },
  selDotActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  avatar: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900' },
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

  // Gradebook grid layout
  gradebookTable: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 12 },
  headerCell: { paddingHorizontal: 8, justifyContent: 'center' },
  headerCellText: { fontSize: 11, fontWeight: '800', color: '#475569', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12, alignItems: 'center' },
  bodyCell: { paddingHorizontal: 8, justifyContent: 'center' },
  studentNameText: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  scoreText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  gradeTextVal: { fontSize: 12, fontWeight: '800', color: '#475569' },
  gradebookNote: { fontSize: 10, color: '#64748b', fontWeight: '700', marginTop: 12, fontStyle: 'italic', paddingLeft: 4 },

  emptyCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, minHeight: 300 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 6 },
  emptySubtitle: { fontSize: 11, color: '#64748b', fontWeight: '700', textAlign: 'center', lineHeight: 16 },

  chartStudentName: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginTop: 8 },
  chartStudentId: { fontSize: 11, color: '#64748b', fontWeight: '700', marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 12 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, maxHeight: '90%', overflow: 'hidden' },
  modalHeader: { backgroundColor: '#1e293b', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  modalCloseBtn: { backgroundColor: '#ffffff22', borderRadius: 10, padding: 6 },
  modalCloseBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalScroll: { padding: 20 },

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

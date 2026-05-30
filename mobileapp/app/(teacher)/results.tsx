import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput, Alert, RefreshControl, Modal, ScrollView, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import api from '@/hooks/lib/api';
import { LineChart } from 'react-native-chart-kit';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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

  // Tabs and Gradebook
  const [activeTab, setActiveTab] = useState<'list' | 'gradebook'>('list');
  const [exams, setExams] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [gradebookLoading, setGradebookLoading] = useState(false);
  const [selectedStudentForChart, setSelectedStudentForChart] = useState<any | null>(null);

  // Result form state
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

  // ✅ Client-side student filtering - fetch matches all for class
  const fetchResults = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedClassId !== 'all') params.append('classId', selectedClassId);
      const res = await api.get(`/teacher/results/filter?${params.toString()}`);
      setResults(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setResults([]);
      console.error('[Results] fetch', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClassId]);

  // Fetch Gradebook data
  const fetchGradebookData = useCallback(async () => {
    if (selectedClassId === 'all') return;
    setGradebookLoading(true);
    try {
      const [resultsRes, examsRes] = await Promise.all([
        api.get(`/teacher/classes/${selectedClassId}/gradebook`),
        api.get('/teacher/exams'),
      ]);

      const classExams = examsRes.data?.filter((e: any) => e?.classe?.id && String(e.classe.id) === selectedClassId) || [];
      setExams(classExams);

      const studentMap: any = {};
      resultsRes.data?.forEach((r: any) => {
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
      console.error('[Gradebook] fetch error', e);
    } finally {
      setGradebookLoading(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    if (activeTab === 'gradebook') {
      fetchGradebookData();
    }
  }, [selectedClassId, activeTab, fetchGradebookData]);

  // Client-side search logic
  const displayedResults = useMemo(() => {
    const q = filterStudentId.trim().toLowerCase();
    if (!q) return results;
    return results.filter(r => {
      const idMatch = (r.student?.userId || '').toLowerCase().includes(q);
      const nameMatch = (r.student?.username || r.student?.name || '').toLowerCase().includes(q);
      return idMatch || nameMatch;
    });
  }, [results, filterStudentId]);

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
              <h1>A.M. FOFANA ISLAMIC & ENGLISH HIGH SCHOOL</h1>
              <p>Official Grade Report  •  Academic Performance Matrix</p>
            </div>
            <div style="text-align: right">
              <span style="background: #2563eb; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">CLASS: ${className}</span>
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
        await api.put(`/teacher/results/${editingResult.id}`, payload);
        Alert.alert('Success', 'Record updated.');
      } else {
        await api.post('/teacher/results', payload);
        Alert.alert('Success', 'Draft saved.');
      }
      setIsFormOpen(false);
      fetchResults();
      if (selectedClassId !== 'all') fetchGradebookData();
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

        {/* Tab Selector */}
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
            placeholder="Search student ID or Name..."
            placeholderTextColor="#94a3b8"
            value={filterStudentId}
            onChangeText={setFilterStudentId}
            returnKeyType="search"
          />
        )}

        {activeTab === 'gradebook' && selectedClassId !== 'all' && (
          <TouchableOpacity style={s.exportBtn} onPress={handleExportGradebook}>
            <Text style={s.exportBtnText}>📄 Export PDF Report</Text>
          </TouchableOpacity>
        )}

        {activeTab === 'list' && hasDrafts && (
          <TouchableOpacity style={s.publishBtn} onPress={handlePublishDrafts}>
            <Text style={s.publishBtnText}>📤 Publish Drafts to Students</Text>
          </TouchableOpacity>
        )}
      </View>

      {activeTab === 'list' ? (
        <FlatList
          data={displayedResults}
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
      ) : (
        // Gradebook Tab View
        selectedClassId === 'all' ? (
          <View style={s.emptyCentered}>
            <Text style={s.emptyIcon}>🏫</Text>
            <Text style={s.emptyTitle}>No Class Selected</Text>
            <Text style={s.emptySubtitle}>Please select a specific class to view the performance matrix.</Text>
          </View>
        ) : gradebookLoading ? (
          <View style={s.emptyCentered}><ActivityIndicator size="large" color="#2563eb" /></View>
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
                          <Text style={[s.scoreText, { fontWeight: '900', color: '#2563eb' }]}>{avg !== null ? `${avg.toFixed(1)}%` : '-'}</Text>
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
            <Text style={s.gradebookNote}>💡 Tap on a student row to view their performance analysis chart.</Text>
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
                            color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
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
                        propsForDots: { r: '4', strokeWidth: '2', stroke: '#2563eb' }
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

                <Text style={s.formLabel}>ASSESSMENT PERIOD *</Text>
                <TouchableOpacity style={s.pickerTrigger} onPress={() => setFormExamPicker(true)} disabled={!!editingResult}>
                  <Text style={formExamId ? s.pickerVal : s.pickerPlaceholder}>
                    {formExams.find(e => String(e.id) === formExamId)?.name || 'Select exam...'}
                  </Text>
                </TouchableOpacity>

                <Text style={s.formLabel}>STUDENT NAME *</Text>
                <TouchableOpacity style={s.pickerTrigger} onPress={() => setFormStudentPicker(true)} disabled={!!editingResult || !formExamId}>
                  <Text style={formStudentId ? s.pickerVal : s.pickerPlaceholder}>
                    {formStudents.find(s => String(s.id) === formStudentId)?.name || formStudents.find(s => String(s.id) === formStudentId)?.username || (formExamId ? 'Select student...' : 'Select exam first')}
                  </Text>
                </TouchableOpacity>

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
  
  // Tabs styling
  tabRow: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  tabBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabBtnText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  tabBtnTextActive: { color: '#fff' },

  // Gradebook layout
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

  // Empty centered layout
  emptyCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, minHeight: 300 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 6 },
  emptySubtitle: { fontSize: 11, color: '#64748b', fontWeight: '700', textAlign: 'center', lineHeight: 16 },

  // Export & Charts
  exportBtn: { backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 10, alignItems: 'center', width: '100%' },
  exportBtnText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
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

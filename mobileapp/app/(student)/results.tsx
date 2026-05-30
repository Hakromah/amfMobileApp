import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, Modal, ScrollView, Dimensions
} from 'react-native';
import api from '@/hooks/lib/api';
import { LineChart } from 'react-native-chart-kit';

interface Result {
  id: number;
  marks: number;
  grade?: string;
  className?: string;
  examName?: string;
  term?: string;
  semester?: string;
  classAverage?: number;
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

  const chartData = useMemo(() => {
    // Return early if no results
    if (results.length === 0) return null;
    
    // Sort results chronologically or reverse order so they read left to right
    const sortedResults = [...results].reverse();
    
    return {
      labels: sortedResults.map(r => {
        const name = r.examName || 'Exam';
        return name.length > 8 ? name.substring(0, 6) + '..' : name;
      }),
      datasets: [
        {
          data: sortedResults.map(r => r.marks || 0),
          color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`, // Blue
          strokeWidth: 3,
        },
        {
          data: sortedResults.map(r => r.classAverage || 0),
          color: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`, // Grey
          strokeWidth: 2,
          strokeDashArray: [4, 4],
        }
      ],
      legend: ['My Score', 'Class Avg']
    };
  }, [results]);

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

            {/* Score Trend Chart */}
            {chartData && (
              <View style={s.chartContainer}>
                <Text style={s.chartTitle}>📈 Score Trends vs. Class Average</Text>
                <LineChart
                  data={chartData}
                  width={Dimensions.get('window').width - 32}
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
                  style={s.chart}
                />
              </View>
            )}

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
  chartContainer: { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
  chartTitle: { fontSize: 12, fontWeight: '900', color: '#1e293b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  chart: { borderRadius: 16, marginLeft: -16 },
});

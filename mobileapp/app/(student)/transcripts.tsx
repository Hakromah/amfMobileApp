import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Alert, TouchableOpacity, ScrollView
} from 'react-native';
import api from '@/hooks/lib/api';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

interface TranscriptItem {
  id: number;
  referenceNumber: string;
  issuedDate: string;
  academicYears: string[];
}

export default function StudentTranscriptsScreen() {
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [transcriptData, setTranscriptData] = useState<any | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const fetchTranscripts = async () => {
    try {
      const res = await api.get('/student/transcripts');
      setTranscripts(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      console.error('[Student Transcripts]', e);
      Alert.alert('Error', 'Failed to load transcripts ledger.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTranscriptDetails = async (id: string) => {
    setFetchingDetails(true);
    try {
      const res = await api.get(`/student/transcripts/${id}/preview`);
      setTranscriptData(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to retrieve transcript detail.');
      setSelectedTranscriptId(null);
    } finally {
      setFetchingDetails(false);
    }
  };

  useEffect(() => {
    fetchTranscripts();
  }, []);

  useEffect(() => {
    if (selectedTranscriptId) {
      fetchTranscriptDetails(selectedTranscriptId);
    } else {
      setTranscriptData(null);
    }
  }, [selectedTranscriptId]);

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
      <Text style={s.loadingText}>Verifying Credentials...</Text>
    </View>
  );

  return (
    <View style={s.container}>
      {!selectedTranscriptId ? (
        // List View
        <FlatList
          data={transcripts}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTranscripts(); }} tintColor="#2563eb" />}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>📪</Text>
              <Text style={s.emptyText}>No transcripts issued yet.</Text>
            </View>
          }
          ListHeaderComponent={
            <View style={s.listHeader}>
              <Text style={s.headerTitle}>Issued <Text style={{ color: '#2563eb' }}>Transcripts.</Text></Text>
              <Text style={s.headerSub}>Verify and download official transcripts.</Text>
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
      ) : (
        // Detail View
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
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#94a3b8', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  
  // List
  list: { padding: 16, gap: 12 },
  listHeader: { marginBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#0f172a', fontStyle: 'italic', letterSpacing: -0.5 },
  headerSub: { fontSize: 10, color: '#64748b', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  cardLeft: { flex: 1, gap: 4 },
  refNum: { fontSize: 15, fontWeight: '900', color: '#1e293b', fontStyle: 'italic' },
  issuedDate: { fontSize: 10, color: '#94a3b8', fontWeight: '800' },
  semBadge: { alignSelf: 'flex-start', backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  semBadgeText: { fontSize: 9, fontWeight: '900', color: '#2563eb' },
  viewBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  viewBtnText: { color: '#fff', fontWeight: '900', fontSize: 11 },

  emptyBox: { alignItems: 'center', padding: 40, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#94a3b8', fontSize: 12, fontWeight: '700', fontStyle: 'italic' },

  // Detail
  scrollContainer: { padding: 16, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f1f5f9', borderRadius: 8, marginBottom: 16 },
  backBtnText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  
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
});

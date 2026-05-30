import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput, RefreshControl, Alert,
  Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '@/hooks/lib/api';

interface UserItem {
  id: number;
  name: string;
  username: string;
  email: string;
  schoolRole: string;
  userId?: string;
  gender?: string;
  phoneNumber?: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#f59e0b', TEACHER: '#3b82f6', STUDENT: '#10b981',
};

// Exact field names & gender values matching the frontend form schema
const INITIAL_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'STUDENT' as 'STUDENT' | 'TEACHER' | 'ADMIN',
  birthDate: '',        // YYYY-MM-DD
  birthCountry: '',
  birthCity: '',
  address: '',
  gender: '',           // 'Male' | 'Female' (matches frontend SelectItem values)
  phoneNumber: '',
};

type Form = typeof INITIAL_FORM;

export default function UsersScreen() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<Form>(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [emailDuplicate, setEmailDuplicate] = useState<UserItem | null>(null);

  const checkEmailDuplicate = (email: string) => {
    if (!email.trim()) {
      setEmailDuplicate(null);
      return;
    }
    const match = users.find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
    setEmailDuplicate(match || null);
  };

  // Picker states
  const [genderPickerOpen, setGenderPickerOpen] = useState(false);

  const setField = (key: keyof Form, val: string) => setForm(f => ({ ...f, [key]: val }));

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.map((u: any) => ({
        ...u,
        name: u.name || u.username || 'Unknown',
        schoolRole: u.schoolRole || u.role?.name || 'STUDENT',
      })));
    } catch (e) {
      console.error('[Users]', e);
      Alert.alert('Error', 'Failed to load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      Alert.alert('Validation', 'Legal Name, Email, and Password are required.');
      return;
    }
    setCreating(true);
    try {
      // Send exactly the same payload shape as the web frontend
      const payload: Record<string, string> = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      };
      // Only send optional fields if they have a value (avoids backend validation errors)
      if (form.birthDate.trim()) payload.birthDate = form.birthDate.trim();
      if (form.birthCountry.trim()) payload.birthCountry = form.birthCountry.trim();
      if (form.birthCity.trim()) payload.birthCity = form.birthCity.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.gender) payload.gender = form.gender;
      if (form.phoneNumber.trim()) payload.phoneNumber = form.phoneNumber.trim();

      await api.post('/admin/users', payload);
      Alert.alert('Success', 'User created successfully.');
      setIsFormOpen(false);
      setForm(INITIAL_FORM);
      setEmailDuplicate(null);
      fetchUsers();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message
        || e?.response?.data?.message
        || e?.message
        || 'Internal error. Check all required fields.';
      Alert.alert('Error', msg);
      console.error('[Create User]', e?.response?.status, JSON.stringify(e?.response?.data));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Confirm Delete', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.delete(`/admin/users/${id}`); fetchUsers(); }
          catch { Alert.alert('Error', 'Failed to delete.'); }
        }
      }
    ]);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return ((u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      && (roleFilter === 'ALL' || u.schoolRole === roleFilter);
  });

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  return (
    <View style={s.container}>
      {/* Search + Filter */}
      <View style={s.controls}>
        <TextInput style={s.searchInput} placeholder="Search by name or email..." placeholderTextColor="#94a3b8" value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterList}>
          {['ALL', 'ADMIN', 'TEACHER', 'STUDENT'].map(role => (
            <TouchableOpacity key={role} style={[s.filterChip, roleFilter === role && s.filterChipActive]} onPress={() => setRoleFilter(role)}>
              <Text style={[s.filterText, roleFilter === role && s.filterTextActive]}>{role}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={s.createBtn} onPress={() => { setForm(INITIAL_FORM); setEmailDuplicate(null); setIsFormOpen(true); }}>
          <Text style={s.createBtnText}>＋ New Identity</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} tintColor="#3b82f6" />}
        ListEmptyComponent={<Text style={s.empty}>No users found.</Text>}
        renderItem={({ item }) => {
          const color = ROLE_COLORS[item.schoolRole] || '#64748b';
          return (
            <View style={s.userCard}>
              <View style={[s.avatar, { backgroundColor: color + '22' }]}>
                <Text style={[s.avatarText, { color }]}>{(item.name || 'U').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{item.name}</Text>
                <Text style={s.userEmail}>{item.email}</Text>
                {item.userId && <Text style={s.userId}>ID: {item.userId}</Text>}
              </View>
              <View style={s.userRight}>
                <View style={[s.roleBadge, { backgroundColor: color + '22' }]}>
                  <Text style={[s.roleText, { color }]}>{item.schoolRole}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id, item.name)}>
                  <Text style={s.deleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* ── Create User Modal ── */}
      <Modal visible={isFormOpen} animationType="slide" transparent onRequestClose={() => setIsFormOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20}>
          <View style={s.overlay}>
            <View style={s.modalCard}>
              {/* Blue header like the web */}
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>INITIALIZE NEW IDENTITY</Text>
                <TouchableOpacity onPress={() => { setIsFormOpen(false); setEmailDuplicate(null); }} style={s.closeBtn}>
                  <Text style={s.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={s.modalScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Row 1: Legal Name + Email */}
                <View style={s.row}>
                  <View style={s.halfField}>
                    <Text style={s.label}>LEGAL NAME *</Text>
                    <TextInput style={s.input} placeholder="Full Name" placeholderTextColor="#94a3b8" value={form.name} onChangeText={v => setField('name', v)} autoCapitalize="words" />
                  </View>
                  <View style={s.halfField}>
                    <Text style={s.label}>INSTITUTIONAL EMAIL *</Text>
                    <TextInput 
                      style={[s.input, emailDuplicate && s.inputWarning]} 
                      placeholder="email@amf.edu" 
                      placeholderTextColor="#94a3b8" 
                      value={form.email} 
                      onChangeText={v => {
                        setField('email', v);
                        checkEmailDuplicate(v);
                      }} 
                      keyboardType="email-address" 
                      autoCapitalize="none" 
                    />
                    {emailDuplicate && (
                      <View style={s.warningBox}>
                        <Text style={s.warningText}>⚠️ Already registered to: </Text>
                        <Text style={s.warningSubText}>{emailDuplicate.name} ({emailDuplicate.schoolRole})</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Row 2: Password + Role */}
                <View style={s.row}>
                  <View style={s.halfField}>
                    <Text style={s.label}>ACCESS KEY *</Text>
                    <TextInput style={s.input} placeholder="••••••••" placeholderTextColor="#94a3b8" value={form.password} onChangeText={v => setField('password', v)} secureTextEntry />
                  </View>
                  <View style={s.halfField}>
                    <Text style={s.label}>PERMISSION TIER *</Text>
                    <View style={s.roleRow}>
                      {(['STUDENT', 'TEACHER', 'ADMIN'] as const).map(r => (
                        <TouchableOpacity key={r} style={[s.roleChip, form.role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]} onPress={() => setField('role', r)}>
                          <Text style={[s.roleChipText, form.role === r && { color: '#fff' }]}>{r.charAt(0)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={s.roleSelected}>{form.role}</Text>
                  </View>
                </View>

                {/* Row 3: Date of Birth + Contact Number */}
                <View style={s.row}>
                  <View style={s.halfField}>
                    <Text style={s.label}>DATE OF BIRTH</Text>
                    <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" value={form.birthDate} onChangeText={v => setField('birthDate', v)} keyboardType="numbers-and-punctuation" />
                  </View>
                  <View style={s.halfField}>
                    <Text style={s.label}>CONTACT NUMBER</Text>
                    <TextInput style={s.input} placeholder="+..." placeholderTextColor="#94a3b8" value={form.phoneNumber} onChangeText={v => setField('phoneNumber', v)} keyboardType="phone-pad" />
                  </View>
                </View>

                {/* Row 4: Country + City + Gender */}
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>COUNTRY</Text>
                    <TextInput style={s.input} placeholder="Country" placeholderTextColor="#94a3b8" value={form.birthCountry} onChangeText={v => setField('birthCountry', v)} autoCapitalize="words" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>CITY</Text>
                    <TextInput style={s.input} placeholder="City" placeholderTextColor="#94a3b8" value={form.birthCity} onChangeText={v => setField('birthCity', v)} autoCapitalize="words" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>GENDER</Text>
                    <TouchableOpacity style={s.input} onPress={() => setGenderPickerOpen(true)}>
                      <Text style={form.gender ? s.pickerVal : s.pickerPlaceholder}>{form.gender || 'Gender'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Address — full width */}
                <Text style={s.label}>ADDRESS</Text>
                <TextInput style={s.input} placeholder="Full Residential Address" placeholderTextColor="#94a3b8" value={form.address} onChangeText={v => setField('address', v)} autoCapitalize="sentences" />

                {/* Submit */}
                <TouchableOpacity 
                  style={[s.submitBtn, (creating || emailDuplicate !== null) && s.submitDisabled]} 
                  onPress={handleCreate} 
                  disabled={creating || emailDuplicate !== null}
                >
                  {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>AUTHORIZE STORAGE</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Gender Picker Sheet */}
      <Modal visible={genderPickerOpen} animationType="slide" transparent onRequestClose={() => setGenderPickerOpen(false)}>
        <View style={s.sheetOverlay}>
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle}>Select Gender</Text>
            {/* Values match frontend: 'Male' | 'Female' */}
            {['Male', 'Female'].map(g => (
              <TouchableOpacity key={g} style={[s.sheetItem, form.gender === g && s.sheetItemActive]} onPress={() => { setField('gender', g); setGenderPickerOpen(false); }}>
                <Text style={[s.sheetItemText, form.gender === g && s.sheetItemTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.sheetCancel} onPress={() => setGenderPickerOpen(false)}>
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
  controls: { padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 10 },
  searchInput: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontWeight: '600', color: '#1e293b' },
  filterList: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterText: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  filterTextActive: { color: '#fff' },
  createBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  list: { padding: 14, gap: 10 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  avatar: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900' },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  userEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  userId: { fontSize: 10, color: '#94a3b8', fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  userRight: { alignItems: 'flex-end', gap: 8 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  deleteText: { color: '#ef4444', fontWeight: '900', fontSize: 16, padding: 4 },
  empty: { textAlign: 'center', padding: 40, color: '#94a3b8', fontWeight: '600' },
  // Modal
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 12 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, maxHeight: '95%', overflow: 'hidden' },
  modalHeader: { backgroundColor: '#2563eb', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  closeBtn: { backgroundColor: '#ffffff33', borderRadius: 10, padding: 6 },
  closeBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalScroll: { padding: 20, gap: 0 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  halfField: { flex: 1 },
  label: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5, marginTop: 14 },
  input: { backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, fontWeight: '600', color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', minHeight: 44 },
  pickerVal: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  pickerPlaceholder: { fontSize: 13, color: '#94a3b8' },
  roleRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  roleChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', borderWidth: 1.5, borderColor: '#e2e8f0' },
  roleChipText: { fontSize: 11, fontWeight: '900', color: '#64748b' },
  roleSelected: { fontSize: 10, fontWeight: '700', color: '#3b82f6', marginTop: 4, textAlign: 'center', letterSpacing: 1 },
  submitBtn: { backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 2 },
  warningBox: { backgroundColor: '#fef2f2', borderColor: '#fee2e2', borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 6 },
  warningText: { color: '#ef4444', fontSize: 10, fontWeight: '800' },
  warningSubText: { color: '#ef4444', fontSize: 9, fontWeight: '600', marginTop: 2 },
  inputWarning: { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  // Sheet Picker
  sheetOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 16 },
  sheetItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingHorizontal: 4, borderRadius: 10 },
  sheetItemActive: { backgroundColor: '#eff6ff', paddingHorizontal: 12 },
  sheetItemText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  sheetItemTextActive: { color: '#2563eb', fontWeight: '800' },
  sheetCancel: { marginTop: 12, backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  sheetCancelText: { color: '#64748b', fontWeight: '800' },
});

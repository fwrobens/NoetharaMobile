import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getPreferredModel, noetharaAPI, savePreferredModel, type AIModel } from '../lib/noetharaBackend';

export function ModelPicker({
  visible, onClose, selected, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [source, setSource] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const result = await noetharaAPI.models();
      setModels(result.models);
      setSource(result.catalogSource);
      setNotice(result.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Model catalog unavailable');
    } finally { setLoading(false); }
  };
  useEffect(() => { if (visible) { setQuery(''); void refresh(); } }, [visible]);
  const filtered = useMemo(() =>
    models.filter(m => (m.id + ' ' + m.name + ' ' + m.provider).toLowerCase().includes(query.toLowerCase())),
    [models, query]);
  const choose = async (id: string) => {
    await savePreferredModel(id);
    onSelect(id);
    onClose();
  };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet"
    onRequestClose={onClose}>
    <View style={styles.root}>
      <View style={styles.topbar}>
        <Pressable onPress={onClose} accessibilityLabel="Close model picker"><Feather name="x" size={23} color="#242328" /></Pressable>
        <Text style={styles.title}>Choose AI model</Text>
        <Pressable onPress={refresh} accessibilityLabel="Refresh models"><Feather name="refresh-cw" size={19} color="#7355C7" /></Pressable>
      </View>
      <View style={styles.search}>
        <Feather name="search" size={17} color="#939099"/>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search NVIDIA models…" placeholderTextColor="#A3A0A3"
          style={styles.input} autoCorrect={false} autoCapitalize="none" />
        {query.length > 0 && <Pressable onPress={()=>setQuery('')}><Feather name="x-circle" size={17} color="#939099" /></Pressable>}
      </View>
      <Text style={styles.description}>Beam and NVIDIA chat models. NVIDIA's free development endpoints have account and model-specific limits.</Text>
      {!!source && <Text style={styles.catalog}>Catalog: {source === 'nvidia-live-catalog' ? 'NVIDIA live + verified docs' : 'NVIDIA documented models (live listing unavailable)'}</Text>}
      {loading && <ActivityIndicator style={{ margin: 20 }} color="#7355C7"/>}
      {!!error && <View style={styles.alert}><Text style={styles.error}>{error}</Text>
        <Pressable onPress={refresh}><Text style={styles.retry}>Try again</Text></Press>
      </View>}
      <FlatList data={filtered} keyExtractor={item=>item.provider+':'+item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 19, paddingVertical: 12, paddingBottom: 65 }}
        ListEmptyComponent={!loading && !error ? <Text style={styles.description}>No models match your search.</Text> : null}
        renderItem={({ item }) => {
          const active = item.id === selected;
          return <Pressable style={[styles.modelCard, active && styles.active]} onPress={()=>void choose(item.id)}>
            <View style={[styles.modelGlyph, item.provider==='beam' && { backgroundColor:'#F4EBFF' }]}>
              <Feather name={item.provider==='beam'?'zap':'cpu'} size={21} color="#7758C9"/>
            </View>
            <View style={{flex:1}}>
              <Text numberOfLines={2} style={styles.modelName}>{item.name}</Text>
              <Text numberOfLines={2} style={styles.modelId}>{item.id}</Text>
              <Text style={styles.provider}>{item.provider === 'beam'?'Reflection · Beam':'NVIDIA NIM · access varies'}</Text>
            </View>
            {active && <Feather name="check-circle" size={22} color="#7758C9"/>}
          </Press>;
        }}/>
      {!!notice && <Text style={styles.bottomNote} numberOfLines={2}>Model availability is checked when you send a request.</Text>}
    </View>
  </Modal>;
}
export function useModelPreference() {
  const [model, setModel] = useState('Beam-1.0-501B-A23B');
  useEffect(() => { void getPreferredModel().then(setModel).catch(()=>{}); }, []);
  return { model, setModel };
}
const styles = StyleSheet.create({
  root:{ flex:1, backgroundColor:'#FCFAF7' },
  topbar:{ height:72, paddingHorizontal:24, flexDirection:'row', alignItems:'center',justifyContent:'space-between', gap:13 },
  title:{fontSize:19,fontWeight:'700',color:'#222125'},
  search:{backgroundColor:'#F1EEEB',borderRadius:15,marginHorizontal:19,marginTop:8,paddingHorizontal:15,height:49,flexDirection:'row',alignItems:'center',gap:10},
  input:{flex:1,color:'#252429',fontSize:14},
  description:{color:'#85828A',marginHorizontal:21,marginTop:13,fontSize:12.5,lineHeight:18},
  catalog:{color:'#8A6ACA',fontSize:11,marginHorizontal:21,marginTop:7},
  modelCard:{ flexDirection:'row',alignItems:'center',gap:13,padding:15,backgroundColor:'#FFFFFF',borderRadius:18,
    borderColor:'#EAE7E2',borderWidth:1,marginBottom:9 },
  active:{borderColor:'#B7A4E9',backgroundColor:'#F9F6FF'},
  modelGlyph:{height:42,width:42,backgroundColor:'#F0EDF6',borderRadius:14,alignItems:'center',justifyContent:'center'},
  modelName:{fontWeight:'600',fontSize:15,color:'#252429',textTransform:'capitalize'},
  modelId:{fontSize:11.5,color:'#6D6870',marginTop:3},
  provider:{fontSize:10.5,color:'#988E9B',marginTop:4},
  alert:{margin:20,backgroundColor:'#FFF0ED',padding:15,borderRadius:12},
  error:{color:'#A83B3B',fontSize:13,lineHeight:20},
  retry:{color:'#7355C7',fontWeight:'700',marginTop:9},
  bottomNote:{padding:10,paddingHorizontal:22,fontSize:11.5,color:'#8C8991',backgroundColor:'#FCFAF7'},
});

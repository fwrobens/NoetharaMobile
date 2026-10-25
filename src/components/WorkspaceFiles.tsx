import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { managedWorkspace, type ManagedEntry } from '../lib/managedWorkspace';

const colors={bg:'#FCFAF7',text:'#29282B',muted:'#88858C',purple:'#7654C8',border:'#E8E4DE'};
export function WorkspaceFiles({workspaceId,onBack,onTerminal}:{
  workspaceId:string;onBack:()=>void;onTerminal:()=>void
}){
  const [folder,setFolder]=useState('');
  const [entries,setEntries]=useState<ManagedEntry[]>([]);
  const [active,setActive]=useState<{path:string;content:string;sha256:string}|null>(null);
  const [draft,setDraft]=useState('');
  const [editing,setEditing]=useState(false);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  async function load(directory=folder){
    setError('');setLoading(true);
    try {const result=await managedWorkspace.listFiles(workspaceId,directory);
      setEntries(result.entries.sort((a,b)=>(a.type==='dir'?0:1)-(b.type==='dir'?0:1)||a.name.localeCompare(b.name)));
      setFolder(directory);setActive(null);setEditing(false);
    }catch(e){setError(e instanceof Error?e.message:'Cannot load directory');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load('');},[workspaceId]);
  async function open(file:ManagedEntry){
    if(file.type==='dir'){void load(file.path);return;}
    if(file.type!=='file')return;
    setLoading(true);setError('');
    try{const result=await managedWorkspace.readFile(workspaceId,file.path);
      setActive(result);setDraft(result.content);setEditing(false);
    }catch(e){setError(e instanceof Error?e.message:'Cannot open file');}
    finally{setLoading(false);}
  }
  function back(){
    if(active){setActive(null);setEditing(false);return;}
    if(folder){void load(folder.split('/').slice(0,-1).join('/'));return;}
    onBack();
  }
  function save(){
    if(!active)return;
    Alert.alert('Save file','Save your changes to '+active.path+' in the managed workspace?',[
      {text:'Cancel',style:'cancel'},
      {text:'Save',onPress:()=>void (async()=>{
        setSaving(true);setError('');
        try{await managedWorkspace.saveFile(workspaceId,active.path,draft,active.sha256);
          const updated=await managedWorkspace.readFile(workspaceId,active.path);
          setActive(updated);setDraft(updated.content);setEditing(false);
        }catch(e){setError(e instanceof Error?e.message:'Save failed');}
        finally{setSaving(false);}
      })()}
    ]);
  }
  return <View style={styles.root}>
    <View style={styles.header}>
      <Pressable onPress={back} style={styles.icon} accessibilityLabel="Back"><Feather name="arrow-left" color={colors.text} size={23}/></Pressable>
      <View style={styles.titleArea}><Text style={styles.title} numberOfLines={1}>{active?active.path.split('/').at(-1):workspaceId}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{active?.path||('/home/ubuntu/noethara-workspaces/'+workspaceId+'/'+folder)}</Text>
      </View>
      <Pressable onPress={onTerminal} style={styles.icon} accessibilityLabel="Open terminal for this project"><Feather name="terminal" size={21} color={colors.purple}/></Pressable>
    </View>
    {!!error&&<View style={styles.alert}><Text style={styles.alertText}>{error}</Text></View>}
    {active ? <>
      <View style={styles.fileActions}>
        <Text style={styles.metadata}>{editing?'Editing file':'Read-only preview'}</Text>
        {editing?<Pressable disabled={saving} onPress={save} style={styles.save}><Text style={styles.saveText}>{saving?'Saving…':'Save'}</Text></Pressable>
          :<Pressable onPress={()=>setEditing(true)} style={styles.action}><Feather name="edit-2" color={colors.purple} size={16}/><Text style={styles.actionText}>Edit</Text></Pressable>}
      </View>
      <ScrollView style={styles.fileCard} keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow:1}}>
        <TextInput value={draft} onChangeText={setDraft} editable={editing} multiline
          autoCorrect={false} autoCapitalize="none" scrollEnabled={false}
          style={styles.code} selectionColor={colors.purple}/>
      </ScrollView>
    </>:<>
      <View style={styles.toolbar}><Text style={styles.folderLabel}>{folder?'/'+folder:'Project files'}</Text>
        <Pressable accessibilityLabel="Refresh files" onPress={()=>void load(folder)}><Feather name="refresh-cw" size={18} color={colors.muted}/></Pressable>
      </View>
      {loading?<ActivityIndicator color={colors.purple} style={{marginTop:32}}/>:
      <ScrollView contentContainerStyle={styles.list}>
        {entries.length===0&&<Text style={styles.empty}>No files here yet. Open the terminal to generate project files.</Text>}
        {entries.map(file=><Pressable key={file.path} style={styles.fileRow} onPress={()=>void open(file)}>
          <View style={styles.fileIcon}><Feather name={file.type==='dir'?'folder':'file-text'} size={19} color={file.type==='dir'?colors.purple:colors.muted}/></View>
          <Text numberOfLines={1} style={styles.fileText}>{file.name}</Text>
          <Feather name="chevron-right" size={17} color="#9B979A"/>
        </Pressable>)}
      </ScrollView>}
    </>}
  </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.bg},
 header:{paddingHorizontal:15,height:78,flexDirection:'row',alignItems:'center',gap:10},
 icon:{width:37,height:43,justifyContent:'center',alignItems:'center'},
 titleArea:{flex:1,gap:5,minWidth:0},
 title:{fontSize:20,fontWeight:'700',letterSpacing:-.6,color:colors.text},
 subtitle:{fontSize:11,color:colors.muted},
 alert:{marginHorizontal:20,marginBottom:9,padding:13,borderRadius:12,backgroundColor:'#FFF1ED',borderWidth:1,borderColor:'#F1DED8'},
 alertText:{fontSize:12.5,color:'#AD655A',lineHeight:18},
 toolbar:{paddingHorizontal:23,paddingTop:17,paddingBottom:15,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 folderLabel:{fontSize:15,fontWeight:'600',color:colors.text,flex:1},
 list:{paddingHorizontal:19,paddingBottom:35},
 fileRow:{minHeight:61,flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:13,
  borderBottomWidth:1,borderColor:colors.border},
 fileIcon:{width:32,height:32,alignItems:'center',justifyContent:'center',backgroundColor:'#F4F0F8',borderRadius:10},
 fileText:{fontSize:14,color:colors.text,flex:1},
 empty:{color:colors.muted,textAlign:'center',marginTop:70,fontSize:13,lineHeight:21},
 fileActions:{height:57,flexDirection:'row',alignItems:'center',paddingHorizontal:22,justifyContent:'space-between'},
 metadata:{fontSize:12,color:colors.muted},
 action:{flexDirection:'row',alignItems:'center',gap:8,padding:9},
 actionText:{color:colors.purple,fontSize:13,fontWeight:'600'},
 save:{paddingHorizontal:19,paddingVertical:9,backgroundColor:colors.purple,borderRadius:10},
 saveText:{fontSize:13,fontWeight:'700',color:'#FFFFFF'},
 fileCard:{flex:1,borderWidth:1,borderColor:colors.border,backgroundColor:'#FFFFFF',
  borderRadius:16,marginHorizontal:13,marginBottom:10},
 code:{flex:1,color:'#373338',fontSize:12.5,lineHeight:20,fontFamily:'monospace',
  padding:16,textAlignVertical:'top'},
});

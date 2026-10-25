import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { managedWorkspace, type ManagedWorkspace } from '../lib/managedWorkspace';
const colors={bg:'#FCFAF7',ink:'#29282B',muted:'#8B878D',purple:'#7654C8',border:'#E9E5E0'};
export function WorkspaceDirectoryHub({onBack,onSelect,onNew,onGitHub}:{
 onBack:()=>void;onSelect:(id:string)=>void;onNew:()=>void;onGitHub:()=>void;
}){
 const [projects,setProjects]=useState<ManagedWorkspace[]>([]);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
  setBusy(true);setError('');
  try{setProjects((await managedWorkspace.list()).workspaces);}
  catch(e){setError(e instanceof Error?e.message:'Cannot reach your managed workspace');}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 return <View style={styles.root}>
  <View style={styles.header}>
    <Pressable style={styles.back} accessibilityLabel="Back" onPress={onBack}>
      <Feather name="chevron-left" color={colors.ink} size={25}/>
    </Pressable>
    <View style={{flex:1}}><Text style={styles.title}>Files</Text>
      <Text style={styles.subtitle}>Your persistent Linux workspace</Text></View>
    <Pressable style={styles.add} onPress={onNew} accessibilityLabel="Create workspace">
      <Feather name="plus" color={colors.purple} size={21}/>
    </Pressable>
  </View>
  <ScrollView refreshControl={<RefreshControl refreshing={busy} onRefresh={()=>void refresh()}/>}
    contentContainerStyle={styles.content}>
    <View style={styles.rootRow}>
      <Feather name="hard-drive" color={colors.purple} size={19}/>
      <Text style={styles.rootText}>workspaces/</Text>
      <Text style={styles.count}>{projects.length} projects</Text>
    </View>
    {!!error&&<Pressable onPress={()=>void refresh()} style={styles.notice}>
      <Feather name="alert-circle" color="#AC7764" size={17}/>
      <Text style={styles.noticeText}>{error}</Text>
      <Feather name="refresh-cw" color={colors.muted} size={16}/>
    </Pressable>}
    {projects.map(project=><Pressable key={project.id} onPress={()=>onSelect(project.id)}
      style={styles.entry}>
      <View style={styles.folder}><Feather name="folder" color={colors.purple} size={20}/></View>
      <View style={{flex:1}}><Text style={styles.entryName} numberOfLines={1}>{project.name}</Text>
        <Text style={styles.entryPath} numberOfLines={1}>workspaces/{project.id}/</Text></View>
      <Feather name="chevron-right" color="#A19BA1" size={18}/>
    </Pressable>)}
    {!busy&&projects.length===0&&!error&&<View style={styles.empty}>
      <Feather name="folder-plus" color="#A993CF" size={31}/>
      <Text style={styles.emptyTitle}>Start your first workspace</Text>
      <Text style={styles.emptyBody}>Projects and files created by Noethara will live here, like a file explorer.</Text>
      <Pressable style={styles.emptyButton} onPress={onNew}><Text style={styles.emptyButtonText}>New project</Text></Pressable>
    </View>}
    <Pressable style={styles.github} onPress={onGitHub}>
      <Feather name="github" size={19} color="#8E848E"/>
      <Text style={styles.githubText}>Browse GitHub repositories</Text>
      <Feather name="arrow-up-right" size={16} color="#928C93"/>
    </Pressable>
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.bg},
 header:{height:76,paddingHorizontal:20,flexDirection:'row',alignItems:'center',gap:14},
 back:{height:40,width:30,alignItems:'flex-start',justifyContent:'center'},
 title:{fontSize:22,fontWeight:'700',color:colors.ink,letterSpacing:-.5},
 subtitle:{fontSize:11.5,color:colors.muted,marginTop:3},
 add:{height:37,width:37,alignItems:'center',justifyContent:'center',backgroundColor:'#F3EEF8',borderRadius:12},
 content:{paddingHorizontal:21,paddingTop:22,paddingBottom:60},
 rootRow:{flexDirection:'row',alignItems:'center',gap:10,paddingBottom:17,borderBottomWidth:1,borderColor:colors.border},
 rootText:{fontFamily:'monospace',fontSize:14,fontWeight:'700',color:colors.ink,flex:1},
 count:{fontSize:11,color:colors.muted},
 entry:{minHeight:77,flexDirection:'row',alignItems:'center',gap:13,borderBottomWidth:1,borderColor:colors.border},
 folder:{height:41,width:43,borderRadius:12,backgroundColor:'#F0EAF8',alignItems:'center',justifyContent:'center'},
 entryName:{fontSize:15,fontWeight:'600',color:colors.ink},
 entryPath:{fontSize:11.5,color:colors.muted,marginTop:5},
 notice:{padding:12,backgroundColor:'#FFF2EC',borderRadius:13,flexDirection:'row',gap:9,alignItems:'center',marginTop:14},
 noticeText:{flex:1,fontSize:12,color:'#AD665B',lineHeight:18},
 empty:{marginTop:61,alignItems:'center',gap:13,paddingHorizontal:27},
 emptyTitle:{fontSize:18,fontWeight:'700',color:colors.ink},
 emptyBody:{color:colors.muted,fontSize:13,lineHeight:20,textAlign:'center'},
 emptyButton:{paddingHorizontal:21,paddingVertical:12,backgroundColor:'#242226',borderRadius:13,marginTop:8},
 emptyButtonText:{color:'#FFFFFF',fontSize:13,fontWeight:'700'},
 github:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:20,marginTop:16},
 githubText:{flex:1,fontSize:13,color:'#676169'},
});

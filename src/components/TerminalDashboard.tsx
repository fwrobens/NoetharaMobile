import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getSession, noetharaAPI, type Repo } from '../lib/noetharaBackend';
import { managedWorkspace, type ManagedWorkspace } from '../lib/managedWorkspace';

type Agent='opencode'|'codex'|'claude';
type State='checking'|'awake'|'offline';
const agents: Array<{id:Agent;title:string;description:string;
  symbol:React.ComponentProps<typeof Feather>['name'];color:string}> = [
  {id:'claude',title:'Claude Code',description:'Agent CLI',symbol:'sun',color:'#DA8864'},
  {id:'codex',title:'Codex',description:'Code CLI',symbol:'terminal',color:'#8B91FC'},
  {id:'opencode',title:'OpenCode',description:'Open-source CLI',symbol:'code',color:'#B6A4ED'},
];
const Icon=({name,size=20,color='#242326'}:{
  name:React.ComponentProps<typeof Feather>['name'];size?:number;color?:string;
})=><Feather name={name} size={size} color={color}/>;
const HOST='https://terminal.noethara.cloud';
export function TerminalDashboard({onBack,onAgent,onWorkspace}:{
  onBack:()=>void;onAgent:(agent:Agent,workspaceId?:string)=>void;
  onWorkspace:(id:string)=>void;
}) {
  const [state,setState]=useState<State>('checking');
  const [projects,setProjects]=useState<ManagedWorkspace[]>([]);
  const [createOpen,setCreateOpen]=useState(false);
  const [projectName,setProjectName]=useState('');
  const [repoName,setRepoName]=useState('');
  const [repos,setRepos]=useState<Repo[]>([]);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [cliInstalled,setCliInstalled]=useState<Partial<Record<Agent,boolean>>|null>(null);
  async function refresh(){
    setState('checking');setMessage('');
    try{
      const session=await getSession();
      if(!session?.access_token){setMessage('Sign in to access your Noethara Linux workspace.');setState('offline');return;}
      const abort=new AbortController();
      const timeout=setTimeout(()=>abort.abort(),7000);
      try {
        const r=await fetch(HOST+'/status',{
          headers:{authorization:'Bearer '+session.access_token},
          signal:abort.signal,
        });
        if(r.ok){
          const payload=await r.json() as {cliInstalled?:Partial<Record<Agent,boolean>>};
          setCliInstalled(payload.cliInstalled||null);
          setState('awake');
          try{setProjects((await managedWorkspace.list()).workspaces);}catch{setProjects([]);}
          return;
        }
        setMessage(r.status===401?'Your account is not authorized for this workspace.':
          'The Linux workspace is not available yet.');
      } finally {clearTimeout(timeout);}
    }catch{
      setMessage('The managed Linux server is not reachable yet.');
    }
    setState('offline');
  }
  useEffect(()=>{void refresh();},[]);
  async function showNew(){
    setProjectName('');setRepoName('');setCreateOpen(true);
    try{setRepos((await noetharaAPI.repos()).repos);}catch{setRepos([]);}
  }
  async function create(){
    if(repoName==='__new__'){
      Alert.alert('Create GitHub repository','Create a new private GitHub repository and clone it into your Noethara workspace?',[
        {text:'Cancel',style:'cancel'},
        {text:'Create',onPress:()=>void performCreate()}
      ]);
      return;
    }
    await performCreate();
  }
  async function performCreate(){
    const name=projectName.trim();
    if(!/^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(name)){
      Alert.alert('Invalid name','Use letters, digits, underscores or hyphens (up to 48 characters).');return;
    }
    setSaving(true);
    try{
      const result=repoName==='__new__'?
        await managedWorkspace.createGitHub(name):
        repoName?await managedWorkspace.clone(repoName,name):await managedWorkspace.create(name);
      setCreateOpen(false);await refresh();onWorkspace(result.workspace.id);
    }catch(e){Alert.alert('Workspace not created',e instanceof Error?e.message:'Please try again.');}
    finally{setSaving(false);}
  }
  return <View style={styles.root}>
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityLabel="Back" style={styles.topControl}>
        <Icon name="chevron-down" size={25}/>
      </Pressable>
      <Text style={styles.headerTitle}>Terminals</Text>
      <Pressable onPress={()=>void refresh()} style={[styles.statusPill,state==='awake'&&styles.statusPillAwake]} accessibilityLabel="Refresh Linux workspace status">
        {state==='checking'?<ActivityIndicator size="small" color="#91AF96"/>:
          <View style={[styles.liveDot,{backgroundColor:state==='awake'?'#37CC79':'#8F8E95'}]}/>}
        <Text style={[styles.pillText,{color:state==='awake'?'#207C4D':'#777578'}]}>
          {state==='awake'?'Awake':state==='checking'?'Checking':'Offline'}
        </Text>
      </Pressable>
      <Pressable onPress={()=>void refresh()} style={styles.topControl} accessibilityLabel="Refresh">
        <Icon name="more-horizontal" size={23} color="#6A6768"/>
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Your shortcuts</Text>
        <Pressable onPress={()=>onAgent('opencode')} style={styles.addButton}>
          <Icon name="plus" size={22} color="#666268"/>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
        {agents.map(item=><Pressable key={item.id} style={styles.agentCard} onPress={()=>onAgent(item.id)}>
          <View style={styles.agentTop}>
            <View style={styles.agentBadge}><Icon name={item.symbol} size={22} color={item.color}/></View>
            <Icon name="arrow-up-right" size={17} color="#8C8887"/>
          </View>
          <View>
            <Text style={styles.agentTitle}>{item.title}</Text>
            <Text style={styles.agentMeta}>{cliInstalled?.[item.id]===false?'Install CLI on AWS':item.description}</Text>
          </View>
        </Pressable>)}
      </ScrollView>

      <View style={[styles.sectionHeading,{marginTop:30}]}>
        <Text style={styles.sectionTitle}>Projects</Text>
        <Text style={styles.muted}>Managed Linux</Text>
      </View>
      {projects.length===0&&<Pressable style={styles.projectCard} onPress={()=>onAgent('opencode')}>
        <View style={styles.projectIcon}><Icon name="folder" size={23} color="#767377"/></View>
        <View style={styles.projectDetails}>
          <Text style={styles.projectTitle}>Noethara workspace</Text>
          <Text style={styles.projectPath}>Your persistent Linux environment</Text>
          <Text style={styles.projectSub}>{state==='awake'?'Server connected · Open a CLI session':'Awaiting secure server connection'}</Text>
        </View>
        <Icon name="chevron-right" size={23} color="#8B8888"/>
      </Pressable>}
      {projects.map(project=><Pressable key={project.id} style={[styles.projectCard,{marginBottom:10}]}
        onPress={()=>onWorkspace(project.id)}>
        <View style={styles.projectIcon}><Icon name="folder" size={23} color="#767377"/></View>
        <View style={styles.projectDetails}>
          <Text numberOfLines={1} style={styles.projectTitle}>{project.name}</Text>
          <Text numberOfLines={1} style={styles.projectPath}>{project.path}</Text>
          <Text style={styles.projectSub}>Persistent Linux project · View files</Text>
        </View>
        <Pressable onPress={event=>{event.stopPropagation();onAgent('opencode',project.id);}} accessibilityLabel={'Open CLI in '+project.name}
          style={styles.topControl}><Icon name="terminal" size={21} color="#7654C8"/></Pressable>
      </Pressable>)}

      <View style={[styles.sectionHeading,{marginTop:34}]}>
        <Text style={styles.sectionTitle}>Recent projects</Text>
      </View>
      <View style={styles.recentEmpty}>
        <Icon name="layers" size={21} color="#817F80"/>
        <Text style={styles.recentText}>Select a project to browse its files, or create one using New.</Text>
      </View>
      {state==='offline'&&!!message&&
        <Pressable onPress={()=>void refresh()} style={styles.notice}>
          <Icon name="alert-circle" size={17} color="#9175C5"/>
          <Text style={styles.noticeText}>{message}</Text>
          <Icon name="refresh-cw" size={16} color="#BAA5D9"/>
        </Pressable>}
    </ScrollView>
    <Pressable style={styles.newButton} onPress={()=>void showNew()}>
      <Icon name="plus" size={25} color="#FFFFFF"/>
      <Text style={styles.newText}>New</Text>
    </Pressable>
    <Modal visible={createOpen} transparent animationType="slide" onRequestClose={()=>setCreateOpen(false)}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>New workspace</Text>
            <Pressable onPress={()=>setCreateOpen(false)}><Icon name="x" size={21}/></Pressable>
          </View>
          <Text style={styles.fieldLabel}>Project name</Text>
          <TextInput value={projectName} onChangeText={setProjectName} autoCapitalize="none" autoCorrect={false}
            placeholder="my-new-project" placeholderTextColor="#9C999E" style={styles.field}/>
          <Text style={styles.fieldLabel}>GitHub repository (optional)</Text>
          <ScrollView style={styles.repoScroll} keyboardShouldPersistTaps="handled">
            <Pressable style={styles.repoOption} onPress={()=>setRepoName('')}>
              <Icon name="folder-plus" size={17} color="#7654C8"/>
              <Text style={styles.repoText}>Start blank workspace</Text>
              {!repoName&&<Icon name="check" size={17} color="#7654C8"/>}
            </Pressable>
            <Pressable style={styles.repoOption} onPress={()=>setRepoName('__new__')}>
              <Icon name="github" size={17} color="#7654C8"/>
              <Text style={styles.repoText}>Create a private GitHub repository</Text>
              {repoName==='__new__'&&<Icon name="check" size={17} color="#7654C8"/>}
            </Pressable>
            {repos.map(repo=><Pressable key={repo.full_name} style={styles.repoOption}
              onPress={()=>{setRepoName(repo.full_name);
                if(!projectName)setProjectName(repo.full_name.split('/')[1].replace(/[^A-Za-z0-9_-]/g,'_').replace(/^[^A-Za-z]+/,'project'));}}>
              <Icon name={repo.private?'lock':'github'} size={17} color="#81778C"/>
              <Text numberOfLines={1} style={styles.repoText}>{repo.full_name}</Text>
              {repoName===repo.full_name&&<Icon name="check" size={17} color="#7654C8"/>}
            </Pressable>)}
            {!repos.length&&<Text style={[styles.muted,{paddingVertical:16}]}>Connect GitHub in Settings to import private repositories.</Text>}
          </ScrollView>
          <Pressable style={[styles.createButton,saving&&{opacity:.65}]} disabled={saving} onPress={()=>void create()}>
            {saving?<ActivityIndicator color="#FFFFFF"/>:<Text style={styles.createText}>{repoName==='__new__'?'Create private GitHub repo':repoName?'Clone project':'Create workspace'}</Text>}
          </Pressable>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#FCFAF7'},
  modalOverlay:{flex:1,backgroundColor:'rgba(21,18,27,0.35)',justifyContent:'flex-end'},
  modalSheet:{borderTopLeftRadius:26,borderTopRightRadius:26,backgroundColor:'#FCFAF7',
    paddingHorizontal:22,paddingTop:22,paddingBottom:38,maxHeight:'85%'},
  sheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:22},
  sheetTitle:{fontSize:21,fontWeight:'700',color:'#29282B'},
  fieldLabel:{fontSize:12.5,color:'#757178',fontWeight:'600',marginBottom:8},
  field:{height:48,borderWidth:1,borderColor:'#E8E4DE',backgroundColor:'#FFFFFF',
    borderRadius:13,paddingHorizontal:14,fontSize:14,color:'#29282B',marginBottom:21},
  repoScroll:{maxHeight:240,marginBottom:20},
  repoOption:{minHeight:49,flexDirection:'row',gap:10,alignItems:'center',paddingHorizontal:10,
    borderBottomWidth:1,borderBottomColor:'#E9E5E0'},
  repoText:{flex:1,color:'#29282B',fontSize:13},
  createButton:{height:51,backgroundColor:'#242426',borderRadius:14,alignItems:'center',justifyContent:'center'},
  createText:{color:'#FFFFFF',fontWeight:'700',fontSize:15},
  header:{height:80,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:12},
  topControl:{height:43,width:39,justifyContent:'center',alignItems:'center'},
  headerTitle:{color:'#242326',fontWeight:'700',fontSize:25,letterSpacing:-0.8,flex:1},
  statusPill:{height:36,flexDirection:'row',gap:9,alignItems:'center',
    borderRadius:23,backgroundColor:'#F0EEEB',borderWidth:1,borderColor:'#E7E4DE',paddingHorizontal:14},
  statusPillAwake:{backgroundColor:'#E5F5EA',borderColor:'#D5ECDC'},
  liveDot:{height:9,width:9,borderRadius:9},
  pillText:{fontSize:13,fontWeight:'700'},
  content:{paddingTop:49,paddingBottom:150},
  sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    paddingHorizontal:22,marginBottom:18},
  sectionTitle:{fontSize:18.5,color:'#29282A',fontWeight:'700',letterSpacing:-0.4},
  addButton:{height:31,width:31,alignItems:'center',justifyContent:'center'},
  shortcuts:{gap:11,paddingHorizontal:22,paddingRight:26},
  agentCard:{height:157,width:152,padding:15,borderRadius:18,
    backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#EAE7E2',
    justifyContent:'space-between',shadowColor:'#6D6459',shadowOpacity:0.06,
    shadowOffset:{width:0,height:5},shadowRadius:14,elevation:2},
  agentTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
  agentBadge:{width:39,height:39,backgroundColor:'#F6F2F8',borderRadius:12,
    alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#ECE7F1'},
  agentTitle:{color:'#292729',fontSize:16,fontWeight:'700',letterSpacing:-0.5},
  agentMeta:{color:'#88868B',fontSize:11.5,marginTop:7},
  muted:{color:'#88868B',fontSize:12},
  projectCard:{marginHorizontal:22,padding:17,borderWidth:1,borderColor:'#E8E5DF',
    backgroundColor:'#F6F4F1',borderRadius:18,flexDirection:'row',alignItems:'center',gap:13},
  projectIcon:{width:43,height:43,alignItems:'center',justifyContent:'center'},
  projectDetails:{flex:1,gap:5},
  projectTitle:{color:'#29282B',fontWeight:'700',fontSize:16},
  projectPath:{color:'#858287',fontSize:12},
  projectSub:{color:'#68656A',fontSize:11,marginTop:2},
  recentEmpty:{flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:28,paddingTop:14},
  recentText:{color:'#858286',fontSize:12.5,lineHeight:20,flex:1},
  notice:{marginHorizontal:22,marginTop:30,padding:15,borderRadius:14,
    borderWidth:1,borderColor:'#E6DFEE',backgroundColor:'#F7F2FB',
    flexDirection:'row',alignItems:'center',gap:11},
  noticeText:{color:'#726082',fontSize:12,lineHeight:18,flex:1},
  newButton:{position:'absolute',right:23,bottom:26,height:58,borderRadius:25,
    paddingHorizontal:23,backgroundColor:'#242426',flexDirection:'row',
    alignItems:'center',justifyContent:'center',gap:12,
    shadowColor:'#454044',shadowOpacity:0.15,
    shadowOffset:{width:0,height:5},shadowRadius:12,elevation:4},
  newText:{fontSize:17,fontWeight:'700',color:'#FFFFFF'},
});

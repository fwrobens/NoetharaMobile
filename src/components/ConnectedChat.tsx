import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Markdown from 'react-native-markdown-display';
import {
  noetharaAPI, persistChat, getSession, loadConversation, type ChatEntry, type GithubProposedEdit,
} from '../lib/noetharaBackend';
import type { SelectedGitHubFile } from './NoetharaIntegrations';
import { ModelPicker, useModelPreference } from './ModelPicker';
import { readProjectContext, type SelectedProject } from '../lib/githubRepoContext';

const INK='#262429', MUTED='#88858C', PURPLE='#7355C7';
const Icon = (name:React.ComponentProps<typeof Feather>['name'],size=20,color=INK) =>
  <Feather name={name} size={size} color={color}/>;

const mdStyle = StyleSheet.create({
  body:{fontSize:15.5,lineHeight:25,color:INK},
  paragraph:{marginTop:0,marginBottom:13,color:INK,lineHeight:25},
  heading1:{fontSize:23,fontWeight:'700',color:INK,marginTop:13,marginBottom:12},
  heading2:{fontSize:19,fontWeight:'700',color:INK,marginTop:13,marginBottom:9},
  heading3:{fontSize:16.5,fontWeight:'700',color:INK,marginTop:12,marginBottom:8},
  strong:{fontWeight:'700',color:INK},
  em:{fontStyle:'italic'},
  bullet_list:{marginTop:3,marginBottom:13},
  ordered_list:{marginTop:3,marginBottom:13},
  list_item:{marginTop:3,marginBottom:5},
  bullet_list_icon:{color:PURPLE},
  code_inline:{color:'#6F4EAE',backgroundColor:'#F0ECEB',borderRadius:5,fontFamily:'monospace',paddingHorizontal:4,fontSize:13},
  code_block:{color:'#E5E0EA',backgroundColor:'#25232A',borderRadius:13,padding:15,fontSize:12.5,lineHeight:20,fontFamily:'monospace',marginVertical:9},
  fence:{color:'#E5E0EA',backgroundColor:'#25232A',borderRadius:13,padding:15,fontSize:12.5,lineHeight:20,fontFamily:'monospace',marginVertical:9},
  blockquote:{borderLeftWidth:3,borderLeftColor:'#A28ADD',paddingLeft:12,backgroundColor:'#F5F1F8',paddingVertical:8,marginVertical:9},
  link:{color:PURPLE,textDecorationLine:'underline'},
  hr:{backgroundColor:'#E7E2DF',height:1,marginVertical:17},
});

export function ConnectedChat({
  onMenu,onSettings,onFiles,latest,initialModel,attachedFile,attachedProject,onRemoveFile,onRemoveProject,
  conversationId,onChatSaved,
}:{
  onMenu:()=>void;onSettings:()=>void;onFiles:()=>void;latest:string;initialModel?:string;
  attachedFile:SelectedGitHubFile|null;onRemoveFile:()=>void;
  attachedProject:SelectedProject|null;onRemoveProject:()=>void;
  conversationId?:string|null;onChatSaved?:(id:string)=>void;
}) {
  const [messages,setMessages]=useState<ChatEntry[]>(latest?[{role:'user',content:latest}]:[]);
  const [prompt,setPrompt]=useState('');
  const [thinking,setThinking]=useState(false);
  const [pendingEdits,setPendingEdits]=useState<GithubProposedEdit[]>([]);
  const [reviewEdit,setReviewEdit]=useState<GithubProposedEdit|null>(null);
  const [savingEdit,setSavingEdit]=useState(false);
  const [status,setStatus]=useState('');
  const [isError,setIsError]=useState(false);
  const [loadingHistory,setLoadingHistory]=useState(Boolean(conversationId));
  const {model,setModel}=useModelPreference();
  const [modelPickerOpen,setModelPickerOpen]=useState(false);
  const [chatId,setChatId]=useState<string|null>(conversationId??null);
  const scrollRef=useRef<React.ElementRef<typeof ScrollView>>(null);
  const didStart=useRef(false);
  const mounted=useRef(true);
  // A newly saved chat id is not a user selection from the history drawer.
  const createdChatId=useRef<string|null>(null);
  useEffect(()=>{
    mounted.current=true;
    // A specific conversation is authoritative; never show a previous thread
    // while loading a selected conversation from Supabase.
    if(conversationId && createdChatId.current !== conversationId){
      setLoadingHistory(true);
      setMessages([]);
      setStatus('');
      setChatId(conversationId);
      void loadConversation(conversationId)
        .then(history=>{if(mounted.current){setMessages(history);setLoadingHistory(false);}})
        .catch(err=>{if(mounted.current){
          setLoadingHistory(false);
          output(err instanceof Error?err.message:'Could not load conversation',true);
        }});
    }else if(latest.trim() && !didStart.current){
      didStart.current=true;
      void sendInitial(latest);
    }
    return ()=>{mounted.current=false;};
  },[conversationId]);

  const output=(message:string,error:boolean)=>{
    if(mounted.current){setStatus(message);setIsError(error);}
  };
  async function buildRequest(next:ChatEntry[], instruction:string, modelId:string) {
    let contextWarning='';
    if(attachedProject){
      try{
        const result=await noetharaAPI.agent(next,attachedProject,modelId);
        return {result,contextWarning,edits:result.edits||[]};
      }catch(e){
        // Older provider endpoints may lack tool calling; preserve normal chat.
        contextWarning='Project tools unavailable; falling back to read-only GitHub context. ';
      }
    }
    let history=next.slice(-18);
    if(attachedProject){
      try {
        const project=await readProjectContext(attachedProject,instruction);
        history=[{role:'user',content:project.text.slice(0,13000)},...history];
      } catch(e){
        // GitHub authorization/network trouble must not disable normal LLM chat.
        contextWarning='GitHub project context unavailable; response may not reflect repository files. ';
        history=[{role:'user',content:'An attached GitHub project could not be read. Do not pretend you inspected its files. Explain any limitation if the user requests repository-specific information.'},...history];
      }
    }
    let result:Awaited<ReturnType<typeof noetharaAPI.chat>>;
    try {
      result=await noetharaAPI.chat(history,attachedFile??undefined,modelId);
    }catch(e){
      const reason=e instanceof Error?e.message:'';
      if(!attachedFile || !/github|repository|reconnect|file.*access|authorization|permission/i.test(reason))throw e;
      // Don't let a revoked GitHub file permission break unrelated AI chat.
      const safe=[{role:'user' as const,content:'An attached GitHub file was inaccessible. Do not claim to have read its contents.'},...history];
      result=await noetharaAPI.chat(safe,undefined,modelId);
      contextWarning+='GitHub file could not be loaded; response is not based on that file. ';
    }
    return {result,contextWarning,edits:[] as GithubProposedEdit[]};
  }
  async function saveMessage(id:string|null,entry:ChatEntry):Promise<string|null>{
    try{
      const nextId=await persistChat(id,[entry]);
      if(!id)createdChatId.current=nextId;
      if(mounted.current){setChatId(nextId);onChatSaved?.(nextId);}
      return nextId;
    }catch(e){
      output('Chat history could not be saved: '+(e instanceof Error?e.message:'Unknown error'),true);
      return id;
    }
  }
  async function sendInitial(first:string){
    const next:ChatEntry[]=[{role:'user',content:first}];
    setThinking(true);output('',false);
    const id=await saveMessage(null,next[0]);
    try{
      const session=await getSession();
      if(!session)throw Error('Sign in before sending prompts.');
      const {result,contextWarning,edits}=await buildRequest(next,first,initialModel||model);
      if(mounted.current)setPendingEdits(edits);
      if(!mounted.current)return;
      const answer:ChatEntry={role:'assistant',content:result.answer};
      setMessages([...next,answer]);
      if(id)await saveMessage(id,answer);
      output(contextWarning+result.provider+' · '+result.model+(result.fallbackUsed?' · fallback':''),false);
    }catch(err){
      output(err instanceof Error?err.message:'Unable to contact AI provider.',true);
    }finally{if(mounted.current)setThinking(false);}
  }
  async function submit(){
    const text=prompt.trim();
    if(!text||thinking||loadingHistory)return;
    const userEntry:ChatEntry={role:'user',content:text};
    const next:ChatEntry[]=[...messages,userEntry];
    setMessages(next);setPrompt('');Keyboard.dismiss();setThinking(true);output('',false);
    const id=await saveMessage(chatId,userEntry);
    try{
      const {result,contextWarning,edits}=await buildRequest(next,text,model);
      if(mounted.current)setPendingEdits(edits);
      if(!mounted.current)return;
      const answer:ChatEntry={role:'assistant',content:result.answer};
      setMessages(prev=>[...prev,answer]);
      if(id)await saveMessage(id,answer);
      output(contextWarning+result.provider+' · '+result.model+(result.fallbackUsed?' · fallback':''),false);
    }catch(err){
      output(err instanceof Error?err.message:'Unable to contact AI provider.',true);
    }finally{if(mounted.current)setThinking(false);}
  }
  function approve(edit:GithubProposedEdit){
    Alert.alert('Commit to GitHub','This will update '+edit.repo+'/'+edit.path+' on '+edit.branch+'. Review the complete replacement before proceeding.',[
      {text:'Cancel',style:'cancel'},
      {text:'Commit update',onPress:()=>void (async()=>{
        setSavingEdit(true);
        try{
          const result=await noetharaAPI.applyEdit(edit,'Update '+edit.path+' via Noethara');
          setPendingEdits(current=>current.filter(item=>item!==edit));
          setReviewEdit(null);
          const note='Committed '+edit.path+' to '+edit.repo+' ('+(result.commit?.slice(0,8)||'updated')+').';
          output(note,false);
        }catch(e){Alert.alert('GitHub commit failed',e instanceof Error?e.message:'Please try again.');}
        finally{setSavingEdit(false);}
      })()}
    ]);
  }
  return <View style={styles.root}>
    <View style={styles.header}>
      <Pressable onPress={onMenu} style={styles.headerButton} accessibilityLabel="Open navigation">{Icon('menu',26)}</Pressable>
      <View style={styles.headerCenter}><View style={styles.connectedDot}/><Text style={styles.headerTitle}>Code</Text></View>
      <Pressable onPress={onSettings} style={styles.headerButton} accessibilityLabel="Settings">{Icon('settings',21)}</Pressable>
    </View>
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chatContent}
      onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:true})}>
      {loadingHistory&&<View style={{alignItems:'center',paddingVertical:40,gap:12}}><ActivityIndicator color={PURPLE}/><Text style={{color:MUTED}}>Loading conversation…</Text></View>}
      {!loadingHistory&&!messages.length&&<View style={styles.empty}>
        <View style={styles.emptyIcon}>{Icon('terminal',34,PURPLE)}</View>
        <Text style={styles.emptyTitle}>What are we building?</Text>
        <Text style={styles.emptyDescription}>A quieter space to think, write code and review projects with Beam or NVIDIA.</Text>
      </View>}
      {messages.map((message,i)=>message.role==='user'
        ? <View key={i} style={styles.userRow}><View style={styles.userBubble}>
            <Text selectable style={styles.userText}>{message.content}</Text>
          </View></View>
        : <View key={i} style={styles.assistantRow}>
            <Markdown style={mdStyle}>{message.content}</Markdown>
          </View>)}
      {thinking&&<View style={styles.thinking}>
        <ActivityIndicator color={PURPLE} size="small"/>
        <Text style={styles.thinkingText}>Thinking…</Text>
      </View>}
      {pendingEdits.map((edit,i)=><Pressable key={edit.path+'-'+i}
        onPress={()=>setReviewEdit(edit)} style={styles.proposalCard}>
        {Icon('file-plus',18,PURPLE)}
        <View style={{flex:1}}><Text style={styles.proposalTitle} numberOfLines={1}>Review proposed edit</Text>
        <Text style={styles.proposalPath} numberOfLines={1}>{edit.path}</Text></View>
        {Icon('chevron-right',17,MUTED)}
      </Pressable>)}
      {!!status&&<Text style={[styles.status,isError&&styles.error]}>{status}</Text>}
    </ScrollView>
    <View style={styles.composerDock}>
      {attachedProject&&<View style={styles.fileBadge}>
        {Icon('github',16,PURPLE)}
        <Text style={styles.fileLabel} numberOfLines={1}>{attachedProject.repo} · project context</Text>
        <Pressable onPress={onRemoveProject} accessibilityLabel="Remove project context">{Icon('x',17,MUTED)}</Pressable>
      </View>}
      {attachedFile&&<View style={styles.fileBadge}>
        {Icon('file-text',16,PURPLE)}<Text style={styles.fileLabel} numberOfLines={1}>{attachedFile.repo} / {attachedFile.path}</Text>
        <Pressable onPress={onRemoveFile} accessibilityLabel="Remove file">{Icon('x',17,MUTED)}</Pressable>
      </View>}
      <Pressable onPress={onFiles} style={styles.projectPicker}>
        {Icon('folder',17,MUTED)}
        <Text style={styles.projectName} numberOfLines={1}>{attachedProject?attachedProject.repo:attachedFile?attachedFile.repo:'Choose GitHub project'}</Text>
        {Icon('chevron-down',16,MUTED)}
      </Pressable>
      <LinearGradient colors={['#FFFFFF','#F8F6F2']} style={styles.composer}>
        <TextInput value={prompt} onChangeText={setPrompt} multiline maxLength={14000}
          placeholder="Message your coding assistant…" placeholderTextColor="#A4A0A7"
          style={styles.input} textAlignVertical="top"/>
        <View style={styles.actions}>
          <Pressable onPress={onFiles} accessibilityLabel="Attach GitHub file">{Icon('plus-circle',24,MUTED)}</Pressable>
          <Pressable onPress={()=>setModelPickerOpen(true)} style={styles.modelPicker}>
            <Text numberOfLines={1} style={styles.modelLabel}>{model.includes('/')?model.split('/')[1]:model}</Text>
            {Icon('chevron-down',15,PURPLE)}
          </Pressable>
          <Pressable onPress={onSettings} accessibilityLabel="Permissions">{Icon('shield',20,MUTED)}</Pressable>
          <Pressable onPress={()=>Alert.alert('Voice','Use the iPhone keyboard dictation microphone.')}>{Icon('mic',20,MUTED)}</Pressable>
          <Pressable onPress={()=>void submit()} disabled={!prompt.trim()||thinking} accessibilityLabel="Send"
            style={[styles.send,(!prompt.trim()||thinking)&&{opacity:0.62}]}>{Icon('arrow-up',21,'#fff')}</Pressable>
        </View>
      </LinearGradient>
    </View>
    <Modal visible={Boolean(reviewEdit)} animationType="slide" transparent onRequestClose={()=>setReviewEdit(null)}>
      <View style={styles.modalOverlay}>
        <View style={styles.reviewSheet}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewTitle}>Review file change</Text>
            <Pressable onPress={()=>setReviewEdit(null)} accessibilityLabel="Close review">{Icon('x',22)}</Pressable>
          </View>
          <Text style={styles.reviewPath} numberOfLines={2}>{reviewEdit?.repo} / {reviewEdit?.path}</Text>
          {!!reviewEdit?.description&&<Text style={styles.reviewDescription}>{reviewEdit.description}</Text>}
          <ScrollView style={styles.reviewSource}>
            <Text selectable style={styles.reviewCode}>{reviewEdit?.content}</Text>
          </ScrollView>
          <Text style={styles.reviewNotice}>This is a complete file replacement, not an automatic edit. The existing GitHub file is checked for changes before committing.</Text>
          <Pressable disabled={savingEdit} onPress={()=>reviewEdit&&approve(reviewEdit)} style={[styles.reviewCommit,savingEdit&&{opacity:.6}]}>
            {savingEdit?<ActivityIndicator color="#FFFFFF"/>:<Text style={styles.reviewCommitText}>Approve & commit</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
    <ModelPicker visible={modelPickerOpen} selected={model} onSelect={setModel} onClose={()=>setModelPickerOpen(false)}/>
  </View>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#FCFAF7'},
  proposalCard:{marginTop:11,padding:14,backgroundColor:'#F5F1FB',borderRadius:14,
    flexDirection:'row',gap:11,alignItems:'center',borderWidth:1,borderColor:'#E9E1F0'},
  proposalTitle:{fontSize:13,fontWeight:'700',color:INK},
  proposalPath:{fontSize:11.5,color:MUTED,marginTop:4},
  modalOverlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(24,20,28,.35)'},
  reviewSheet:{backgroundColor:'#FCFAF7',borderTopLeftRadius:25,borderTopRightRadius:25,
    padding:22,paddingBottom:37,maxHeight:'88%'},
  reviewHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  reviewTitle:{fontSize:19,fontWeight:'700',color:INK},
  reviewPath:{fontSize:12.5,color:PURPLE,marginTop:14},
  reviewDescription:{fontSize:12.5,color:MUTED,marginTop:9,lineHeight:18},
  reviewSource:{maxHeight:360,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E9E4E0',
    borderRadius:14,marginVertical:17,padding:12},
  reviewCode:{fontSize:11.5,lineHeight:17,color:'#39353A',fontFamily:'monospace'},
  reviewNotice:{fontSize:11,color:MUTED,lineHeight:17,marginBottom:14},
  reviewCommit:{height:50,backgroundColor:'#262329',borderRadius:14,
    justifyContent:'center',alignItems:'center'},
  reviewCommitText:{color:'#FFFFFF',fontWeight:'700',fontSize:14},
  header:{height:70,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  headerButton:{padding:8},headerCenter:{flexDirection:'row',gap:9,alignItems:'center'},
  connectedDot:{width:10,height:10,borderRadius:10,backgroundColor:'#27C565'},
  headerTitle:{fontSize:20,fontWeight:'600',color:INK},
  chatContent:{flexGrow:1,paddingHorizontal:20,paddingVertical:18,paddingBottom:45},
  empty:{alignItems:'center',justifyContent:'center',flexGrow:1,paddingHorizontal:18},
  emptyIcon:{width:78,height:78,borderRadius:25,backgroundColor:'#F1EDF8',alignItems:'center',justifyContent:'center',marginBottom:23},
  emptyTitle:{fontSize:23,fontWeight:'700',color:INK,letterSpacing:-0.6},
  emptyDescription:{textAlign:'center',fontSize:14,lineHeight:22,color:MUTED,marginTop:13},
  userRow:{alignItems:'flex-end',marginBottom:25,marginTop:7},
  userBubble:{maxWidth:'88%',backgroundColor:'#EEEDEA',borderRadius:19,paddingHorizontal:17,paddingVertical:13},
  userText:{color:INK,fontSize:15.5,lineHeight:23},
  assistantRow:{width:'100%',marginBottom:15,paddingHorizontal:1},
  thinking:{flexDirection:'row',alignItems:'center',gap:11,marginTop:7,marginBottom:16},
  thinkingText:{fontSize:13,color:MUTED},
  status:{fontSize:11.5,color:'#8F8993',marginVertical:12},
  error:{color:'#B85050'},
  composerDock:{paddingHorizontal:16,paddingTop:7,paddingBottom:10,gap:9},
  fileBadge:{backgroundColor:'#F2ECF9',borderRadius:12,paddingHorizontal:10,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:7},
  fileLabel:{fontSize:12,color:PURPLE,flex:1},
  projectPicker:{alignSelf:'flex-start',paddingHorizontal:12,paddingVertical:9,borderRadius:24,borderWidth:1,borderColor:'#E6E4E1',backgroundColor:'#FFFFFF',
    maxWidth:'100%',flexDirection:'row',gap:9,alignItems:'center'},
  projectName:{fontSize:13,color:INK,maxWidth:245},
  composer:{borderRadius:24,padding:14,borderWidth:1,borderColor:'#FFFFFF',shadowColor:'#847D7E',shadowOpacity:0.08,
    shadowOffset:{width:0,height:7},shadowRadius:21},
  input:{fontSize:15,color:INK,minHeight:46,maxHeight:125,paddingTop:3,paddingBottom:8},
  actions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},
  modelPicker:{flexDirection:'row',gap:7,paddingHorizontal:10,paddingVertical:8,borderRadius:21,
    borderWidth:1,borderColor:'#E8E1EF',alignItems:'center',flexShrink:1},
  modelLabel:{color:PURPLE,fontSize:12.5,maxWidth:145},
  send:{width:39,height:39,borderRadius:20,backgroundColor:'#232126',alignItems:'center',justifyContent:'center'},
});

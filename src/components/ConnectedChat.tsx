import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Markdown from 'react-native-markdown-display';
import {
  noetharaAPI, persistChat, getSession, loadConversation, type ChatEntry,
} from '../lib/noetharaBackend';
import type { SelectedGitHubFile } from './NoetharaIntegrations';
import { ModelPicker, useModelPreference } from './ModelPicker';

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
  onMenu,onSettings,onFiles,latest,initialModel,attachedFile,onRemoveFile,
  conversationId,onChatSaved,
}:{
  onMenu:()=>void;onSettings:()=>void;onFiles:()=>void;latest:string;initialModel?:string;
  attachedFile:SelectedGitHubFile|null;onRemoveFile:()=>void;
  conversationId?:string|null;onChatSaved?:(id:string)=>void;
}) {
  const [messages,setMessages]=useState<ChatEntry[]>(latest?[{role:'user',content:latest}]:[]);
  const [prompt,setPrompt]=useState('');
  const [thinking,setThinking]=useState(false);
  const [status,setStatus]=useState('');
  const [isError,setIsError]=useState(false);
  const {model,setModel}=useModelPreference();
  const [modelPickerOpen,setModelPickerOpen]=useState(false);
  const [chatId,setChatId]=useState<string|null>(conversationId??null);
  const scrollRef=useRef<ScrollView>(null);
  const didStart=useRef(false);
  useEffect(()=>{
    if(didStart.current)return;
    didStart.current=true;
    if(conversationId) {
      void loadConversation(conversationId)
        .then(setMessages)
        .catch(err=>{setIsError(true);setStatus(err instanceof Error?err.message:'Could not load history');});
    } else if(latest.trim()) {
      void sendInitial(latest);
    }
  },[]);
  const output = (message:string, error:boolean) => {setStatus(message);setIsError(error);};
  async function sendInitial(first:string) {
    const next:ChatEntry[]=[{role:'user',content:first}];
    setThinking(true);output('',false);
    try {
      const session=await getSession();
      if(!session)throw Error('Sign in before sending prompts.');
      const id=await persistChat(null,next);
      setChatId(id);onChatSaved?.(id);
      const result=await noetharaAPI.chat(next,attachedFile??undefined,initialModel||model);
      const answer:ChatEntry={role:'assistant',content:result.answer};
      setMessages([...next,answer]);
      await persistChat(id,[answer]);
      onChatSaved?.(id);
      output((result.provider+' · '+result.model+(result.fallbackUsed?' · fallback':'')),false);
    }catch(err){output(err instanceof Error?err.message:'Request failed',true);}
    finally{setThinking(false);}
  }
  async function submit() {
    const text=prompt.trim();
    if(!text||thinking)return;
    const next:ChatEntry[]=[...messages,{role:'user',content:text}];
    setMessages(next);setPrompt('');Keyboard.dismiss();setThinking(true);output('',false);
    try {
      const id=await persistChat(chatId,[{role:'user',content:text}]);
      setChatId(id);onChatSaved?.(id);
      const result=await noetharaAPI.chat(next.slice(-20),attachedFile??undefined,model);
      const answer:ChatEntry={role:'assistant',content:result.answer};
      setMessages(prev=>[...prev,answer]);
      await persistChat(id,[answer]);
      onChatSaved?.(id);
      output(result.provider+' · '+result.model+(result.fallbackUsed?' · fallback':''),false);
    } catch(err) {
      output(err instanceof Error?err.message:'Unable to contact AI provider.',true);
    } finally {setThinking(false);}
  }
  return <View style={styles.root}>
    <View style={styles.header}>
      <Pressable onPress={onMenu} style={styles.headerButton} accessibilityLabel="Open navigation">{Icon('menu',26)}</Pressable>
      <View style={styles.headerCenter}><View style={styles.connectedDot}/><Text style={styles.headerTitle}>Code</Text></View>
      <Pressable onPress={onSettings} style={styles.headerButton} accessibilityLabel="Settings">{Icon('settings',21)}</Pressable>
    </View>
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chatContent}
      onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:true})}>
      {!messages.length&&<View style={styles.empty}>
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
      {!!status&&<Text style={[styles.status,isError&&styles.error]}>{status}</Text>}
    </ScrollView>
    <View style={styles.composerDock}>
      {attachedFile&&<View style={styles.fileBadge}>
        {Icon('file-text',16,PURPLE)}<Text style={styles.fileLabel} numberOfLines={1}>{attachedFile.repo} / {attachedFile.path}</Text>
        <Pressable onPress={onRemoveFile} accessibilityLabel="Remove file">{Icon('x',17,MUTED)}</Pressable>
      </View>}
      <Pressable onPress={onFiles} style={styles.projectPicker}>
        {Icon('folder',17,MUTED)}
        <Text style={styles.projectName} numberOfLines={1}>{attachedFile?attachedFile.repo:'Choose GitHub file'}</Text>
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
    <ModelPicker visible={modelPickerOpen} selected={model} onSelect={setModel} onClose={()=>setModelPickerOpen(false)}/>
  </View>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#FCFAF7'},
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

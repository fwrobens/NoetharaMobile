import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  noetharaAPI, persistChat, getSession, type ChatEntry,
} from '../lib/noetharaBackend';
import type { SelectedGitHubFile } from './NoetharaIntegrations';

const COLORS = { ink:'#252326',muted:'#88878C',violet:'#7355C7',border:'#E9E6E1' };
function I({name,size=20,color=COLORS.ink}:{name:React.ComponentProps<typeof Feather>['name'];size?:number;color?:string}) {
  return <Feather name={name} size={size} color={color}/>;
}
export function ConnectedChat({
  onMenu, onSettings, onFiles, latest, attachedFile, onRemoveFile,
}:{
  onMenu:()=>void;onSettings:()=>void;onFiles:()=>void;latest:string;
  attachedFile:SelectedGitHubFile|null;onRemoveFile:()=>void;
}) {
  const [messages,setMessages]=useState<ChatEntry[]>(latest?[{role:'user',content:latest}]:[]);
  const [prompt,setPrompt]=useState('');
  const [thinking,setThinking]=useState(false);
  const [status,setStatus]=useState('');
  const [model,setModel]=useState('Beam Free');
  const [chatId,setChatId]=useState<string|null>(null);
  const scrollRef=useRef<ScrollView>(null);
  useEffect(()=>{
    if(latest.trim()) {
      void sendExisting(latest);
    }
  },[]);
  async function sendExisting(first:string) {
    const next:ChatEntry[]=[{role:'user',content:first}];
    setThinking(true);setStatus('');
    try {
      await getSession().then(s=>{if(!s)throw Error('Sign in in Settings first.');});
      const id=await persistChat(null,next);setChatId(id);
      const result=await noetharaAPI.chat(next,attachedFile??undefined);
      const answer:ChatEntry={role:'assistant',content:result.answer};
      setMessages([...next,answer]);
      await persistChat(id,[answer]);
      setStatus('Beam · '+result.provider);
    }catch(e){setStatus(e instanceof Error?e.message:'Beam request failed');}
    finally{setThinking(false);}
  }
  async function submit(){
    const text=prompt.trim();if(!text||thinking)return;
    setPrompt('');Keyboard.dismiss();setThinking(true);setStatus('');
    const next=[...messages,{role:'user',content:text} as ChatEntry];
    setMessages(next);
    try {
      const id=await persistChat(chatId,[{role:'user',content:text}]);setChatId(id);
      const result=await noetharaAPI.chat(next.slice(-20),attachedFile??undefined);
      const answer:ChatEntry={role:'assistant',content:result.answer};
      setMessages(list=>[...list,answer]);
      await persistChat(id,[answer]);
      setStatus('Beam · '+result.provider);
    }catch(e){setStatus(e instanceof Error?e.message:'Unable to reach Beam');}
    finally{setThinking(false);}
  }
  return <View style={styles.root}>
    <View style={styles.header}>
      <Pressable onPress={onMenu} style={styles.headerButton}>{I('menu',26)}</Pressable>
      <View style={styles.titleRow}><View style={styles.onlineDot}/><Text style={styles.headerTitle}>Code</Text></View>
      <Pressable onPress={onSettings} style={styles.headerButton}>{I('settings',21)}</Pressable>
    </View>
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chatContent}
      onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:true})}>
      {messages.length===0&&<View style={styles.empty}>
        <View style={styles.emptyIcon}>{I('terminal',35,COLORS.violet)}</View>
        <Text style={styles.emptyTitle}>Build with Beam</Text>
        <Text style={styles.emptyInfo}>Sign in and connect Beam in Settings to start asking questions about code or GitHub files.</Text>
      </View>}
      {messages.map((m,i)=><View key={i} style={m.role==='user'?styles.messageUser:styles.messageAssistant}>
        <Text style={styles.messageRole}>{m.role==='user'?'YOU':'BEAM AI'}</Text>
        <Text selectable style={styles.messageText}>{m.content}</Text>
      </View>)}
      {thinking&&<View style={styles.thinking}><ActivityIndicator color={COLORS.violet} size="small"/><Text style={styles.thinkingText}>Beam is thinking…</Text></View>}
      {!!status&&<Text style={[styles.status,!status.startsWith('Beam')&&styles.statusError]}>{status}</Text>}
    </ScrollView>
    <View style={styles.composerDock}>
      {attachedFile&&<View style={styles.fileBadge}>
        {I('file-text',16,COLORS.violet)}
        <Text style={styles.fileLabel} numberOfLines={1}>{attachedFile.repo} / {attachedFile.path}</Text>
        <Pressable accessibilityLabel="Detach repository file" onPress={onRemoveFile}>{I('x',17,COLORS.muted)}</Pressable>
      </View>}
      <Pressable onPress={onFiles} style={styles.projectPicker}>
        {I('folder',17,COLORS.muted)}
        <Text numberOfLines={1} style={styles.projectText}>{attachedFile?attachedFile.repo:'Choose GitHub file'}</Text>
        {I('chevron-down',15,COLORS.muted)}
      </Pressable>
      <LinearGradient colors={['#FFFFFF','#F8F5F1']} style={styles.composer}>
        <TextInput value={prompt} onChangeText={setPrompt} multiline maxLength={14000}
          placeholder="Ask Beam anything about your code…" placeholderTextColor="#A09DA3"
          style={styles.input} textAlignVertical="top" />
        <View style={styles.actions}>
          <Pressable onPress={onFiles} accessibilityLabel="Attach GitHub file">{I('plus-circle',24,COLORS.muted)}</Pressable>
          <Pressable onPress={()=>Alert.alert('Provider', 'Beam is the available API provider. ChatGPT subscription sharing requires a separately authorized integration.')}
            style={styles.model}><Text style={styles.modelText}>{model}</Text>{I('chevron-down',16,COLORS.violet)}</Pressable>
          <Pressable onPress={onSettings}>{I('shield',21,COLORS.muted)}</Pressable>
          <Pressable onPress={()=>Alert.alert('Dictation', 'Use the native iPhone keyboard microphone to dictate a message.')}>{I('mic',20,COLORS.muted)}</Pressable>
          <Pressable onPress={submit} disabled={thinking||!prompt.trim()} style={[styles.send,thinking&&{opacity:0.55}]}>
            {I('arrow-up',21,'white')}
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#FCFAF7'},
 header:{height:72,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 headerButton:{padding:8},titleRow:{flexDirection:'row',gap:9,alignItems:'center'},
 onlineDot:{width:10,height:10,borderRadius:8,backgroundColor:'#27C565'},
 headerTitle:{fontWeight:'600',color:COLORS.ink,fontSize:20},
 chatContent:{flexGrow:1,padding:18,paddingBottom:34},
 empty:{alignItems:'center',justifyContent:'center',flexGrow:1,paddingHorizontal:21},
 emptyIcon:{height:77,width:77,borderRadius:26,backgroundColor:'#F4F0FA',alignItems:'center',justifyContent:'center',marginBottom:22},
 emptyTitle:{fontSize:22,fontWeight:'700',color:COLORS.ink},
 emptyInfo:{color:COLORS.muted,textAlign:'center',lineHeight:21,fontSize:14,marginTop:12},
 messageUser:{backgroundColor:'#EFEEED',borderRadius:17,padding:15,alignSelf:'flex-end',maxWidth:'91%',marginBottom:14},
 messageAssistant:{backgroundColor:'#FFFFFF',borderRadius:17,padding:15,alignSelf:'stretch',borderWidth:1,borderColor:COLORS.border,marginBottom:14},
 messageRole:{fontSize:10,fontWeight:'800',color:COLORS.muted,marginBottom:7,letterSpacing:0.5},
 messageText:{fontSize:14.5,lineHeight:22,color:COLORS.ink},
 thinking:{flexDirection:'row',alignItems:'center',gap:10,padding:14},
 thinkingText:{fontSize:13,color:COLORS.muted},
 status:{fontSize:12,color:COLORS.muted,marginTop:5,marginHorizontal:6},statusError:{color:'#B8494A'},
 composerDock:{paddingHorizontal:16,paddingBottom:10,paddingTop:9,gap:9},
 fileBadge:{backgroundColor:'#F0ECF7',paddingHorizontal:11,paddingVertical:8,borderRadius:13,flexDirection:'row',alignItems:'center',gap:8},
 fileLabel:{color:COLORS.violet,fontSize:12,flex:1},
 projectPicker:{alignSelf:'flex-start',borderRadius:24,backgroundColor:'#FFF',paddingVertical:9,paddingHorizontal:12,borderWidth:1,borderColor:COLORS.border,flexDirection:'row',gap:9,alignItems:'center',maxWidth:'100%'},
 projectText:{fontSize:13,color:COLORS.ink,maxWidth:230},
 composer:{borderRadius:22,borderWidth:1,borderColor:'#FFFFFF',paddingHorizontal:15,paddingVertical:12,shadowColor:'#6A6069',shadowOpacity:0.09,shadowRadius:17,shadowOffset:{width:0,height:5}},
 input:{fontSize:15,color:COLORS.ink,minHeight:45,maxHeight:114,paddingTop:3,paddingBottom:8},
 actions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},
 model:{borderWidth:1,borderColor:'#E9E4EE',borderRadius:20,paddingHorizontal:10,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:6},
 modelText:{fontSize:12.5,color:COLORS.violet},
 send:{backgroundColor:'#202023',height:39,width:39,borderRadius:20,justifyContent:'center',alignItems:'center'}
});

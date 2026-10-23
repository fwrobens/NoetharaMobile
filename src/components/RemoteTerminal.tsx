import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getSession } from '../lib/noetharaBackend';

type Agent = 'opencode' | 'codex' | 'claude';
type Connection = 'offline' | 'connecting' | 'online';
type Packet = { type?: string; data?: string; message?: string; agent?: string };
const LABELS: Record<Agent,string> = {
  opencode: 'OpenCode',
  codex: 'Codex',
  claude: 'Claude Code',
};
const COLORS = {
  bg: '#FCFAF7', surface: '#FFFEFC', terminal: '#FFFEFC',
  border: '#E6E2DC', text: '#262528', secondary: '#6D6A70',
  muted: '#8D898E', accent: '#7654C8', success: '#29BD67',
};
const MANAGED_ENDPOINT = 'wss://terminal.noethara.cloud';
const Glyph = ({name,size=20,color=COLORS.text}:{
  name: React.ComponentProps<typeof Feather>['name'];size?:number;color?:string;
}) => <Feather name={name} size={size} color={color}/>;
const cleanAnsi = (s: string) => s
  .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'')
  .replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\([A-Za-z0-9])/g,'')
  .replace(/\r(?!\n)/g,'\n');

export function RemoteTerminal({agent,onBack}:{agent:Agent;onBack:()=>void}) {
  const [status,setStatus] = useState<Connection>('offline');
  const [error,setError] = useState('');
  const [output,setOutput] = useState('');
  const [input,setInput] = useState('');
  const wsRef=useRef<WebSocket|null>(null);
  const alive=useRef(true);
  const scrollRef=useRef<ScrollView>(null);
  const append=(message:string)=>setOutput(previous=>(previous+cleanAnsi(message)).slice(-45000));
  const disconnect=()=>{
    const socket=wsRef.current;wsRef.current=null;
    if(socket){socket.onclose=null;socket.close();}
    setStatus('offline');
  };
  async function connect(){
    disconnect();setStatus('connecting');setError('');
    try{
      const session=await getSession();
      if(!alive.current)return;
      if(!session?.access_token)throw new Error('Please sign in to your Noethara account first.');
      const socket=new WebSocket(MANAGED_ENDPOINT);
      wsRef.current=socket;
      socket.onopen=()=>{
        if(wsRef.current===socket)socket.send(JSON.stringify({
          type:'auth',token:session.access_token,agent,
        }));
      };
      socket.onmessage=(event)=>{
        if(wsRef.current!==socket)return;
        let response:Packet;
        try{response=JSON.parse(String(event.data));}
        catch{append(String(event.data));return;}
        if(response.type==='ready'){setStatus('online');setError('');}
        else if(response.type==='output')append(response.data||'');
        else if(response.type==='error'){
          setError(response.message||'Unable to authorize the Linux workspace.');
          setStatus('offline');
          socket.close();
        }else if(response.type==='exit'){
          append('\n[CLI session ended]\n');
          socket.close();
        }
      };
      socket.onerror=()=>{
        if(wsRef.current!==socket)return;
        setStatus('offline');
        setError('The Noethara managed workspace is not reachable yet. Check the server connection.');
      };
      socket.onclose=()=>{
        if(wsRef.current===socket){wsRef.current=null;setStatus('offline');}
      };
    }catch(e){
      setStatus('offline');
      setError(e instanceof Error?e.message:'Authentication unavailable.');
    }
  }
  useEffect(()=>{
    alive.current=true;
    void connect();
    return()=>{
      alive.current=false;
      const socket=wsRef.current;wsRef.current=null;
      if(socket){socket.onclose=null;socket.close();}
    };
  },[agent]);
  const connected=status==='online';
  const sendText=()=>{
    if(!connected||!input.trim()||wsRef.current?.readyState!==WebSocket.OPEN)return;
    wsRef.current.send(JSON.stringify({type:'input',data:input+'\r'}));
    setInput('');
    Keyboard.dismiss();
  };
  const sendKey=(data:string)=>{
    if(connected&&wsRef.current?.readyState===WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({type:'input',data}));
  };
  return <View style={styles.root}>
    <View style={styles.topBar}>
      <Pressable onPress={onBack} style={styles.iconButton} accessibilityLabel="Back to terminals">
        <Glyph name="arrow-left" size={23}/>
      </Pressable>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{LABELS[agent]}</Text>
        <Text style={styles.subtitle}>Noethara managed workspace</Text>
      </View>
      <View style={styles.connectionStatus}>
        <View style={[styles.statusDot,{backgroundColor:connected?COLORS.success:status==='connecting'?'#CE9C4D':'#999599'}]}/>
        <Text style={styles.statusLabel}>{connected?'Live':status==='connecting'?'Connecting':'Offline'}</Text>
      </View>
      <Pressable onPress={()=>void connect()} style={styles.iconButton} accessibilityLabel="Reconnect terminal">
        <Glyph name="refresh-cw" size={19} color="#6E6A70"/>
      </Pressable>
    </View>
    <View style={styles.terminalFrame}>
      <View style={styles.terminalChrome}>
        <View style={styles.chromeDots}>
          <View style={[styles.chromeDot,{backgroundColor:'#E8777A'}]}/>
          <View style={[styles.chromeDot,{backgroundColor:'#E2BC74'}]}/>
          <View style={[styles.chromeDot,{backgroundColor:'#79C69A'}]}/>
        </View>
        <Text style={styles.chromeTitle} numberOfLines={1}>noethara · {LABELS[agent].toLowerCase()}</Text>
        <Pressable onPress={()=>connected?disconnect():void connect()} style={styles.chromeAction}
          accessibilityLabel={connected?'Disconnect terminal':'Reconnect terminal'}>
          <Glyph name={connected?'wifi':'wifi-off'} size={15}
            color={connected?COLORS.success:COLORS.muted}/>
        </Pressable>
      </View>
      <ScrollView ref={scrollRef} style={styles.terminalScroll}
        keyboardShouldPersistTaps="handled" contentContainerStyle={styles.terminalBody}
        onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:false})}>
        {!!output&&<Text selectable style={styles.outputText}>{output}</Text>}
        {connected&&!output&&<View style={styles.connectionNotice}>
          <ActivityIndicator color={COLORS.accent} size="small"/>
          <Text style={styles.connectionNoticeText}>Connected. Loading CLI session…</Text>
        </View>}
        {status==='connecting'&&!output&&<View style={styles.connectingState}>
          <ActivityIndicator color={COLORS.accent} size="small"/>
          <Text style={styles.connectingText}>Connecting to Noethara Linux…</Text>
        </View>}
        {!connected&&status!=='connecting'&&!output&&<View style={styles.emptyState}>
          <View style={styles.terminalLogo}><Glyph name="terminal" size={27} color={COLORS.accent}/></View>
          <Text style={styles.emptyTitle}>Your cloud terminal.</Text>
          <Text style={styles.emptyDescription}>Your Linux workspace is managed by Noethara. No SSH key or connection setup needed.</Text>
          <Pressable onPress={()=>void connect()} style={styles.emptyAction}>
            <Text style={styles.emptyActionText}>Reconnect</Text>
            <Glyph name="refresh-cw" size={16} color="#FFFFFF"/>
          </Pressable>
        </View>}
        {!!error&&<View style={styles.errorRow}>
          <Glyph name="alert-circle" color="#AD6F5A" size={16}/>
          <Text style={styles.errorText}>{error}</Text>
        </View>}
      </ScrollView>
      <View style={styles.terminalFooter}>
        <View style={styles.footerIndicator}/>
        <Text style={styles.footerLabel}>{connected?'Connected to Linux runtime':'Workspace offline'}</Text>
        <Text style={styles.footerLabel}>UTF-8</Text>
      </View>
    </View>
    <View style={styles.commandBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.keyStrip}>
        {([
          {label:'esc',data:'\x1b'}, {label:'tab',data:'\t'}, {label:'ctrl+c',data:'\x03'},
          {label:'↑',data:'\x1b[A'}, {label:'↓',data:'\x1b[B'},
          {label:'←',data:'\x1b[D'}, {label:'→',data:'\x1b[C'},
        ]).map(key=><Pressable key={key.label} onPress={()=>sendKey(key.data)}
          disabled={!connected} style={[styles.key,!connected&&styles.disabledKey]}>
          <Text style={styles.keyText}>{key.label}</Text>
        </Pressable>)}
      </ScrollView>
      <View style={styles.inputRow}>
        <Text style={styles.promptSymbol}>❯</Text>
        <TextInput value={input} onChangeText={setInput} onSubmitEditing={sendText}
          autoCapitalize="none" autoCorrect={false} spellCheck={false}
          returnKeyType="send" editable={connected}
          placeholder={connected?'Type a command…':'Noethara workspace offline'}
          placeholderTextColor="#9A969D" style={styles.input}/>
        <Pressable onPress={sendText} disabled={!connected||!input.length}
          style={[styles.sendButton,(!connected||!input.length)&&styles.disabledSend]}>
          <Glyph name="arrow-up" size={19}
            color={connected&&input?'#FFFFFF':'#9A959E'}/>
        </Pressable>
      </View>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:COLORS.bg},
  topBar:{height:71,flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:9},
  iconButton:{width:37,height:40,alignItems:'center',justifyContent:'center',borderRadius:12},
  titleBlock:{flex:1,gap:3},
  title:{color:COLORS.text,fontSize:19,fontWeight:'700',letterSpacing:-0.35},
  subtitle:{color:COLORS.muted,fontSize:11.5},
  connectionStatus:{height:29,flexDirection:'row',gap:6,alignItems:'center',paddingHorizontal:9,
    borderRadius:11,backgroundColor:'#F3F1ED',borderWidth:1,borderColor:'#E7E3DD'},
  statusDot:{width:7,height:7,borderRadius:5},
  statusLabel:{color:'#777379',fontSize:11,fontWeight:'600'},
  terminalFrame:{flex:1,marginHorizontal:11,marginBottom:10,borderWidth:1,borderColor:'#E6E2DB',
    borderRadius:19,overflow:'hidden',backgroundColor:COLORS.terminal,
    shadowColor:'#7E736F',shadowOpacity:0.045,shadowOffset:{width:0,height:5},shadowRadius:16,elevation:1},
  terminalChrome:{height:47,backgroundColor:'#F7F5F1',borderBottomWidth:1,borderColor:'#EAE5DF',
    flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:14},
  chromeDots:{flexDirection:'row',gap:6},
  chromeDot:{width:8,height:8,borderRadius:6},
  chromeTitle:{flex:1,textAlign:'center',fontSize:11.5,color:'#918D92',fontWeight:'500'},
  chromeAction:{width:28,height:28,alignItems:'flex-end',justifyContent:'center'},
  terminalScroll:{flex:1},
  terminalBody:{flexGrow:1,paddingHorizontal:17,paddingVertical:17},
  outputText:{fontFamily:Platform.OS==='ios'?'Menlo':'monospace',fontSize:12.5,lineHeight:19.5,color:'#323036'},
  emptyState:{flex:1,justifyContent:'center',alignItems:'center',gap:13,paddingVertical:25,paddingHorizontal:18},
  terminalLogo:{height:58,width:58,borderRadius:19,alignItems:'center',justifyContent:'center',
    borderWidth:1,borderColor:'#E4DAF1',backgroundColor:'#F2ECFA',marginBottom:3,
    shadowColor:'#AD94D2',shadowOpacity:0.14,shadowOffset:{width:0,height:5},shadowRadius:13,elevation:2},
  emptyTitle:{fontSize:19,fontWeight:'700',color:'#29262B',letterSpacing:-0.4,textAlign:'center'},
  emptyDescription:{maxWidth:290,fontSize:12.5,lineHeight:19,color:'#87838A',textAlign:'center'},
  emptyAction:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#7753BF',
    borderRadius:12,paddingVertical:12,paddingHorizontal:18,marginTop:10},
  emptyActionText:{fontSize:13,fontWeight:'700',color:'#FFFFFF'},
  connectingState:{flex:1,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:12},
  connectingText:{fontSize:12.5,color:'#92839C'},
  connectionNotice:{flexDirection:'row',alignItems:'center',gap:10},
  connectionNoticeText:{color:'#87838A',fontSize:12.5},
  errorRow:{marginTop:14,padding:12,backgroundColor:'#FFF5F0',borderWidth:1,
    borderColor:'#F0DEDA',borderRadius:11,flexDirection:'row',gap:9,alignItems:'flex-start'},
  errorText:{color:'#AE6257',fontSize:12,lineHeight:18,flex:1},
  terminalFooter:{height:33,borderTopWidth:1,borderColor:'#EBE7E0',
    flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,backgroundColor:'#F9F7F4'},
  footerIndicator:{height:6,width:6,borderRadius:4,backgroundColor:'#B4AFB5'},
  footerLabel:{color:'#918C92',fontSize:10,fontFamily:Platform.OS==='ios'?'Menlo':'monospace'},
  commandBar:{paddingHorizontal:12,paddingBottom:8,gap:10},
  keyStrip:{flexDirection:'row',gap:7,paddingBottom:1,paddingHorizontal:1},
  key:{height:34,minWidth:45,borderRadius:9,backgroundColor:'#FFFFFF',
    borderWidth:1,borderColor:'#E6E1DB',
    justifyContent:'center',alignItems:'center',paddingHorizontal:11},
  disabledKey:{opacity:0.55},
  keyText:{fontSize:11.5,fontWeight:'600',color:'#555159'},
  inputRow:{height:51,backgroundColor:'#FFFFFF',borderColor:'#E5E0D9',borderWidth:1,
    borderRadius:14,flexDirection:'row',alignItems:'center',paddingLeft:16,gap:11,paddingRight:6},
  promptSymbol:{fontSize:18,color:COLORS.accent,fontWeight:'700'},
  input:{flex:1,height:'100%',fontSize:13.5,color:COLORS.text,
    fontFamily:Platform.OS==='ios'?'Menlo':'monospace'},
  sendButton:{height:38,width:40,backgroundColor:'#7654C8',borderRadius:10,alignItems:'center',justifyContent:'center'},
  disabledSend:{backgroundColor:'#F2EDF8'},
});

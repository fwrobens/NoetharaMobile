import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';

type Agent = 'opencode' | 'codex' | 'claude';
type Connection = 'offline' | 'connecting' | 'online';
type Packet = { type?: string; data?: string; message?: string; agent?: string };
const LABELS: Record<Agent,string> = {
  opencode: 'OpenCode',
  codex: 'Codex',
  claude: 'Claude Code',
};
const COLORS = {
  bg: '#111215', surface: '#17191D', terminal: '#0C0D0F',
  border: '#2C2E32', text: '#F2F2F4', secondary: '#A2A3A8',
  muted: '#73757E', accent: '#B7A0F2', success: '#44D198',
};
const URL_KEY = 'noethara-terminal-gateway-url';
const TOKEN_KEY = 'noethara-terminal-gateway-token';
const Glyph = ({name,size=20,color=COLORS.text}:{
  name: React.ComponentProps<typeof Feather>['name'];size?:number;color?:string;
}) => <Feather name={name} size={size} color={color}/>;
const cleanAnsi = (s: string) => s
  .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'')
  .replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\([A-Za-z0-9])/g,'')
  .replace(/\r(?!\n)/g,'\n');

export function RemoteTerminal({agent,onBack}:{agent:Agent;onBack:()=>void}) {
  const [gateway,setGateway] = useState('');
  const [token,setToken] = useState('');
  const [loaded,setLoaded] = useState(false);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [status,setStatus] = useState<Connection>('offline');
  const [error,setError] = useState('');
  const [lines,setLines] = useState('');
  const [input,setInput] = useState('');
  const wsRef = useRef<WebSocket|null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const alive = useRef(true);
  const everReady = useRef(false);

  const append = (next: string) => {
    setLines(previous => (previous + cleanAnsi(next)).slice(-45000));
  };
  const disconnect = () => {
    const socket = wsRef.current;
    wsRef.current = null;
    if(socket) { socket.onclose = null; socket.close(); }
    setStatus('offline');
  };
  function openConnection(address:string,accessToken:string) {
    const url=address.trim();
    if (!url.startsWith('wss://')) {
      setError('A secure wss:// endpoint is required. Configure TLS on your private server first.');
      setSettingsOpen(true);
      return;
    }
    if (!accessToken.trim()) {
      setError('Enter the access token from your private Noethara Linux runtime.');
      setSettingsOpen(true);
      return;
    }
    const existing=wsRef.current;
    if (existing) {existing.onclose=null;existing.close();}
    setStatus('connecting');setError('');
    const socket=new WebSocket(url);
    wsRef.current=socket;
    let authenticated=false;
    socket.onopen=()=>{
      if(wsRef.current===socket) socket.send(JSON.stringify({
        type:'auth',token:accessToken.trim(),agent,
      }));
    };
    socket.onmessage=(event)=>{
      if(wsRef.current!==socket)return;
      let packet: Packet;
      try {packet=JSON.parse(String(event.data));}
      catch {append(String(event.data));return;}
      if(packet.type==='ready'){
        authenticated=true;everReady.current=true;
        setStatus('online');setError('');
      } else if(packet.type==='output') append(packet.data||'');
      else if(packet.type==='error'){
        setError(packet.message||'The remote terminal returned an error.');
        setStatus('offline');
        socket.close();
      } else if(packet.type==='exit'){
        append('\n[CLI session ended]\n');
        setStatus('offline');
        socket.close();
      }
    };
    socket.onerror=()=>{
      if(wsRef.current===socket) {
        setError('Could not reach the private terminal. Check the secure gateway URL and runtime service.');
        setStatus('offline');
      }
    };
    socket.onclose=()=>{
      if(wsRef.current===socket) {
        wsRef.current=null;
        setStatus('offline');
        if(!authenticated && !error) setError('No terminal session is connected.');
      }
    };
  }
  useEffect(()=>{
    alive.current=true;
    Promise.all([SecureStore.getItemAsync(URL_KEY),SecureStore.getItemAsync(TOKEN_KEY)])
      .then(([u,t])=>{
        if(!alive.current)return;
        setGateway(u||'');setToken(t||'');setLoaded(true);
        if(u&&t)openConnection(u,t);
      }).catch(()=>{
        if(alive.current){setLoaded(true);setError('Could not read saved connection settings.');}
      });
    return()=>{
      alive.current=false;
      const socket=wsRef.current;
      wsRef.current=null;
      if(socket){socket.onclose=null;socket.close();}
    };
  },[agent]);
  const saveAndConnect=async()=>{
    const url=gateway.trim();
    if(!url.startsWith('wss://')){
      setError('Enter an authenticated wss:// URL, not the EC2 IP over unencrypted ws://.');
      return;
    }
    if(token.trim().length<32){setError('Enter your private server token (at least 32 characters).');return;}
    try{
      await SecureStore.setItemAsync(URL_KEY,url);
      await SecureStore.setItemAsync(TOKEN_KEY,token.trim());
      setSettingsOpen(false);setError('');setLines('');
      openConnection(url,token.trim());
    }catch{setError('Could not securely save these connection settings.');}
  };
  const sendText=()=>{
    if(!input.length)return;
    if(status!=='online'||wsRef.current?.readyState!==WebSocket.OPEN)return;
    wsRef.current.send(JSON.stringify({type:'input',data:input+'\r'}));
    setInput('');
    Keyboard.dismiss();
  };
  const sendKey=(data:string)=>{
    if(status==='online'&&wsRef.current?.readyState===WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({type:'input',data}));
  };
  const connected=status==='online';
  const configured=Boolean(gateway&&token);
  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.iconButton} accessibilityLabel="Back to terminals">
          <Glyph name="arrow-left" size={23}/>
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{LABELS[agent]}</Text>
          <Text style={styles.subtitle}>Terminal session</Text>
        </View>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot,{backgroundColor:connected?COLORS.success:status==='connecting'?'#DEAA6B':'#71717A'}]}/>
          <Text style={styles.statusLabel}>{connected?'Live':status==='connecting'?'Connecting':'Offline'}</Text>
        </View>
        <Pressable onPress={()=>{setError('');setSettingsOpen(true);}}
          style={styles.iconButton} accessibilityLabel="Connection settings">
          <Glyph name="settings" size={20} color="#D1D0D5"/>
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
          <Pressable onPress={()=>{if(connected)disconnect();else if(configured)openConnection(gateway,token);else setSettingsOpen(true);}}
            accessibilityLabel={connected?'Disconnect':'Connect'} style={styles.chromeAction}>
            <Glyph name={connected?'wifi':'wifi-off'} size={15} color={connected?COLORS.success:COLORS.muted}/>
          </Pressable>
        </View>

        <ScrollView ref={scrollRef} style={styles.terminalScroll} keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.terminalBody}
          onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:false})}>
          {lines.length>0 && <Text selectable style={styles.outputText}>{lines}</Text>}
          {connected && !lines && <View style={styles.connectionNotice}>
            <ActivityIndicator size="small" color={COLORS.accent}/>
            <Text style={styles.connectionNoticeText}>Connected to {LABELS[agent]}. Loading terminal output…</Text>
          </View>}
          {!connected && status!=='connecting' && !lines && (
            <View style={styles.emptyState}>
              <View style={styles.terminalLogo}><Glyph name="terminal" size={27} color={COLORS.accent}/></View>
              <Text style={styles.emptyTitle}>{configured?'Session is offline':'Your terminal, anywhere.'}</Text>
              <Text style={styles.emptyDescription}>
                {configured?'Reconnect to your Linux workspace and pick up where you left off.':
                'Connect your Noethara Linux workspace to run '+LABELS[agent]+' on your server.'}
              </Text>
              <Pressable onPress={()=>configured?openConnection(gateway,token):setSettingsOpen(true)}
                style={styles.emptyAction}>
                <Text style={styles.emptyActionText}>{configured?'Reconnect session':'Connect workspace'}</Text>
                <Glyph name="arrow-up-right" size={17} color="#151317"/>
              </Pressable>
            </View>
          )}
          {status==='connecting' && !lines && (
            <View style={styles.connectingState}>
              <ActivityIndicator size="small" color={COLORS.accent}/>
              <Text style={styles.connectingText}>Opening your private CLI session…</Text>
            </View>
          )}
          {!!error&&<View style={styles.errorRow}>
            <Glyph name="alert-circle" color="#E2A092" size={16}/>
            <Text style={styles.errorText}>{error}</Text>
          </View>}
        </ScrollView>
        <View style={styles.terminalFooter}>
          <View style={styles.footerIndicator}/>
          <Text style={styles.footerLabel}>{connected?'Connected to Linux runtime': 'Private CLI · No session connected'}</Text>
          <Text style={styles.footerLabel}>UTF-8</Text>
        </View>
      </View>

      <View style={styles.commandBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always" contentContainerStyle={styles.keyStrip}>
          {([
            {label:'esc',data:'\x1b'}, {label:'tab',data:'\t'},
            {label:'ctrl+c',data:'\x03'}, {label:'↑',data:'\x1b[A'},
            {label:'↓',data:'\x1b[B'}, {label:'←',data:'\x1b[D'},
            {label:'→',data:'\x1b[C'},
          ]).map(key=><Pressable key={key.label} onPress={()=>sendKey(key.data)}
            disabled={!connected} style={[styles.key, !connected&&styles.disabledKey]}>
            <Text style={styles.keyText}>{key.label}</Text>
          </Pressable>)}
        </ScrollView>
        <View style={styles.inputRow}>
          <Text style={styles.promptSymbol}>❯</Text>
          <TextInput value={input} onChangeText={setInput} onSubmitEditing={sendText}
            autoCapitalize="none" autoCorrect={false} spellCheck={false}
            returnKeyType="send" editable={connected}
            placeholder={connected?'Type a terminal command…':'Connect to enable terminal input'}
            placeholderTextColor="#6E6F77" style={styles.input}/>
          <Pressable onPress={sendText} disabled={!connected||!input.length}
            style={[styles.sendButton,(!connected||!input.length)&&styles.disabledSend]}>
            <Glyph name="arrow-up" size={19} color={connected&&input?'#141318':'#717078'}/>
          </Pressable>
        </View>
      </View>

      <Modal visible={settingsOpen} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={()=>setSettingsOpen(false)}>
        <SafeAreaView edges={['top','bottom']} style={styles.modal}>
          <View style={styles.modalHeader}>
            <Pressable onPress={()=>setSettingsOpen(false)} style={styles.modalClose}>
              <Glyph name="x" size={23}/>
            </Pressable>
            <Text style={styles.modalTitle}>Connect workspace</Text>
            <View style={{width:37}}/>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
            <View style={styles.connectionArtwork}><Glyph name="server" size={28} color={COLORS.accent}/></View>
            <Text style={styles.modalHeading}>Your own Linux server.</Text>
            <Text style={styles.modalSubtitle}>
              Connect to your private terminal bridge. Your CLI sessions run on the Linux server, not on your phone.
            </Text>
            <Text style={styles.fieldLabel}>SECURE CONNECTION URL</Text>
            <TextInput style={styles.field} value={gateway} onChangeText={setGateway}
              keyboardType="url" autoCapitalize="none" autoCorrect={false}
              placeholder="wss://terminal.yourdomain.com" placeholderTextColor="#71737B"/>
            <Text style={styles.fieldLabel}>RUNTIME ACCESS TOKEN</Text>
            <TextInput style={styles.field} value={token} onChangeText={setToken}
              autoCapitalize="none" autoCorrect={false} secureTextEntry
              placeholder="Server authentication token" placeholderTextColor="#71737B"/>
            <View style={styles.helperRow}>
              <Glyph name="lock" size={16} color={COLORS.accent}/>
              <Text style={styles.helperText}>Saved in iOS secure storage. Requires an authenticated WSS gateway; the EC2 public IP alone is not a secure terminal URL.</Text>
            </View>
            {!!error&&<Text style={styles.modalError}>{error}</Text>}
            <Pressable style={styles.connectButton} onPress={()=>void saveAndConnect()}>
              <Text style={styles.connectButtonText}>Connect to {LABELS[agent]}</Text>
              <Glyph name="arrow-right" size={19} color="#141318"/>
            </Pressable>
            <Text style={styles.disclaimer}>Interactive fullscreen TUIs still require full ANSI/PTY rendering support; this client currently supports basic terminal output and input.</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:COLORS.bg},
  topBar:{height:71,flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:9},
  iconButton:{width:37,height:40,alignItems:'center',justifyContent:'center',borderRadius:12},
  titleBlock:{flex:1,gap:3},
  title:{color:COLORS.text,fontSize:19,fontWeight:'700',letterSpacing:-0.35},
  subtitle:{color:COLORS.muted,fontSize:11.5},
  connectionStatus:{height:29,flexDirection:'row',gap:6,alignItems:'center',paddingHorizontal:9,
    borderRadius:9,backgroundColor:'#212228',borderWidth:1,borderColor:COLORS.border},
  statusDot:{width:7,height:7,borderRadius:5},
  statusLabel:{color:'#BDBDC2',fontSize:11,fontWeight:'600'},
  terminalFrame:{flex:1,marginHorizontal:11,marginBottom:10,borderWidth:1,borderColor:'#2E3035',
    borderRadius:17,overflow:'hidden',backgroundColor:COLORS.terminal},
  terminalChrome:{height:47,backgroundColor:'#191A1F',borderBottomWidth:1,borderColor:'#2B2C31',
    flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:14},
  chromeDots:{flexDirection:'row',gap:6},
  chromeDot:{width:8,height:8,borderRadius:6},
  chromeTitle:{flex:1,textAlign:'center',fontSize:11.5,color:'#96959C',fontWeight:'500'},
  chromeAction:{width:28,height:28,alignItems:'flex-end',justifyContent:'center'},
  terminalScroll:{flex:1},
  terminalBody:{minHeight:'100%',paddingHorizontal:17,paddingVertical:17},
  outputText:{fontFamily:Platform.OS==='ios'?'Menlo':'monospace',fontSize:12.5,lineHeight:19.5,color:'#DADDE4'},
  emptyState:{flex:1,justifyContent:'center',alignItems:'center',gap:13,paddingVertical:25,paddingHorizontal:18},
  terminalLogo:{height:56,width:56,borderRadius:17,alignItems:'center',justifyContent:'center',
    borderWidth:1,borderColor:'#383242',backgroundColor:'#211D29',marginBottom:3},
  emptyTitle:{fontSize:19,fontWeight:'700',color:'#ECEBF0',letterSpacing:-0.4,textAlign:'center'},
  emptyDescription:{maxWidth:290,fontSize:12.5,lineHeight:19,color:'#898893',textAlign:'center'},
  emptyAction:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#C1ACF3',
    borderRadius:12,paddingVertical:12,paddingHorizontal:18,marginTop:10},
  emptyActionText:{fontSize:13,fontWeight:'700',color:'#17121E'},
  connectingState:{flex:1,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:12},
  connectingText:{fontSize:12.5,color:'#AFA5BA'},
  connectionNotice:{flexDirection:'row',alignItems:'center',gap:10},
  connectionNoticeText:{color:'#898A91',fontSize:12.5},
  errorRow:{marginTop:14,padding:12,backgroundColor:'#2C2022',borderRadius:11,flexDirection:'row',gap:9,alignItems:'flex-start'},
  errorText:{color:'#E5B2A6',fontSize:12,lineHeight:18,flex:1},
  terminalFooter:{height:33,borderTopWidth:1,borderColor:'#282A2F',
    flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,backgroundColor:'#141519'},
  footerIndicator:{height:6,width:6,borderRadius:4,backgroundColor:'#777780'},
  footerLabel:{color:'#757680',fontSize:10,fontFamily:Platform.OS==='ios'?'Menlo':'monospace'},
  commandBar:{paddingHorizontal:12,paddingBottom:8,gap:10},
  keyStrip:{flexDirection:'row',gap:7,paddingBottom:1,paddingHorizontal:1},
  key:{height:34,minWidth:45,borderRadius:9,backgroundColor:'#25262C',borderWidth:1,borderColor:'#303137',
    justifyContent:'center',alignItems:'center',paddingHorizontal:11},
  disabledKey:{opacity:0.52},
  keyText:{fontSize:11.5,fontWeight:'600',color:'#CFCCD5'},
  inputRow:{height:51,backgroundColor:'#24252A',borderColor:'#33343A',borderWidth:1,
    borderRadius:14,flexDirection:'row',alignItems:'center',paddingLeft:16,gap:11,paddingRight:6},
  promptSymbol:{fontSize:18,color:COLORS.accent,fontWeight:'700'},
  input:{flex:1,height:'100%',fontSize:13.5,color:COLORS.text,
    fontFamily:Platform.OS==='ios'?'Menlo':'monospace'},
  sendButton:{height:38,width:40,backgroundColor:'#C1ACF3',borderRadius:10,alignItems:'center',justifyContent:'center'},
  disabledSend:{backgroundColor:'#36363C'},
  modal:{flex:1,backgroundColor:'#17181C'},
  modalHeader:{height:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:18},
  modalClose:{width:37,height:37,justifyContent:'center'},
  modalTitle:{color:COLORS.text,fontWeight:'700',fontSize:16},
  modalContent:{paddingHorizontal:24,paddingBottom:40},
  connectionArtwork:{height:64,width:64,borderRadius:19,backgroundColor:'#282132',alignItems:'center',
    justifyContent:'center',marginTop:23,marginBottom:22},
  modalHeading:{fontSize:26,letterSpacing:-0.7,fontWeight:'700',color:COLORS.text,marginBottom:12},
  modalSubtitle:{fontSize:14,color:'#9C9AA5',lineHeight:22,marginBottom:31},
  fieldLabel:{fontSize:10,fontWeight:'700',letterSpacing:1,color:'#888391',marginBottom:10},
  field:{height:55,borderWidth:1,borderColor:'#3B3B44',backgroundColor:'#24252B',
    borderRadius:13,paddingHorizontal:15,marginBottom:21,color:COLORS.text,fontSize:14},
  helperRow:{flexDirection:'row',alignItems:'flex-start',gap:10,marginBottom:15},
  helperText:{flex:1,fontSize:12,color:'#928E9C',lineHeight:19},
  modalError:{color:'#E9A79C',fontSize:12,lineHeight:19,marginBottom:17},
  connectButton:{height:55,borderRadius:13,flexDirection:'row',justifyContent:'center',
    alignItems:'center',gap:13,backgroundColor:'#C4AFF7',marginTop:8},
  connectButtonText:{fontSize:14,fontWeight:'700',color:'#15121D'},
  disclaimer:{fontSize:11,color:'#75717D',lineHeight:17,marginTop:22},
});

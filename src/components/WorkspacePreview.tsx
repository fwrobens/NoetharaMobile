import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { managedWorkspace } from '../lib/managedWorkspace';

const INK='#29262D',PURPLE='#7559B5',MUTED='#85808A',RED='#B4473F';
const NativeWebView=WebView as unknown as React.ComponentType<any>;
type Device='phone'|'tablet'|'desktop';
const DEVICES:Array<{id:Device;label:string;icon:React.ComponentProps<typeof Feather>['name'];width:number|null}>=[
 {id:'phone',label:'Phone',icon:'smartphone',width:null},
 {id:'tablet',label:'Tablet',icon:'tablet',width:820},
 {id:'desktop',label:'Desktop',icon:'monitor',width:1280},
];
type LogLine={id:number;level:'log'|'warn'|'error'|'server';text:string};
const MAX_RETRIES=3;

// Forces a CSS viewport width so tablet/desktop layouts render scaled down on the phone.
const viewportScript=(width:number|null)=>`(function(){
 var W=${width===null?'null':width};
 function apply(){var m=document.querySelector('meta[name=viewport]');
  if(!m){m=document.createElement('meta');m.name='viewport';(document.head||document.documentElement).appendChild(m);}
  m.setAttribute('content',W?'width='+W+', initial-scale='+(screen.width/W).toFixed(3)+', user-scalable=yes':'width=device-width, initial-scale=1, viewport-fit=cover');}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();true;`;

export function WorkspacePreview({url,visible,onClose,workspaceId}:{url:string|null;visible:boolean;onClose:()=>void;workspaceId?:string|null}){
 const view=useRef<any>(null);
 const insets=useSafeAreaInsets();
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [progress,setProgress]=useState(0);
 const [version,setVersion]=useState(0);
 const [device,setDevice]=useState<Device>('phone');
 const [retry,setRetry]=useState(0);
 const [runtimeError,setRuntimeError]=useState<{title:string;detail:string}|null>(null);
 const [logsOpen,setLogsOpen]=useState(false);
 const [logs,setLogs]=useState<LogLine[]>([]);
 const [server,setServer]=useState('');
 const lineId=useRef(0);
 const attempts=useRef(0);
 const retryTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const sheet=useRef(new Animated.Value(0)).current;
 const width=DEVICES.find(d=>d.id===device)?.width??null;
 const script=useMemo(()=>viewportScript(width),[width]);

 const reset=useCallback(()=>{setError('');setLoading(true);setProgress(0);setRuntimeError(null);},[]);
 useEffect(()=>{if(visible&&url){reset();attempts.current=0;setRetry(0);setLogs([]);}},[visible,url,reset]);
 useEffect(()=>()=>{if(retryTimer.current)clearTimeout(retryTimer.current);},[]);
 const reload=useCallback(()=>{if(retryTimer.current){clearTimeout(retryTimer.current);retryTimer.current=null;}attempts.current=0;reset();setRetry(0);setVersion(x=>x+1);},[reset]);
 // Reconnect: transient tunnel/proxy failures retry with backoff, restarting the preview server if needed.
 const fail=useCallback((message:string,restartServer:boolean)=>{
  setLoading(false);
  if(retryTimer.current)return; // a reconnect is already scheduled
  const attempt=attempts.current;
  if(attempt>=MAX_RETRIES){setError(message);return;}
  attempts.current=attempt+1;setRetry(attempt+1);
  retryTimer.current=setTimeout(async()=>{
   retryTimer.current=null;
   if(restartServer&&workspaceId){try{await managedWorkspace.startPreview(workspaceId);}catch{/* surfaced on next failure */}}
   reset();setVersion(x=>x+1);
  },1500*2**attempt);
 },[reset,workspaceId]);
 // Coming back to the app reconnects a broken preview.
 useEffect(()=>{
  const sub=AppState.addEventListener('change',state=>{if(state==='active'&&visible&&error)reload();});
  return()=>sub.remove();
 },[visible,error,reload]);
 // Live server output while the logs sheet is open.
 useEffect(()=>{
  if(!logsOpen||!workspaceId||!visible)return;
  let alive=true;
  const poll=async()=>{try{const s=await managedWorkspace.previewStatus(workspaceId);if(alive)setServer((s.output||'').slice(-6000)||'Server status: '+s.status);}catch{/* keep last output */}};
  void poll();const timer=setInterval(()=>void poll(),2500);
  return()=>{alive=false;clearInterval(timer);};
 },[logsOpen,workspaceId,visible]);
 useEffect(()=>{Animated.timing(sheet,{toValue:logsOpen?1:0,duration:260,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();},[logsOpen,sheet]);

 const push=(level:LogLine['level'],text:string)=>setLogs(prev=>[...prev.slice(-79),{id:++lineId.current,level,text}]);
 const onMessage=(e:{nativeEvent:{data:string}})=>{
  try{
   const msg=JSON.parse(e.nativeEvent.data) as {source?:string;type?:string;data?:{title?:string;detail?:string;level?:LogLine['level'];text?:string}};
   if(msg.source!=='noethara-preview')return;
   if(msg.type==='error'){const t=msg.data?.title||'Runtime error';setRuntimeError({title:t,detail:msg.data?.detail||''});push('error',t);}
   else if(msg.type==='console'&&msg.data?.text)push(msg.data.level||'log',msg.data.text);
   else if(msg.type==='ready'){attempts.current=0;setRetry(0);}
  }catch{/* not ours */}
 };

 return <Modal visible={visible&&Boolean(url)} animationType="slide" onRequestClose={onClose}>
  <View style={[styles.root,{paddingTop:insets.top,paddingBottom:Math.max(insets.bottom,8)}]}>
   <View style={styles.header}>
    <Pressable style={styles.back} onPress={onClose} accessibilityLabel="Close preview">
     <Feather name="chevron-down" size={24} color={INK}/>
    </Pressable>
    <View style={styles.heading}>
     <View style={styles.titleRow}><View style={[styles.liveDot,(error||runtimeError)&&{backgroundColor:RED}]}/><Text style={styles.title}>Live preview</Text></View>
     <Text numberOfLines={1} style={styles.subtitle}>{retry>0&&!error?'Reconnecting… attempt '+retry+' of '+MAX_RETRIES:'Vite · Managed workspace'}</Text>
    </View>
    <Pressable style={[styles.iconBtn,logsOpen&&styles.iconBtnOn]} onPress={()=>setLogsOpen(o=>!o)} accessibilityLabel="Show logs">
     <Feather name="terminal" size={17} color={logsOpen?'#fff':PURPLE}/>
     {logs.some(l=>l.level==='error')&&!logsOpen&&<View style={styles.badgeDot}/>}
    </Pressable>
    <Pressable style={styles.iconBtn} onPress={reload} accessibilityLabel="Reload preview">
     <Feather name="refresh-cw" size={17} color={PURPLE}/>
    </Pressable>
    <Pressable style={styles.iconBtn} onPress={()=>{if(url)void Linking.openURL(url)}} accessibilityLabel="Open preview in browser">
     <Feather name="external-link" size={17} color={PURPLE}/>
    </Pressable>
   </View>
   <View style={styles.toolbar}>
    {DEVICES.map(d=><Pressable key={d.id} onPress={()=>{setDevice(d.id);reset();}} style={[styles.seg,device===d.id&&styles.segOn]} accessibilityLabel={d.label+' size'}>
     <Feather name={d.icon} size={13} color={device===d.id?'#fff':PURPLE}/>
     <Text style={[styles.segText,device===d.id&&{color:'#fff'}]}>{d.label}{d.width?' '+d.width:''}</Text>
    </Pressable>)}
   </View>
   <View style={styles.viewport}>
    {url&&<NativeWebView key={url+'-'+version+'-'+device} ref={view} source={{uri:url}}
     javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled={false}
     originWhitelist={['https://*']} setSupportMultipleWindows={false} scalesPageToFit
     injectedJavaScriptBeforeContentLoaded={script} injectedJavaScript={script} onMessage={onMessage}
     onLoadStart={()=>{setLoading(true);setError('');}}
     onLoadProgress={(e:{nativeEvent:{progress:number}})=>setProgress(e.nativeEvent.progress)}
     onLoadEnd={()=>setLoading(false)}
     onHttpError={(e:{nativeEvent:{statusCode?:number}})=>{
      const code=e.nativeEvent.statusCode||0;
      fail('The preview server returned HTTP '+(code||'error')+'. It may still be installing or building; try again in a moment.',[404,502,503,504].includes(code));
     }}
     onError={(e:{nativeEvent:{description?:string}})=>fail(e.nativeEvent.description||'Could not reach the preview through the tunnel.',true)}
     onContentProcessDidTerminate={()=>fail('The preview renderer stopped.',false)}
     startInLoadingState
     renderLoading={()=> <View style={styles.webLoading}><ActivityIndicator color={PURPLE}/></View>}
     style={styles.web}/>}
    {loading&&!error&&<View pointerEvents="none" style={styles.loadingBanner}>
      <ActivityIndicator size="small" color={PURPLE}/>
      <View style={{flex:1}}><Text style={styles.loadingTitle}>{retry>0?'Reconnecting to your app…':'Opening your app…'}</Text>
       <Text style={styles.loadingDetail}>{Math.round(progress*100)}% · {retry>0?'Restarting the preview server':'Connecting to Vite'}</Text></View>
     </View>}
    {!!runtimeError&&!error&&<Pressable onPress={()=>setLogsOpen(true)} style={styles.runtime}>
      <Feather name="alert-triangle" size={15} color="#fff"/>
      <View style={{flex:1}}><Text style={styles.runtimeTitle} numberOfLines={1}>{runtimeError.title}</Text>
       <Text style={styles.runtimeDetail} numberOfLines={2}>{runtimeError.detail||'Tap to see logs'}</Text></View>
      <Pressable onPress={()=>setRuntimeError(null)} hitSlop={10}><Feather name="x" size={16} color="#fff"/></Pressable>
     </Pressable>}
    {!!error&&<View style={styles.errorOverlay}>
      <View style={styles.errorIcon}><Feather name="alert-circle" size={25} color="#B76763"/></View>
      <Text style={styles.errorTitle}>Preview couldn't load</Text>
      <Text style={styles.errorDescription}>{error}</Text>
      <Pressable onPress={reload} style={styles.retry}><Feather name="refresh-cw" size={17} color="#fff"/>
       <Text style={styles.retryText}>Try again</Text></Pressable>
    </View>}
    <Animated.View pointerEvents={logsOpen?'auto':'none'} style={[styles.sheet,{opacity:sheet,transform:[{translateY:sheet.interpolate({inputRange:[0,1],outputRange:[260,0]})}]}]}>
     <View style={styles.sheetHead}><Text style={styles.sheetTitle}>Logs</Text>
      <Pressable onPress={()=>{setLogs([]);setRuntimeError(null);}} hitSlop={8}><Text style={styles.clear}>Clear</Text></Pressable></View>
     <ScrollView style={{flex:1}} contentContainerStyle={{padding:12,gap:4}}>
      {logs.length===0&&!server&&<Text style={styles.logMuted}>No console output yet.</Text>}
      {logs.map(l=><Text key={l.id} style={[styles.log,l.level==='error'&&{color:'#FF8A80'},l.level==='warn'&&{color:'#FFD479'}]} selectable>{l.level==='log'?'›':l.level==='warn'?'⚠':'✖'} {l.text}</Text>)}
      {!!server&&<><Text style={styles.logHead}>Preview server</Text><Text style={styles.logServer} selectable>{server}</Text></>}
     </ScrollView>
    </Animated.View>
   </View>
  </View>
 </Modal>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#FCFAF7'},
 header:{minHeight:62,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:7,borderBottomWidth:1,borderColor:'#E9E4E0'},
 back:{width:33,height:44,justifyContent:'center'},
 heading:{flex:1,minWidth:0},
 titleRow:{flexDirection:'row',alignItems:'center',gap:8},
 liveDot:{width:8,height:8,borderRadius:4,backgroundColor:'#29BD75'},
 title:{fontSize:17,fontWeight:'700',letterSpacing:-.4,color:INK},
 subtitle:{fontSize:11.5,color:MUTED,marginTop:3},
 iconBtn:{height:36,width:36,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:'#F2EDF8'},
 iconBtnOn:{backgroundColor:PURPLE},
 badgeDot:{position:'absolute',top:6,right:6,width:7,height:7,borderRadius:4,backgroundColor:RED},
 toolbar:{height:46,flexDirection:'row',alignItems:'center',paddingHorizontal:14,gap:6,borderBottomWidth:1,borderColor:'#EBE6E1'},
 seg:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:6,borderRadius:11,backgroundColor:'#F2EDF8'},
 segOn:{backgroundColor:PURPLE},
 segText:{fontSize:11.5,color:PURPLE,fontWeight:'600'},
 viewport:{flex:1,position:'relative',backgroundColor:'#FFF',overflow:'hidden'},
 web:{flex:1,backgroundColor:'#FFFFFF'},
 webLoading:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#FFFFFF'},
 loadingBanner:{position:'absolute',top:14,left:16,right:16,flexDirection:'row',gap:11,alignItems:'center',backgroundColor:'#F7F2FD',
  borderWidth:1,borderColor:'#E9E1F1',padding:13,borderRadius:14},
 loadingTitle:{fontSize:12.5,fontWeight:'600',color:INK},
 loadingDetail:{fontSize:11,color:MUTED,marginTop:3},
 runtime:{position:'absolute',left:12,right:12,bottom:12,flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:14,backgroundColor:RED,
  shadowColor:'#000',shadowOpacity:.18,shadowRadius:14,shadowOffset:{width:0,height:6}},
 runtimeTitle:{color:'#fff',fontSize:12.5,fontWeight:'700'},
 runtimeDetail:{color:'#FFE3E0',fontSize:11,marginTop:2,fontFamily:'Menlo'},
 errorOverlay:{position:'absolute',top:0,right:0,bottom:0,left:0,alignItems:'center',justifyContent:'center',paddingHorizontal:34,backgroundColor:'#FCFAF7'},
 errorIcon:{height:54,width:54,borderRadius:18,backgroundColor:'#FCF0EF',alignItems:'center',justifyContent:'center',marginBottom:16},
 errorTitle:{fontSize:20,fontWeight:'700',color:INK,letterSpacing:-.5},
 errorDescription:{color:MUTED,fontSize:13.5,lineHeight:21,textAlign:'center',marginTop:12},
 retry:{marginTop:24,height:46,borderRadius:14,backgroundColor:INK,flexDirection:'row',gap:9,alignItems:'center',paddingHorizontal:22},
 retryText:{color:'#fff',fontSize:14,fontWeight:'600'},
 sheet:{position:'absolute',left:0,right:0,bottom:0,height:'46%',backgroundColor:'#16141A',borderTopLeftRadius:18,borderTopRightRadius:18},
 sheetHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:14,paddingTop:12,paddingBottom:6},
 sheetTitle:{color:'#fff',fontSize:13,fontWeight:'700'},
 clear:{color:'#B9A6E6',fontSize:12,fontWeight:'600'},
 log:{color:'#E6E3EA',fontSize:11,fontFamily:'Menlo',lineHeight:15},
 logMuted:{color:'#8E8A94',fontSize:11.5},
 logHead:{color:'#B9A6E6',fontSize:11,fontWeight:'700',marginTop:10},
 logServer:{color:'#C9C5CF',fontSize:10.5,fontFamily:'Menlo',lineHeight:14},
});

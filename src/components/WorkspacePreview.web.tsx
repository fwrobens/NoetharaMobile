// Browser-only live preview. The native version uses react-native-webview;
// Safari/desktop browsers use a real iframe and an external-open fallback.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { managedWorkspace } from '../lib/managedWorkspace';

type Device='phone'|'tablet'|'desktop';
const devices: Array<{id:Device;label:string;width:number}> = [
  {id:'phone',label:'Phone',width:390},
  {id:'tablet',label:'Tablet',width:820},
  {id:'desktop',label:'Desktop',width:1280},
];
const INK='#29262D', PURPLE='#7559B5', MUTED='#85808A';
export function WorkspacePreview({url,visible,onClose,workspaceId}:{
  url:string|null;visible:boolean;onClose:()=>void;workspaceId?:string|null;
}){
  const {width,height}=useWindowDimensions();
  const insets=useSafeAreaInsets();
  const [device,setDevice]=useState<Device>('phone');
  const [version,setVersion]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [server,setServer]=useState('');
  const [showLogs,setShowLogs]=useState(false);
  useEffect(()=>{if(visible&&url){setLoading(true);setError('');setVersion(v=>v+1);}},[visible,url]);
  useEffect(()=>{
    if(!visible||!showLogs||!workspaceId)return;
    let live=true;
    void managedWorkspace.previewStatus(workspaceId).then(s=>{if(live)setServer((s.output||'').slice(-5000)||s.status);})
      .catch(e=>{if(live)setServer(String(e?.message||e));});
    return()=>{live=false};
  },[visible,showLogs,workspaceId,version]);
  const selected=devices.find(d=>d.id===device)||devices[0]!;
  const contentWidth=Math.max(240,width-24);
  const scale=Math.min(1,contentWidth/selected.width);
  const frameHeight=Math.max(440,height-insets.top-insets.bottom-190)/scale;
  const wrappedWidth=selected.width*scale;
  const wrappedHeight=frameHeight*scale;
  // Generated Vite apps must not share the Noethara app's JS/storage origin.
  // A separate preview subdomain on the same noethara.cloud site lets Safari
  // send the HttpOnly SameSite=Strict preview cookie inside our iframe.
  const browserUrl=useMemo(()=>{
    if(!url||typeof window==='undefined')return null;
    try{
      const parsed=new URL(url);
      if(parsed.origin!=='https://terminal.noethara.cloud')return null;
      const parts=parsed.pathname.split('/');
      if(parts[1]!=='preview'||!/^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(parts[2]||''))return null;
      return 'https://preview.noethara.cloud'+parsed.pathname+parsed.search;
    }catch{return null;}
  },[url]);
  const canEmbed=Boolean(browserUrl);
  const open=()=>{if(browserUrl)void Linking.openURL(browserUrl)};
  const refresh=async()=>{
    setLoading(true);setError('');
    if(workspaceId){
      try{await managedWorkspace.startPreview(workspaceId);}
      catch(e){setError(String(e instanceof Error?e.message:e));}
    }
    setVersion(v=>v+1);
  };
  return <Modal visible={visible&&Boolean(url)} animationType="slide" onRequestClose={onClose}>
    <View style={[styles.root,{paddingTop:Math.max(insets.top,12),paddingBottom:Math.max(insets.bottom,12)}]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Close preview" onPress={onClose} style={styles.icon}>
          <Feather name="chevron-down" size={23} color={INK}/>
        </Pressable>
        <View style={{flex:1}}>
          <Text style={styles.title}>Live preview</Text>
          <Text style={styles.subtitle}>Vite · Browser preview</Text>
        </View>
        <Pressable accessibilityLabel="Show server logs" onPress={()=>setShowLogs(v=>!v)} style={styles.icon}>
          <Feather name="terminal" size={18} color={PURPLE}/>
        </Pressable>
        <Pressable accessibilityLabel="Refresh preview" onPress={()=>void refresh()} style={styles.icon}>
          <Feather name="refresh-cw" size={18} color={PURPLE}/>
        </Pressable>
        <Pressable accessibilityLabel="Open preview in separate tab" onPress={open} style={styles.icon}>
          <Feather name="external-link" size={18} color={PURPLE}/>
        </Pressable>
      </View>
      <View style={styles.devices}>
        {devices.map(d=><Pressable key={d.id} accessibilityLabel={d.label+' viewport'} onPress={()=>{setDevice(d.id);setLoading(true)}} style={[styles.device,device===d.id&&styles.selected]}>
          <Text style={[styles.deviceLabel,device===d.id&&{color:'#FFFFFF'}]}>{d.label}</Text>
        </Pressable>)}
      </View>
      <View style={styles.viewport}>
        {canEmbed&&browserUrl?React.createElement('div',{
          style:{width:wrappedWidth,height:wrappedHeight,overflow:'hidden',background:'#fff',margin:'0 auto',borderRadius:8},
        },React.createElement('iframe',{
          key:browserUrl+'-'+version+'-'+device,
          src:browserUrl,
          title:'Noethara generated app preview',
          onLoad:()=>setLoading(false),
          referrerPolicy:'no-referrer',
          style:{width:selected.width,height:frameHeight,border:0,display:'block',
            transform:'scale('+scale+')',transformOrigin:'top left',backgroundColor:'#ffffff'},
        })): <Text style={styles.notice}>Preview URL is not a recognized Noethara workspace link.</Text>}
        {loading&&canEmbed&&<View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color={PURPLE}/><Text style={styles.notice}>Loading preview…</Text>
        </View>}
      </View>
      {!!error&&<Text style={styles.error}>{error}</Text>}
      {showLogs&&<View style={styles.logBox}>
        <Text style={styles.logHeading}>Preview server logs</Text>
        <Text style={styles.logText} selectable>{server||'Checking the preview server…'}</Text>
      </View>}
      <View style={styles.footer}>
        <Text style={styles.hint}>If the preview is blank, open it in a new tab.</Text>
        <Pressable onPress={open} accessibilityRole="button" style={styles.button}>
          <Feather name="external-link" size={15} color="#FFFFFF"/>
          <Text style={styles.buttonText}>Open in browser</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#FCFAF7',gap:10},
  header:{paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:10},
  icon:{height:42,width:42,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:'#FFFFFF'},
  title:{fontSize:17,fontWeight:'700',color:INK},
  subtitle:{fontSize:11,color:MUTED,marginTop:2},
  devices:{flexDirection:'row',alignSelf:'center',padding:4,borderRadius:13,backgroundColor:'#EEEAF1',gap:4},
  device:{paddingHorizontal:16,paddingVertical:9,borderRadius:10},
  selected:{backgroundColor:PURPLE},
  deviceLabel:{fontSize:12,color:PURPLE,fontWeight:'600'},
  viewport:{flex:1,alignItems:'center',justifyContent:'flex-start',backgroundColor:'#E8E5E2',paddingTop:8,overflow:'hidden'},
  loading:{position:'absolute',top:18,backgroundColor:'#FFFFFF',padding:12,borderRadius:12,flexDirection:'row',gap:8,alignItems:'center'},
  notice:{fontSize:12,color:MUTED},
  error:{fontSize:12,color:'#A43C3C',paddingHorizontal:20},
  logBox:{marginHorizontal:14,backgroundColor:'#242126',padding:12,borderRadius:12,maxHeight:130},
  logHeading:{color:'#D2C2EC',fontSize:12,fontWeight:'600',marginBottom:6},
  logText:{fontSize:10,color:'#F3EDF7'},
  footer:{paddingHorizontal:16,gap:8},
  hint:{fontSize:11,color:MUTED},
  button:{backgroundColor:PURPLE,alignItems:'center',justifyContent:'center',padding:12,borderRadius:12,flexDirection:'row',gap:8},
  buttonText:{color:'#FFF',fontWeight:'700',fontSize:13},
});

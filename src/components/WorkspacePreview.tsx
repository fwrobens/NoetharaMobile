import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const INK='#29262D',PURPLE='#7559B5',MUTED='#85808A';
const NativeWebView=WebView as unknown as React.ComponentType<any>;
export function WorkspacePreview({url,visible,onClose}:{url:string|null;visible:boolean;onClose:()=>void}){
 const view=useRef<any>(null);
 const insets=useSafeAreaInsets();
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [progress,setProgress]=useState(0);
 const [version,setVersion]=useState(0);
 useEffect(()=>{if(visible&&url){setError('');setLoading(true);setProgress(0);}},[visible,url]);
 const reload=()=>{setError('');setLoading(true);setProgress(0);setVersion(x=>x+1);};
 return <Modal visible={visible&&Boolean(url)} animationType="slide" onRequestClose={onClose}>
  <View style={[styles.root,{paddingTop:insets.top,paddingBottom:Math.max(insets.bottom,8)}]}>
   <View style={styles.header}>
    <Pressable style={styles.back} onPress={onClose} accessibilityLabel="Close preview">
     <Feather name="chevron-down" size={24} color={INK}/>
    </Pressable>
    <View style={styles.heading}>
     <View style={styles.titleRow}><View style={styles.liveDot}/><Text style={styles.title}>Live preview</Text></View>
     <Text numberOfLines={1} style={styles.subtitle}>Vite · Managed workspace</Text>
    </View>
    <Pressable style={styles.reload} onPress={reload} accessibilityLabel="Reload preview">
     <Feather name="refresh-cw" size={18} color={PURPLE}/>
    </Pressable>
    <Pressable style={styles.reload} onPress={()=>{if(url)void Linking.openURL(url)}}
      accessibilityLabel="Open preview in browser">
     <Feather name="external-link" size={18} color={PURPLE}/>
    </Pressable>
   </View>
   <View style={styles.toolbar}>
    <Feather name="lock" size={13} color={MUTED}/>
    <Text style={styles.host} numberOfLines={1}>terminal.noethara.cloud / preview</Text>
    <View style={styles.deviceTag}><Feather name="smartphone" size={12} color={PURPLE}/>
     <Text style={styles.deviceText}>Mobile</Text></View>
   </View>
   <View style={styles.viewport}>
    {url&&<NativeWebView key={url+'-'+version} ref={view} source={{uri:url}}
     javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled={false}
     originWhitelist={['https://*']} setSupportMultipleWindows={false}
     onLoadStart={()=>{setLoading(true);setError('');}}
     onLoadProgress={(e:{nativeEvent:{progress:number}})=>setProgress(e.nativeEvent.progress)}
     onLoadEnd={()=>setLoading(false)}
     onHttpError={(e:{nativeEvent:{statusCode?:number;description?:string}})=>{
      setLoading(false);
      setError('The preview server returned HTTP '+(e.nativeEvent.statusCode||'error')+'. Check that npm install and Vite completed successfully.');
     }}
     onError={(e:{nativeEvent:{description?:string}})=>{
      setLoading(false);setError(e.nativeEvent.description||'Could not load preview');
     }}
     onContentProcessDidTerminate={()=>{setLoading(false);setError('The preview renderer stopped. Reload to retry.');}}
     startInLoadingState
     renderLoading={()=> <View style={styles.webLoading}><ActivityIndicator color={PURPLE}/></View>}
     style={styles.web}/>}
    {loading&&!error&&<View pointerEvents="none" style={styles.loadingBanner}>
      <ActivityIndicator size="small" color={PURPLE}/>
      <View style={{flex:1}}><Text style={styles.loadingTitle}>Opening your app…</Text>
       <Text style={styles.loadingDetail}>{Math.round(progress*100)}% · Connecting to Vite</Text></View>
     </View>}
    {!!error&&<View style={styles.errorOverlay}>
      <View style={styles.errorIcon}><Feather name="alert-circle" size={25} color="#B76763"/></View>
      <Text style={styles.errorTitle}>Preview couldn't load</Text>
      <Text style={styles.errorDescription}>{error}</Text>
      <Pressable onPress={reload} style={styles.retry}><Feather name="refresh-cw" size={17} color="#fff"/>
       <Text style={styles.retryText}>Try again</Text></Pressable>
    </View>}
   </View>
  </View>
 </Modal>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#FCFAF7'},
 header:{minHeight:65,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:8,
  borderBottomWidth:1,borderColor:'#E9E4E0'},
 back:{width:35,height:44,justifyContent:'center'},
 heading:{flex:1,minWidth:0},
 titleRow:{flexDirection:'row',alignItems:'center',gap:8},
 liveDot:{width:8,height:8,borderRadius:4,backgroundColor:'#29BD75'},
 title:{fontSize:17.5,fontWeight:'700',letterSpacing:-.4,color:INK},
 subtitle:{fontSize:11.5,color:MUTED,marginTop:3},
 reload:{height:38,width:38,alignItems:'center',justifyContent:'center',
  borderRadius:13,backgroundColor:'#F2EDF8'},
 toolbar:{height:43,flexDirection:'row',alignItems:'center',paddingHorizontal:19,
  borderBottomWidth:1,borderColor:'#EBE6E1',gap:8},
 host:{fontSize:12,color:MUTED,flex:1},
 deviceTag:{flexDirection:'row',gap:5,alignItems:'center',borderRadius:12,backgroundColor:'#F2EDF8',
  paddingHorizontal:9,paddingVertical:5},
 deviceText:{fontSize:11,color:PURPLE,fontWeight:'600'},
 viewport:{flex:1,position:'relative',backgroundColor:'#FFF'},
 web:{flex:1,backgroundColor:'#FFFFFF'},
 webLoading:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#FFFFFF'},
 loadingBanner:{position:'absolute',top:14,left:16,right:16,flexDirection:'row',gap:11,
  alignItems:'center',backgroundColor:'#F7F2FD',borderWidth:1,borderColor:'#E9E1F1',
  padding:13,borderRadius:14},
 loadingTitle:{fontSize:12.5,fontWeight:'600',color:INK},
 loadingDetail:{fontSize:11,color:MUTED,marginTop:3},
 errorOverlay:{...StyleSheet.absoluteFillObject,alignItems:'center',
  justifyContent:'center',paddingHorizontal:34,backgroundColor:'#FCFAF7'},
 errorIcon:{height:54,width:54,borderRadius:18,backgroundColor:'#FCF0EF',
  alignItems:'center',justifyContent:'center',marginBottom:16},
 errorTitle:{fontSize:20,fontWeight:'700',color:INK,letterSpacing:-.5},
 errorDescription:{color:MUTED,fontSize:13.5,lineHeight:21,textAlign:'center',marginTop:12},
 retry:{marginTop:24,height:46,borderRadius:14,backgroundColor:INK,
  flexDirection:'row',gap:9,alignItems:'center',paddingHorizontal:22},
 retryText:{color:'#fff',fontSize:14,fontWeight:'600'}
});

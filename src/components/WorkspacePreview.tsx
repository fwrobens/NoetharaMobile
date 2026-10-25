import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const NativeWebView=WebView as unknown as React.ComponentType<any>;
export function WorkspacePreview({url,visible,onClose}:{url:string|null;visible:boolean;onClose:()=>void}){
 const view=useRef<any>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 return <Modal visible={visible&&Boolean(url)} animationType="slide" onRequestClose={onClose}>
  <View style={styles.root}>
   <View style={styles.header}>
    <Pressable style={styles.back} onPress={onClose} accessibilityLabel="Close preview">
      <Feather name="chevron-down" size={24} color="#2B272F"/>
    </Pressable>
    <View style={{flex:1}}>
      <Text style={styles.title}>Live preview</Text>
      <Text style={styles.subtitle}>Vite · Noethara managed workspace</Text>
    </View>
    <Pressable style={styles.reload} onPress={()=>{setLoading(true);view.current?.reload()}}
      accessibilityLabel="Reload preview"><Feather name="refresh-cw" color="#7465A0" size={19}/></Pressable>
   </View>
   {url&&<NativeWebView ref={view} source={{uri:url}}
     javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled={false}
     originWhitelist={['https://*']}
     onLoadStart={()=>{setLoading(true);setError('')}}
     onLoadEnd={()=>setLoading(false)}
     onError={(e:{nativeEvent:{description?:string}})=>{setLoading(false);setError(e.nativeEvent.description||'Could not load preview')}}
     startInLoadingState
     renderLoading={()=> <View style={styles.loading}><ActivityIndicator color="#7654C8"/></View>}
     style={styles.web}/>}
   {loading&&<View style={styles.status}><ActivityIndicator size="small" color="#7654C8"/>
     <Text style={styles.statusText}>Loading preview…</Text></View>}
   {!!error&&<View style={styles.status}><Feather name="alert-circle" size={15} color="#B6675E"/>
     <Text style={styles.error}>{error}</Text></View>}
  </View>
 </Modal>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#FCFAF7'},
 header:{height:81,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:10,
   borderBottomWidth:1,borderColor:'#EAE6E1'},
 back:{width:35,height:41,justifyContent:'center'},
 title:{fontSize:19,fontWeight:'700',color:'#29262B'},
 subtitle:{fontSize:11.5,color:'#8B878E',marginTop:4},
 reload:{height:38,width:38,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:'#F4F0F9'},
 web:{flex:1,backgroundColor:'#FFFFFF'},
 status:{flexDirection:'row',gap:9,alignItems:'center',paddingVertical:9,paddingHorizontal:18},
 statusText:{fontSize:12,color:'#8B868F'},
 error:{color:'#B6675E',fontSize:12,flex:1},
 loading:{flex:1,justifyContent:'center',alignItems:'center'},
});
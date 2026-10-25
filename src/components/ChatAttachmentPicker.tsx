import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

export type ChatAttachment={name:string;type:string;data:string;text?:string};
const INK='#27242A',MUTED='#89828A',ACCENT='#7255B9';
const sourceExtensions=/\.(?:ts|tsx|js|jsx|json|md|txt|css|html|mjs|cjs)$/i;
const icon=(name:React.ComponentProps<typeof Feather>['name'],size=21,color=INK)=>
 <Feather name={name} size={size} color={color}/>;

export function ChatAttachmentPicker({visible,onClose,onPicked,onError}:{
 visible:boolean;onClose:()=>void;onPicked:(file:ChatAttachment)=>void;onError:(message:string)=>void;
}){
 const insets=useSafeAreaInsets();
 const [busy,setBusy]=useState(false);
 async function photo(){
  setBusy(true);
  try{
   const picked=await ImagePicker.launchImageLibraryAsync({
    mediaTypes:['images'],quality:0.55,base64:true,allowsMultipleSelection:false
   });
   if(picked.canceled||!picked.assets?.length)return;
   const image=picked.assets[0];
   if(!image.base64)throw Error('The photo could not be read. Choose another image.');
   if(image.base64.length>1600000)throw Error('Image is too large to attach (1.2 MB max after compression).');
   onPicked({name:(image.fileName||'photo.jpg').slice(0,100).replace(/\.[^.]+$/,'.jpg'),
     type:'image/jpeg',data:image.base64});
   onClose();
  }catch(e){onError(e instanceof Error?e.message:'Could not open Photos');}
  finally{setBusy(false);}
 }
 async function file(){
  setBusy(true);
  try{
   const picked=await DocumentPicker.getDocumentAsync({
    type:['text/plain','application/json','text/markdown','text/css','text/html',
      'application/javascript','text/javascript','image/png','image/jpeg','image/webp',
      'public.source-code','public.text'],
    copyToCacheDirectory:true,multiple:false
   });
   if(picked.canceled||!picked.assets?.length)return;
   const asset=picked.assets[0];
   const entry=new File(asset.uri);
   if(!entry.exists)throw Error('Selected file is unavailable.');
   const isImage=/\.(?:png|jpe?g|webp)$/i.test(asset.name)||asset.mimeType?.startsWith('image/');
   if(!isImage&&!sourceExtensions.test(asset.name))throw Error('Choose a source, text, JSON, CSS, HTML or image file.');
   if(entry.size>(isImage?1200000:100000))throw Error(isImage?
     'Image is too large (1.2 MB max). Use Photos to compress it.':'Source file exceeds 100 KB.');
   const data=await entry.base64();
   const ext=asset.name.toLowerCase().split('.').pop()||'';
   const type=isImage?(ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg'):
     ext==='json'?'application/json':ext==='css'?'text/css':ext==='html'?'text/html':
     ext==='js'?'text/javascript':'text/plain';
   const text=isImage?undefined:await entry.text();
   onPicked({name:asset.name.slice(0,100),type,data,text});
   onClose();
  }catch(e){onError(e instanceof Error?e.message:'Could not read selected file');}
  finally{setBusy(false);}
 }
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <View style={styles.overlay}>
   <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close attachment sheet"/>
   <View style={[styles.sheet,{paddingBottom:Math.max(insets.bottom,20)+16}]}>
    <View style={styles.grabber}/>
    <View style={styles.header}>
     <View><Text style={styles.eyebrow}>PROJECT CONTEXT</Text>
      <Text style={styles.title}>Add attachment</Text></View>
     <Pressable onPress={onClose} style={styles.close} accessibilityLabel="Close">
      {icon('x',20)}
     </Pressable>
    </View>
    <Text style={styles.caption}>Attach images and source files to your workspace. Up to 4 per message.</Text>
    <Pressable disabled={busy} onPress={()=>void photo()} style={styles.option} accessibilityLabel="Choose a photo">
     <View style={styles.optionIcon}>{icon('image',22,ACCENT)}</View>
     <View style={styles.optionContent}><Text style={styles.optionTitle}>Photo library</Text>
      <Text style={styles.optionHint}>Screenshots and design references</Text></View>
     {icon('chevron-right',19,MUTED)}
    </Pressable>
    <Pressable disabled={busy} onPress={()=>void file()} style={styles.option} accessibilityLabel="Browse device files">
     <View style={styles.optionIcon}>{icon('file-text',22,ACCENT)}</View>
     <View style={styles.optionContent}><Text style={styles.optionTitle}>Browse Files</Text>
      <Text style={styles.optionHint}>Code, JSON, text and images</Text></View>
     {icon('chevron-right',19,MUTED)}
    </Pressable>
    {busy&&<View style={styles.wait}><ActivityIndicator color={ACCENT}/>
      <Text style={styles.waitText}>Preparing attachment…</Text></View>}
   </View>
  </View>
 </Modal>;
}
const styles=StyleSheet.create({
 overlay:{flex:1,backgroundColor:'rgba(31,26,32,.35)',justifyContent:'flex-end'},
 sheet:{backgroundColor:'#FCFAF7',borderTopLeftRadius:30,borderTopRightRadius:30,
  paddingHorizontal:22,paddingTop:10,borderWidth:1,borderColor:'#FFFFFF',
  shadowColor:'#322B39',shadowOpacity:0.15,shadowRadius:24},
 grabber:{width:40,height:4,borderRadius:3,alignSelf:'center',backgroundColor:'#DBD6D1',marginBottom:20},
 header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},
 eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:1.6,color:ACCENT,marginBottom:6},
 title:{fontSize:23,fontWeight:'700',letterSpacing:-0.6,color:INK},
 close:{width:39,height:39,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:'#F2EFEA'},
 caption:{fontSize:13.5,lineHeight:21,color:MUTED,marginBottom:20},
 option:{flexDirection:'row',alignItems:'center',padding:14,borderWidth:1,borderColor:'#E7E1DD',
  backgroundColor:'#FFFFFF',borderRadius:18,marginBottom:12,minHeight:82,gap:13},
 optionIcon:{width:48,height:48,borderRadius:15,backgroundColor:'#F3EEF9',
  alignItems:'center',justifyContent:'center'},
 optionContent:{flex:1,gap:5},optionTitle:{color:INK,fontSize:15.5,fontWeight:'600'},
 optionHint:{fontSize:12.5,color:MUTED},
 wait:{flexDirection:'row',gap:10,paddingVertical:12,alignItems:'center',justifyContent:'center'},
 waitText:{fontSize:12,color:MUTED}
});

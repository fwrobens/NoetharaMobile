import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
// WKWebView file inputs use native iOS Files/Photos UI with an actual user tap.
export type ChatAttachment={name:string;type:string;data:string;text?:string};
const html="<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:\">\n<style>*{box-sizing:border-box}body{margin:0;background:#FCFAF7;font:15px -apple-system,BlinkMacSystemFont,sans-serif}\nlabel{height:55px;display:flex;align-items:center;padding:0 18px;margin:5px 0;border:1px solid #e6e0dc;border-radius:14px;background:#fff;color:#29252c;font-weight:600}\nlabel span{color:#7654c8;margin-right:12px;font-size:20px}input{display:none}</style></head><body>\n<label for=\"photo\"><span>▧</span> Photo or image</label><input id=\"photo\" type=\"file\" accept=\"image/jpeg,image/png,image/webp\">\n<label for=\"file\"><span>▤</span> Browse Files</label><input id=\"file\" type=\"file\" accept=\".ts,.tsx,.js,.jsx,.json,.txt,.md,.css,.html,image/png,image/jpeg,image/webp\">\n<script>\nconst native=window.ReactNativeWebView;const report=o=>native.postMessage(JSON.stringify(o));\nfor(const picker of document.querySelectorAll('input')){\n picker.addEventListener('change',async function(){\n  const f=this.files&&this.files[0];if(!f)return;\n  try{\n   let type=f.type||'text/plain',data='';\n   if(f.type.startsWith('image/')){\n    if(f.size>8000000)throw Error('Image is too large (8 MB max)');\n    const img=new Image(),blobUrl=URL.createObjectURL(f);\n    try{\n     await new Promise((yes,no)=>{img.onload=yes;img.onerror=()=>no(Error('Image cannot be loaded'));img.src=blobUrl;});\n     const canvas=document.createElement('canvas');\n     const scale=Math.min(1,1152/Math.max(img.width,img.height));\n     canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));\n     canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);\n     const result=canvas.toDataURL('image/jpeg',.68);\n     data=result.split(',')[1];type='image/jpeg';\n    }finally{URL.revokeObjectURL(blobUrl)}\n   }else{\n    if(f.size>100000)throw Error('Text file exceeds 100 KB');\n    const buffer=new Uint8Array(await f.arrayBuffer());\n    let binary='';for(let i=0;i<buffer.length;i++)binary+=String.fromCharCode(buffer[i]);data=btoa(binary);\n   }\n   report({type:'file',attachment:{name:f.name.slice(0,100),type,data,text:type.startsWith('text/')||type==='application/json'?await f.text():undefined}});\n  }catch(e){report({type:'error',message:String(e&&e.message||e)})}\n  this.value='';\n });\n}\n</script></body></html>";
const NativeWebView=WebView as unknown as React.ComponentType<any>;
export function ChatAttachmentPicker({visible,onClose,onPicked,onError}:{
 visible:boolean;onClose:()=>void;onPicked:(file:ChatAttachment)=>void;onError:(message:string)=>void;
}){
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <View style={styles.overlay}><View style={styles.sheet}>
    <View style={styles.header}><Text style={styles.title}>Add attachment</Text>
      <Pressable onPress={onClose} accessibilityLabel="Close attachment picker">
       <Feather name="x" size={22} color="#38343B"/>
      </Pressable></View>
    <Text style={styles.caption}>Choose a photo or source file from your iPhone.</Text>
    <NativeWebView source={{html}} onMessage={(event:{nativeEvent:{data:string}})=>{
      try{const packet=JSON.parse(event.nativeEvent.data);
       if(packet.type==='file'){onPicked(packet.attachment);onClose();}
       else if(packet.type==='error')onError(packet.message||'Cannot read selected file');
      }catch{onError('Could not read attachment');}
    }} javaScriptEnabled originWhitelist={['*']} scrollEnabled={false}
      onShouldStartLoadWithRequest={(request:{url:string})=>request.url==='about:blank'}
      style={styles.picker}/>
  </View></View>
 </Modal>;
}
const styles=StyleSheet.create({
 overlay:{flex:1,backgroundColor:'rgba(20,19,23,.38)',justifyContent:'flex-end'},
 sheet:{borderTopLeftRadius:25,borderTopRightRadius:25,backgroundColor:'#FCFAF7',
  paddingHorizontal:21,paddingTop:22,paddingBottom:36},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 title:{color:'#29252B',fontWeight:'700',fontSize:20},
 caption:{color:'#817C83',fontSize:12.5,marginTop:9,marginBottom:15},
 picker:{height:148,backgroundColor:'#FCFAF7'},
});
import React, { useEffect, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type LocalFile = { name: string; content: string; savedAt: number };
const KEY = '@noethara:playground-files';
const samples: LocalFile[] = [
  { name:'index.tsx',savedAt:0,content:`import React from 'react';
import { View, Text } from 'react-native';

export default function Welcome() {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Text>Build something wonderful ✨</Text>
    </View>
  );
}
` },
  { name:'theme.ts',savedAt:0,content:`export const theme = {
  background: '#FAF9F6',
  surface: '#FFFFFF',
  accent: '#7355C7',
  text: '#232126',
  radius: 18,
};
` },
  { name:'README.md',savedAt:0,content:`# Local Playground

This editor saves changes to your device.

• Tap a file to edit.
• Save to persist your edits.
• Create new files for experiments.

This does NOT run terminal commands or push GitHub code.
` },
];
export function LocalPlayground({ onBack, onChat }: { onBack:()=>void;onChat:()=>void }) {
  const [files,setFiles]=useState<LocalFile[]>(samples);
  const [current,setCurrent]=useState('index.tsx');
  const [code,setCode]=useState(samples[0].content);
  const [dirty,setDirty]=useState(false);
  const [state,setState]=useState('Device storage');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{void AsyncStorage.getItem(KEY).then(value=>{
    if(value) {
      const items=JSON.parse(value) as LocalFile[];
      if(Array.isArray(items)&&items.length) {
        setFiles(items);
        setCurrent(items[0].name);
        setCode(items[0].content);
      }
    }
  }).catch(()=>setState('Local storage unavailable')).finally(()=>setLoading(false));},[]);
  const select=(file:LocalFile)=>{
    if(dirty) {
      Alert.alert('Unsaved changes','Save your changes or discard them before switching files.',[
        {text:'Cancel',style:'cancel'},{text:'Discard',style:'destructive',onPress:()=>{setCurrent(file.name);setCode(file.content);setDirty(false);}},
        {text:'Save',onPress:()=>void saveAndSelect(file)}
      ]);
    }else{setCurrent(file.name);setCode(file.content);setDirty(false);}
  };
  const save = async () => {
    const updated=files.map(x=>x.name===current?{...x,content:code,savedAt:Date.now()}:x);
    await AsyncStorage.setItem(KEY,JSON.stringify(updated));
    setFiles(updated);setDirty(false);setState('Saved on this iPhone');
  };
  const saveAndSelect = async(file:LocalFile)=>{await save();setCurrent(file.name);setCode(file.content);setDirty(false);};
  const create = () => {
    Alert.prompt('New local file','Enter a file name (example: App.tsx)', value=>{
      const name=(value||'').trim().replace(/[^\w.-]/g,'');
      if(!name || name.length>80){Alert.alert('Invalid name','Use letters, numbers, underscores, hyphens or periods.');return;}
      if(files.some(f=>f.name===name)){Alert.alert('Already exists','Choose another name.');return;}
      const file={name,content:'// '+name+'\n',savedAt:Date.now()};
      const next=[...files,file];
      void AsyncStorage.setItem(KEY,JSON.stringify(next)).then(()=>{setFiles(next);setCurrent(name);setCode(file.content);setDirty(false);setState('New file created');});
    });
  };
  const remove = () => {
    Alert.alert('Delete '+current+'?','This deletes only the local copy stored on your device.',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete',style:'destructive',onPress:()=> {
        const rest=files.filter(x=>x.name!==current);
        const next=rest.length?rest:[{name:'index.tsx',content:'',savedAt:0}];
        void AsyncStorage.setItem(KEY,JSON.stringify(next)).then(()=>{setFiles(next);setCurrent(next[0].name);setCode(next[0].content);setDirty(false);setState('Local file deleted');});
      }},
    ]);
  };
  return (
    <LinearGradient colors={['#FCFAF8','#F9F7F4','#F6F4F1']} style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.headerIcon} onPress={()=>{Keyboard.dismiss();onBack();}}><Feather name="chevron-left" size={26} color="#29262D"/></Pressable>
        <View style={{flex:1}}><Text style={styles.title}>Playground</Text><Text style={styles.muted}>Local code editor</Text></View>
        <Pressable style={styles.headerIcon} onPress={create}><Feather name="plus" size={23} color="#7355C7"/></Pressable>
      </View>
      <View style={styles.notice}><Feather name="hard-drive" size={15} color="#7355C7"/><Text style={styles.noticeText}>Editable files saved locally · No cloud workspace required</Text></View>
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {files.map(file=><Pressable key={file.name} onPress={()=>select(file)}
            style={[styles.tab,current===file.name&&styles.selectedTab]}>
            <Feather name={file.name.endsWith('.md')?'file-text':'code'} size={15} color={current===file.name?'#7054BE':'#9B98A1'}/>
            <Text style={[styles.tabText,current===file.name&&styles.selectedTabText]} numberOfLines={1}>{file.name}</Text>
            {dirty&&current===file.name&&<View style={styles.dot}/>}
          </Pressable>)}
        </ScrollView>
      </View>
      <View style={styles.codePanel}>
        <View style={styles.codeToolbar}>
          <View style={styles.editorDots}><View style={[styles.circle,{backgroundColor:'#F0AEAD'}]}/><View style={[styles.circle,{backgroundColor:'#EFD7A5'}]}/><View style={[styles.circle,{backgroundColor:'#B3DFB8'}]}/></View>
          <Text style={styles.fileTitle}>{current}</Text>
          <Text style={styles.lang}>UTF-8</Text>
        </View>
        <ScrollView style={styles.editorScroll} keyboardDismissMode="interactive" keyboardShouldPersistTaps="always" contentContainerStyle={{flexGrow:1}}>
          <TextInput
            multiline
            value={code}
            onChangeText={value=>{setCode(value);setDirty(true);setState('Unsaved changes');}}
            textAlignVertical="top"
            selectionColor="#947DE2"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={styles.editor}
            placeholder="Start writing code…"
            placeholderTextColor="#A6A1AC"
          />
        </ScrollView>
        <View style={styles.codeFooter}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Feather name="circle" size={9} color={dirty?'#D69A2E':'#36B767'}/><Text style={styles.footerText}>{state}</Text></View>
          <Text style={styles.footerText}>{code.split('\n').length} lines · {code.length} characters</Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <Pressable onPress={remove} style={styles.delete}><Feather name="trash-2" size={18} color="#9D6A6A"/></Pressable>
        <Pressable onPress={onChat} style={styles.chat}><Feather name="message-square" size={17} color="#7355C7"/><Text style={styles.chatText}>Ask AI</Text></Pressable>
        <Pressable onPress={()=>void save().catch(()=>Alert.alert('Save failed','Could not save to device storage.'))} style={styles.save}>
          <Feather name="save" size={18} color="#FFFFFF"/><Text style={styles.saveText}>{dirty?'Save changes':'Saved'}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}
const styles=StyleSheet.create({
 root:{flex:1,paddingBottom:12},header:{height:70,flexDirection:'row',alignItems:'center',paddingHorizontal:19,gap:11},
 headerIcon:{padding:8},title:{fontSize:22,fontWeight:'700',color:'#29262D'},muted:{color:'#A39EA6',fontSize:12,marginTop:3},
 notice:{flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:18,paddingVertical:11,marginHorizontal:18,marginTop:9,backgroundColor:'#F2EDF9',borderRadius:13},
 noticeText:{fontSize:11.5,color:'#7E6D8D',flex:1},
 tabsWrap:{marginTop:18,paddingLeft:19},tabs:{gap:9,paddingRight:19,paddingVertical:4},
 tab:{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:11,paddingHorizontal:13,backgroundColor:'#F1EEEC',borderRadius:11,maxWidth:176},
 selectedTab:{backgroundColor:'#FFFFFF',borderColor:'#E9E4E1',borderWidth:1},tabText:{fontSize:12.5,color:'#8B8790',fontWeight:'500'},selectedTabText:{color:'#27242B',fontWeight:'700'},
 dot:{width:6,height:6,borderRadius:4,backgroundColor:'#D2A34D'},
 codePanel:{flex:1,marginHorizontal:19,marginTop:12,backgroundColor:'#FFFFFF',borderRadius:21,borderWidth:1,borderColor:'#EFEBE8',overflow:'hidden',
 shadowColor:'#9A8A82',shadowOpacity:0.08,shadowOffset:{width:0,height:8},shadowRadius:16},
 codeToolbar:{height:53,paddingHorizontal:16,backgroundColor:'#F9F8F7',borderBottomWidth:1,borderBottomColor:'#EEEAE7',flexDirection:'row',alignItems:'center',gap:13},
 editorDots:{flexDirection:'row',gap:6},circle:{width:8,height:8,borderRadius:6},fileTitle:{fontSize:12,color:'#5E5862',flex:1,fontWeight:'600'},lang:{fontSize:10,color:'#ABA5B0'},
 editorScroll:{flex:1},editor:{color:'#35303B',fontFamily:'monospace',fontSize:13.5,lineHeight:21,padding:17,minHeight:290},
 codeFooter:{height:44,paddingHorizontal:15,borderTopWidth:1,borderColor:'#EEEAE7',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 footerText:{fontSize:10.5,color:'#918B94'},actionRow:{flexDirection:'row',marginTop:15,marginHorizontal:20,gap:9,height:50},
 delete:{width:52,borderWidth:1,borderColor:'#E5DCDB',borderRadius:13,alignItems:'center',justifyContent:'center'},
 chat:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderRadius:13,backgroundColor:'#EEEAF7',paddingHorizontal:18},
 chatText:{color:'#7355C7',fontWeight:'600',fontSize:13},save:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#272529',borderRadius:13},
 saveText:{color:'#FFFFFF',fontSize:14,fontWeight:'700'},
});

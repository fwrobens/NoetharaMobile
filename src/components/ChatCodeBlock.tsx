import React, { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

export function ChatCodeBlock({code,language='code'}:{code:string;language?:string}){
 const [expanded,setExpanded]=useState(code.length<2200);
 const label=language.trim().split(' ')[0].toLowerCase().slice(0,16)||'code';
 const shown=expanded?code:code.slice(0,1900)+'\n…';
 return <View style={styles.card}>
  <View style={styles.header}>
   <View style={styles.language}><View style={styles.dot}/><Text style={styles.label}>{label}</Text></View>
   <View style={styles.actions}>
    <Pressable accessibilityLabel="Share code" onPress={()=>void Share.share({message:code})}
      style={styles.action}><Feather name="share-2" color="#BFB8C7" size={15}/><Text style={styles.actionLabel}>Share</Text></Pressable>
    {code.length>=2200&&<Pressable accessibilityLabel={expanded?'Collapse code':'Expand code'}
      onPress={()=>setExpanded(!expanded)} style={styles.action}>
      <Feather name={expanded?'minimize-2':'maximize-2'} color="#BFB8C7" size={15}/>
      <Text style={styles.actionLabel}>{expanded?'Less':'Expand'}</Text>
    </Pressable>}
   </View>
  </View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled
    contentContainerStyle={styles.codeArea}>
   <Text selectable style={styles.code}>{shown}</Text>
  </ScrollView>
  <View style={styles.footer}><Text style={styles.size}>{code.split('\n').length} lines · {code.length} characters</Text></View>
 </View>;
}
const styles=StyleSheet.create({
 card:{backgroundColor:'#242228',borderWidth:1,borderColor:'#38343E',borderRadius:16,
   overflow:'hidden',marginTop:8,marginBottom:15},
 header:{height:42,paddingHorizontal:12,backgroundColor:'#2D2A31',
   flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 language:{flexDirection:'row',alignItems:'center',gap:8},
 dot:{width:7,height:7,borderRadius:4,backgroundColor:'#9F83E4'},
 label:{fontSize:11,fontWeight:'700',color:'#E1DAE8',letterSpacing:0.25},
 actions:{flexDirection:'row',gap:8},
 action:{flexDirection:'row',gap:5,padding:6,alignItems:'center'},
 actionLabel:{fontSize:10.5,color:'#C9C1CE'},
 codeArea:{paddingVertical:14,paddingHorizontal:15,minWidth:'100%'},
 code:{fontSize:12.3,lineHeight:20,color:'#E8E3EB',fontFamily:'monospace'},
 footer:{height:25,paddingHorizontal:13,justifyContent:'center',borderTopWidth:1,borderColor:'#38343E'},
 size:{fontSize:9.5,color:'#938C9B'},
});

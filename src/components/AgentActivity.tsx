import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

export type AgentEvent={id:number;kind:string;message:string;at:number};
const INK='#29252D',MUTED='#89848B',PURPLE='#7457B5';
const labels:Record<string,string>={
 read:'Reading',write:'Writing',command:'Command',preview:'Preview',error:'Needs attention',
 result:'Completed',commentary:'Update',progress:'Working',paused:'Paused',done:'Finished'
};
const symbols:Record<string,React.ComponentProps<typeof Feather>['name']>={
 read:'file-text',write:'edit-3',command:'terminal',preview:'monitor',error:'alert-circle',
 result:'check',commentary:'message-circle',progress:'loader',paused:'pause-circle',done:'check-circle'
};
export function AgentActivity({events,busy,headline,onContinue,continuable}:{
 events:AgentEvent[];busy:boolean;headline:string;onContinue?:()=>void;continuable?:boolean;
}){
 const [expanded,setExpanded]=useState(false);
 if(!busy&&!events.length&&!headline)return null;
 const meaningful=events.filter(e=>!['progress'].includes(e.kind));
 const last=meaningful.at(-1);
 const primary=(last?.message||headline||'Preparing your workspace').slice(0,180);
 const done=last?.kind==='done',failed=last?.kind==='error'||last?.kind==='paused';
 return <View style={styles.root}>
  <Pressable style={styles.header} onPress={()=>setExpanded(v=>!v)}
   accessibilityRole="button" accessibilityLabel={expanded?'Collapse agent activity':'Expand agent activity'}>
   <View style={[styles.pulse,{backgroundColor:failed?'#BD756C':busy?'#9C80D0':'#65AA8C'}]}>
    {busy?<ActivityIndicator color="#FFF" size="small"/>:
      <Feather name={failed?'alert-circle':'check'} color="#FFF" size={13}/>}
   </View>
   <View style={{flex:1,minWidth:0}}>
    <Text style={styles.heading}>{busy?'Noethara is working':failed?'Agent needs attention':done?'Work complete':'Agent activity'}</Text>
    <Text style={styles.subtitle} numberOfLines={expanded?3:2}>{primary}</Text>
   </View>
   <View style={styles.expand}>
    <Text style={styles.count}>{meaningful.length} events</Text>
    <Feather name={expanded?'chevron-up':'chevron-down'} size={18} color={MUTED}/>
   </View>
  </Pressable>
  {expanded&&<View style={styles.timeline}>
   {meaningful.slice(-35).map((e,i)=><View key={e.id+'-'+i} style={styles.event}>
    <View style={styles.track}>
     <View style={[styles.symbol,e.kind==='error'&&styles.symbolError]}>
      <Feather name={symbols[e.kind]||'circle'} size={14}
       color={e.kind==='error'?'#BE6F65':PURPLE}/>
     </View>
     {i<Math.min(35,meaningful.length)-1&&<View style={styles.rail}/>}
    </View>
    <View style={styles.eventContent}>
     <Text style={styles.label}>{labels[e.kind]||'Update'}</Text>
     <Text style={styles.message} selectable>{e.message.slice(0,950)}</Text>
    </View>
   </View>)}
  </View>}
  {continuable&&<Pressable onPress={onContinue} style={styles.continue}
   accessibilityRole="button" accessibilityLabel="Continue coding session">
   <Feather name="play" size={14} color={PURPLE}/>
   <Text style={styles.continueText}>Continue from saved files</Text>
   <Feather name="arrow-up-right" size={15} color={PURPLE}/>
  </Pressable>}
 </View>;
}
const styles=StyleSheet.create({
 root:{marginTop:9,marginBottom:23,paddingHorizontal:1},
 header:{flexDirection:'row',alignItems:'center',gap:12,minHeight:60},
 pulse:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center'},
 heading:{color:INK,fontSize:13.5,fontWeight:'700',letterSpacing:-.1},
 subtitle:{color:MUTED,fontSize:12.5,lineHeight:19,marginTop:4},
 expand:{flexDirection:'row',gap:7,alignItems:'center',padding:7},
 count:{fontSize:10.5,color:'#AAA4AC'},
 timeline:{marginLeft:13,marginTop:8,paddingBottom:4},
 event:{flexDirection:'row',gap:15,minHeight:50},
 track:{width:21,alignItems:'center'},
 symbol:{height:24,width:24,borderRadius:12,alignItems:'center',justifyContent:'center',
  backgroundColor:'#F0EBF8'},
 symbolError:{backgroundColor:'#FAEEEE'},
 rail:{width:1,backgroundColor:'#E1DAE5',flex:1,minHeight:16,marginVertical:3},
 eventContent:{flex:1,paddingBottom:16,minWidth:0},
 label:{fontSize:11,fontWeight:'700',color:'#68616D',letterSpacing:.1,marginBottom:4},
 message:{color:'#777079',fontSize:12.5,lineHeight:19},
 continue:{alignSelf:'flex-start',marginTop:10,marginLeft:39,
  flexDirection:'row',gap:9,alignItems:'center',paddingVertical:11,paddingHorizontal:15,
  borderRadius:16,backgroundColor:'#F1ECF8'},
 continueText:{fontSize:12.5,fontWeight:'700',color:PURPLE}
});

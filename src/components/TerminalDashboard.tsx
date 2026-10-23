import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getSession } from '../lib/noetharaBackend';

type Agent='opencode'|'codex'|'claude';
type State='checking'|'awake'|'offline';
const agents: Array<{id:Agent;title:string;description:string;
  symbol:React.ComponentProps<typeof Feather>['name'];color:string}> = [
  {id:'claude',title:'Claude Code',description:'Agent CLI',symbol:'sun',color:'#DA8864'},
  {id:'codex',title:'Codex',description:'Code CLI',symbol:'terminal',color:'#8B91FC'},
  {id:'opencode',title:'OpenCode',description:'Open-source CLI',symbol:'code',color:'#B6A4ED'},
];
const Icon=({name,size=20,color='#242326'}:{
  name:React.ComponentProps<typeof Feather>['name'];size?:number;color?:string;
})=><Feather name={name} size={size} color={color}/>;
const HOST='https://terminal.noethara.cloud';
export function TerminalDashboard({onBack,onAgent}:{
  onBack:()=>void;onAgent:(agent:Agent)=>void;
}) {
  const [state,setState]=useState<State>('checking');
  const [message,setMessage]=useState('');
  async function refresh(){
    setState('checking');setMessage('');
    try{
      const session=await getSession();
      if(!session?.access_token){setMessage('Sign in to access your Noethara Linux workspace.');setState('offline');return;}
      const abort=new AbortController();
      const timeout=setTimeout(()=>abort.abort(),7000);
      try {
        const r=await fetch(HOST+'/status',{
          headers:{authorization:'Bearer '+session.access_token},
          signal:abort.signal,
        });
        if(r.ok){setState('awake');return;}
        setMessage(r.status===401?'Your account is not authorized for this workspace.':
          'The Linux workspace is not available yet.');
      } finally {clearTimeout(timeout);}
    }catch{
      setMessage('The managed Linux server is not reachable yet.');
    }
    setState('offline');
  }
  useEffect(()=>{void refresh();},[]);
  return <View style={styles.root}>
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityLabel="Back" style={styles.topControl}>
        <Icon name="chevron-down" size={25}/>
      </Pressable>
      <Text style={styles.headerTitle}>Terminals</Text>
      <Pressable onPress={()=>void refresh()} style={[styles.statusPill,state==='awake'&&styles.statusPillAwake]} accessibilityLabel="Refresh Linux workspace status">
        {state==='checking'?<ActivityIndicator size="small" color="#91AF96"/>:
          <View style={[styles.liveDot,{backgroundColor:state==='awake'?'#37CC79':'#8F8E95'}]}/>}
        <Text style={[styles.pillText,{color:state==='awake'?'#207C4D':'#777578'}]}>
          {state==='awake'?'Awake':state==='checking'?'Checking':'Offline'}
        </Text>
      </Pressable>
      <Pressable onPress={()=>void refresh()} style={styles.topControl} accessibilityLabel="Refresh">
        <Icon name="more-horizontal" size={23} color="#6A6768"/>
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Your shortcuts</Text>
        <Pressable onPress={()=>onAgent('opencode')} style={styles.addButton}>
          <Icon name="plus" size={22} color="#666268"/>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
        {agents.map(item=><Pressable key={item.id} style={styles.agentCard} onPress={()=>onAgent(item.id)}>
          <View style={styles.agentTop}>
            <View style={styles.agentBadge}><Icon name={item.symbol} size={22} color={item.color}/></View>
            <Icon name="arrow-up-right" size={17} color="#8C8887"/>
          </View>
          <View>
            <Text style={styles.agentTitle}>{item.title}</Text>
            <Text style={styles.agentMeta}>{item.description}</Text>
          </View>
        </Pressable>)}
      </ScrollView>

      <View style={[styles.sectionHeading,{marginTop:30}]}>
        <Text style={styles.sectionTitle}>Projects</Text>
        <Text style={styles.muted}>Managed Linux</Text>
      </View>
      <Pressable style={styles.projectCard} onPress={()=>onAgent('opencode')}>
        <View style={styles.projectIcon}><Icon name="folder" size={23} color="#767377"/></View>
        <View style={styles.projectDetails}>
          <Text style={styles.projectTitle}>Noethara workspace</Text>
          <Text style={styles.projectPath}>Your persistent Linux environment</Text>
          <Text style={styles.projectSub}>{state==='awake'?'Server connected · Open a CLI session':'Awaiting secure server connection'}</Text>
        </View>
        <Icon name="chevron-right" size={23} color="#8B8888"/>
      </Pressable>

      <View style={[styles.sectionHeading,{marginTop:34}]}>
        <Text style={styles.sectionTitle}>Recent projects</Text>
      </View>
      <View style={styles.recentEmpty}>
        <Icon name="layers" size={21} color="#817F80"/>
        <Text style={styles.recentText}>Project history will appear when workspace synchronization is available.</Text>
      </View>
      {state==='offline'&&!!message&&
        <Pressable onPress={()=>void refresh()} style={styles.notice}>
          <Icon name="alert-circle" size={17} color="#9175C5"/>
          <Text style={styles.noticeText}>{message}</Text>
          <Icon name="refresh-cw" size={16} color="#BAA5D9"/>
        </Pressable>}
    </ScrollView>
    <Pressable style={styles.newButton} onPress={()=>onAgent('opencode')}>
      <Icon name="plus" size={25} color="#FFFFFF"/>
      <Text style={styles.newText}>New</Text>
    </Pressable>
  </View>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#FCFAF7'},
  header:{height:80,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:12},
  topControl:{height:43,width:39,justifyContent:'center',alignItems:'center'},
  headerTitle:{color:'#242326',fontWeight:'700',fontSize:25,letterSpacing:-0.8,flex:1},
  statusPill:{height:36,flexDirection:'row',gap:9,alignItems:'center',
    borderRadius:23,backgroundColor:'#F0EEEB',borderWidth:1,borderColor:'#E7E4DE',paddingHorizontal:14},
  statusPillAwake:{backgroundColor:'#E5F5EA',borderColor:'#D5ECDC'},
  liveDot:{height:9,width:9,borderRadius:9},
  pillText:{fontSize:13,fontWeight:'700'},
  content:{paddingTop:49,paddingBottom:150},
  sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    paddingHorizontal:22,marginBottom:18},
  sectionTitle:{fontSize:18.5,color:'#29282A',fontWeight:'700',letterSpacing:-0.4},
  addButton:{height:31,width:31,alignItems:'center',justifyContent:'center'},
  shortcuts:{gap:11,paddingHorizontal:22,paddingRight:26},
  agentCard:{height:157,width:152,padding:15,borderRadius:18,
    backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#EAE7E2',
    justifyContent:'space-between',shadowColor:'#6D6459',shadowOpacity:0.06,
    shadowOffset:{width:0,height:5},shadowRadius:14,elevation:2},
  agentTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
  agentBadge:{width:39,height:39,backgroundColor:'#F6F2F8',borderRadius:12,
    alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#ECE7F1'},
  agentTitle:{color:'#292729',fontSize:16,fontWeight:'700',letterSpacing:-0.5},
  agentMeta:{color:'#88868B',fontSize:11.5,marginTop:7},
  muted:{color:'#88868B',fontSize:12},
  projectCard:{marginHorizontal:22,padding:17,borderWidth:1,borderColor:'#E8E5DF',
    backgroundColor:'#F6F4F1',borderRadius:18,flexDirection:'row',alignItems:'center',gap:13},
  projectIcon:{width:43,height:43,alignItems:'center',justifyContent:'center'},
  projectDetails:{flex:1,gap:5},
  projectTitle:{color:'#29282B',fontWeight:'700',fontSize:16},
  projectPath:{color:'#858287',fontSize:12},
  projectSub:{color:'#68656A',fontSize:11,marginTop:2},
  recentEmpty:{flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:28,paddingTop:14},
  recentText:{color:'#858286',fontSize:12.5,lineHeight:20,flex:1},
  notice:{marginHorizontal:22,marginTop:30,padding:15,borderRadius:14,
    borderWidth:1,borderColor:'#E6DFEE',backgroundColor:'#F7F2FB',
    flexDirection:'row',alignItems:'center',gap:11},
  noticeText:{color:'#726082',fontSize:12,lineHeight:18,flex:1},
  newButton:{position:'absolute',right:23,bottom:26,height:58,borderRadius:25,
    paddingHorizontal:23,backgroundColor:'#242426',flexDirection:'row',
    alignItems:'center',justifyContent:'center',gap:12,
    shadowColor:'#454044',shadowOpacity:0.15,
    shadowOffset:{width:0,height:5},shadowRadius:12,elevation:4},
  newText:{fontSize:17,fontWeight:'700',color:'#FFFFFF'},
});

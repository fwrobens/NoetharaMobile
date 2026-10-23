import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';

type Agent='opencode'|'codex'|'claude';
const agents: Array<{
  id:Agent; title:string; tag:string; description:string;
  icon:React.ComponentProps<typeof Feather>['name']; accent:string; surface:string;
}>=[
  {id:'opencode',title:'OpenCode',tag:'Coding workspace',description:'Terminal-first open-source coding agent',icon:'command',accent:'#7B60C4',surface:'#F1ECFB'},
  {id:'codex',title:'Codex',tag:'Code agent',description:'Work with your repository from the CLI',icon:'terminal',accent:'#397A6B',surface:'#EAF4EF'},
  {id:'claude',title:'Claude Code',tag:'Developer agent',description:'Explore, edit and review projects',icon:'aperture',accent:'#C68565',surface:'#F9EFEA'},
];
const Icon=({name,size=20,color='#28272C'}:{
  name:React.ComponentProps<typeof Feather>['name'];size?:number;color?:string;
})=><Feather name={name} size={size} color={color}/>;
export function TerminalDashboard({onBack,onAgent}:{
  onBack:()=>void;onAgent:(agent:Agent)=>void;
}){
  const [configured,setConfigured]=useState(false);
  useEffect(()=>{
    let active=true;
    Promise.all([
      SecureStore.getItemAsync('noethara-terminal-gateway-url'),
      SecureStore.getItemAsync('noethara-terminal-gateway-token')
    ]).then(([url,token])=>{if(active)setConfigured(!!(url&&token));}).catch(()=>{});
    return()=>{active=false;};
  },[]);
  return <LinearGradient colors={['#FCFAF7','#FAF8F5','#F6F3EF']} style={styles.root}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Go back" onPress={onBack} style={styles.back}>
        <Icon name="arrow-left" size={24}/>
      </Pressable>
      <Text style={styles.headerTitle}>Terminals</Text>
      <View style={styles.headerRight}><View style={styles.greenDot}/><Text style={styles.headerRightText}>NOETHARA</Text></View>
    </View>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowLine}/>
        <Text style={styles.eyebrow}>YOUR REMOTE WORKSPACE</Text>
      </View>
      <Text style={styles.headline}>Your tools.{"\n"}One workspace.</Text>
      <Text style={styles.description}>Launch an independent Linux CLI session for each coding agent.</Text>

      <Pressable onPress={()=>onAgent('opencode')} style={styles.workspaceCard}>
        <View style={styles.workspaceTop}>
          <View style={styles.serverIcon}><Icon name="server" size={22} color="#DAC7FF"/></View>
          <View style={{flex:1}}>
            <Text style={styles.serverTitle}>Linux workspace</Text>
            <Text style={styles.serverMeta}>Noethara Dev · Remote runtime</Text>
          </View>
          <Icon name="arrow-up-right" color="#9A8FAD" size={19}/>
        </View>
        <View style={styles.workspaceBottom}>
          <View style={[styles.workspaceDot,{backgroundColor:configured?'#E4B56B':'#75717A'}]}/>
          <Text style={styles.workspaceStatus}>{configured?'Gateway saved · Tap to connect':'Connection not configured'}</Text>
          <Text style={styles.workspaceHint}>Set up <Icon name="chevron-right" size={12} color="#B3A7C3"/></Text>
        </View>
      </Pressable>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Coding agents</Text>
          <Text style={styles.sectionSubtitle}>Choose a CLI to open its own terminal</Text>
        </View>
        <View style={styles.countPill}><Text style={styles.countText}>03</Text></View>
      </View>

      <View style={styles.cards}>
        {agents.map((agent,index)=>(
          <Pressable key={agent.id} onPress={()=>onAgent(agent.id)}
            accessibilityLabel={'Open '+agent.title+' CLI'} style={({pressed})=>[styles.agentCard,pressed&&{opacity:0.75,transform:[{scale:0.992}]}]}>
            <View style={[styles.agentIcon,{backgroundColor:agent.surface}]}>
              <Icon name={agent.icon} size={24} color={agent.accent}/>
            </View>
            <View style={styles.agentContent}>
              <Text style={styles.agentTitle}>{agent.title}</Text>
              <Text style={styles.agentTag}>{agent.tag}</Text>
              <Text style={styles.agentDescription} numberOfLines={1}>{agent.description}</Text>
            </View>
            <View style={styles.chevron}><Icon name="arrow-up-right" size={18}/></View>
          </Pressable>
        ))}
      </View>

      <View style={styles.infoCard}>
        <Icon name="info" size={16} color="#7F68AA"/>
        <Text style={styles.infoText}>
          CLI sessions run on your Linux server and remain separate from AI chat. A secure WSS connection is required for terminal input and output.
        </Text>
      </View>
    </ScrollView>
  </LinearGradient>;
}
const styles=StyleSheet.create({
  root:{flex:1},
  header:{height:76,flexDirection:'row',alignItems:'center',paddingHorizontal:19,gap:12},
  back:{width:38,height:38,alignItems:'center',justifyContent:'center'},
  headerTitle:{fontSize:19,color:'#242328',fontWeight:'700',letterSpacing:-0.5,flex:1},
  headerRight:{flexDirection:'row',alignItems:'center',gap:7},
  greenDot:{width:7,height:7,borderRadius:5,backgroundColor:'#33BD77'},
  headerRightText:{fontSize:10,fontWeight:'700',color:'#9B98A2',letterSpacing:1},
  scroll:{paddingHorizontal:23,paddingTop:30,paddingBottom:40},
  eyebrowRow:{flexDirection:'row',alignItems:'center',gap:9,marginBottom:14},
  eyebrowLine:{width:20,height:2,backgroundColor:'#906CCF',borderRadius:2},
  eyebrow:{fontSize:10,fontWeight:'700',color:'#867A9A',letterSpacing:1.3},
  headline:{fontSize:35,fontWeight:'700',color:'#25232A',letterSpacing:-1.6,lineHeight:42},
  description:{fontSize:14,color:'#8C8991',lineHeight:23,marginTop:12,marginBottom:28,maxWidth:315},
  workspaceCard:{backgroundColor:'#222126',borderRadius:22,marginBottom:35,
    padding:18,borderColor:'#35313A',borderWidth:1,shadowColor:'#4C4154',shadowOpacity:0.16,
    shadowOffset:{width:0,height:10},shadowRadius:18,elevation:3},
  workspaceTop:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:21},
  serverIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#363041',
    alignItems:'center',justifyContent:'center'},
  serverTitle:{fontSize:15,fontWeight:'700',color:'#F7F4F8'},
  serverMeta:{fontSize:11.5,color:'#AFA9B5',marginTop:5},
  workspaceBottom:{paddingTop:15,borderTopWidth:1,borderTopColor:'#403B43',
    flexDirection:'row',alignItems:'center',gap:8},
  workspaceDot:{width:7,height:7,borderRadius:5},
  workspaceStatus:{fontSize:11,color:'#BCB5C3',flex:1},
  workspaceHint:{fontSize:11,fontWeight:'600',color:'#CEC3DB'},
  sectionHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},
  sectionTitle:{fontSize:18,fontWeight:'700',letterSpacing:-0.4,color:'#2B292F'},
  sectionSubtitle:{fontSize:12,color:'#9A969F',marginTop:5},
  countPill:{paddingVertical:7,paddingHorizontal:10,backgroundColor:'#EFEBF0',borderRadius:10},
  countText:{color:'#7B7182',fontSize:11,fontWeight:'700'},
  cards:{gap:10},
  agentCard:{backgroundColor:'#FFFFFF',padding:15,borderWidth:1,borderColor:'#EBE7E4',borderRadius:18,
    flexDirection:'row',alignItems:'center',gap:13,shadowColor:'#817B79',shadowOpacity:0.04,
    shadowOffset:{width:0,height:4},shadowRadius:9},
  agentIcon:{width:51,height:51,borderRadius:15,alignItems:'center',justifyContent:'center'},
  agentContent:{flex:1,justifyContent:'center'},
  agentTitle:{fontSize:16,fontWeight:'700',color:'#29272B',letterSpacing:-0.3},
  agentTag:{fontSize:11,color:'#7F6CA0',marginTop:4,fontWeight:'500'},
  agentDescription:{fontSize:11.5,color:'#969199',marginTop:7},
  chevron:{width:32,height:32,borderRadius:11,borderWidth:1,borderColor:'#F0EDEA',
    justifyContent:'center',alignItems:'center'},
  infoCard:{flexDirection:'row',gap:11,alignItems:'flex-start',
    borderRadius:15,backgroundColor:'#F2EDF6',padding:15,marginTop:27},
  infoText:{flex:1,fontSize:11.5,color:'#82758F',lineHeight:18},
});

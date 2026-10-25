import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

export type AgentEvent={id:number;kind:string;message:string;at:number;ref?:string;
 status?:'running'|'done'|'failed'|'active';tool?:string;path?:string;ms?:number;output?:string};
export type AgentPlanStep={title:string;status:'pending'|'active'|'done'};
export type AgentChecks=Partial<Record<'install'|'typecheck'|'build'|'style'|'test'|'preview',string>>;
export type AgentApproval={ref:string;command:string;reason:string};
export type AgentMeta={plan:AgentPlanStep[];phase:string;files:string[];checks:AgentChecks;startedAt:number|null;
 checkpoints?:Array<{sha:string;label:string;at:number}>;pendingApproval?:AgentApproval|null;
 metrics?:{modelMs:number;toolMs:number;requests:number;commands:number}|null};
export const emptyAgentMeta:AgentMeta={plan:[],phase:'',files:[],checks:{},startedAt:null,checkpoints:[],pendingApproval:null};

type IconName=React.ComponentProps<typeof Feather>['name'];
const C={ink:'#211D26',body:'#5E5866',muted:'#948E9B',faint:'#C9C3CE',line:'#EEE9F1',card:'#FFFFFF',
 tint:'#F5F1FB',accent:'#7457B5',accentSoft:'#E9E1F7',green:'#2F9E6E',greenSoft:'#E3F4EC',
 red:'#C4574C',redSoft:'#FBEAE8',amber:'#B7832F'};
const PHASES:Record<string,string>={starting:'Starting up',planning:'Planning the work',thinking:'Thinking',
 reading:'Reading the project',writing:'Writing code',running:'Running checks',previewing:'Starting preview',
 done:'Work complete',paused:'Paused',failed:'Needs attention',awaiting_approval:'Waiting for your approval',reviewing:'Reviewing the design'};
const TOOL_ICONS:Record<string,IconName>={list_files:'folder',read_file:'file-text',write_file:'edit-3',
 edit_file:'edit-2',delete_file:'trash-2',scaffold_app:'box',run_command:'terminal',start_preview:'monitor'};
const KIND_ICONS:Record<string,IconName>={read:'file-text',write:'edit-3',command:'terminal',preview:'monitor',
 error:'alert-circle',commentary:'message-circle',model:'cpu',paused:'pause-circle',done:'check-circle',result:'check'};
const EXT_COLORS:Record<string,string>={tsx:'#3B82C4',ts:'#3B82C4',js:'#C9A227',jsx:'#C9A227',json:'#8A7F5B',
 css:'#7457B5',html:'#D0643B',md:'#6B7280'};

function useLoop(active:boolean,duration:number,delay=0){
 const v=useRef(new Animated.Value(0)).current;
 useEffect(()=>{
  if(!active){v.stopAnimation();v.setValue(0);return;}
  const anim=Animated.loop(Animated.sequence([Animated.delay(delay),
   Animated.timing(v,{toValue:1,duration,easing:Easing.linear,useNativeDriver:true})]));
  anim.start();
  return ()=>anim.stop();
 },[active,duration,delay,v]);
 return v;
}
function useEntrance(delay=0,distance=8){
 const v=useRef(new Animated.Value(0)).current;
 useEffect(()=>{Animated.timing(v,{toValue:1,duration:380,delay,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();},[v,delay]);
 return {opacity:v,transform:[{translateY:v.interpolate({inputRange:[0,1],outputRange:[distance,0]})}]};
}
function useSpringOn(key:string){
 const v=useRef(new Animated.Value(1)).current;
 const first=useRef(true);
 useEffect(()=>{
  if(first.current){first.current=false;return;}
  v.setValue(0.4);
  Animated.spring(v,{toValue:1,friction:5,tension:160,useNativeDriver:true}).start();
 },[key,v]);
 return v;
}
const elapsedLabel=(ms:number)=>{const s=Math.max(0,Math.floor(ms/1000));return s<60?s+'s':Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s';};
function useElapsed(startedAt:number|null,busy:boolean){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(!busy)return;const t=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(t);},[busy]);
 return startedAt?elapsedLabel((busy?now:Math.max(now,startedAt))-startedAt):'';
}

function Orb({state}:{state:'busy'|'done'|'failed'}){
 const busy=state==='busy';
 const ring1=useLoop(busy,1800),ring2=useLoop(busy,1800,900),spin=useLoop(busy,1100);
 const pop=useSpringOn(state);
 const ring=(v:Animated.Value)=>({opacity:v.interpolate({inputRange:[0,1],outputRange:[0.45,0]}),
  transform:[{scale:v.interpolate({inputRange:[0,1],outputRange:[1,2.1]})}]});
 const color=state==='failed'?C.red:state==='done'?C.green:C.accent;
 return <View style={styles.orbWrap}>
  {busy&&<Animated.View style={[styles.orbRing,{borderColor:C.accent},ring(ring1)]}/>}
  {busy&&<Animated.View style={[styles.orbRing,{borderColor:C.accent},ring(ring2)]}/>}
  {busy&&<Animated.View style={[styles.orbArc,{transform:[{rotate:spin.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}]}/>}
  <Animated.View style={[styles.orbCore,{backgroundColor:color,transform:[{scale:pop}]}]}>
   <Feather name={busy?'zap':state==='done'?'check':'alert-triangle'} size={13} color="#FFF"/>
  </Animated.View>
 </View>;
}
function FadeText({text,style,lines}:{text:string;style:object;lines?:number}){
 const v=useRef(new Animated.Value(1)).current;
 const [shown,setShown]=useState(text);
 useEffect(()=>{
  if(text===shown)return;
  Animated.timing(v,{toValue:0,duration:120,useNativeDriver:true}).start(()=>{
   setShown(text);
   Animated.timing(v,{toValue:1,duration:220,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();
  });
 },[text,shown,v]);
 return <Animated.Text numberOfLines={lines} style={[style,{opacity:v,transform:[{translateY:v.interpolate({inputRange:[0,1],outputRange:[4,0]})}]}]}>{shown}</Animated.Text>;
}
function ProgressBar({progress,busy}:{progress:number|null;busy:boolean}){
 const fill=useRef(new Animated.Value(0)).current;
 const shimmer=useLoop(busy,1400);
 const [w,setW]=useState(0);
 useEffect(()=>{Animated.timing(fill,{toValue:progress??0.18,duration:600,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();},[progress,fill]);
 return <View style={styles.bar} onLayout={e=>setW(e.nativeEvent.layout.width)}>
  <Animated.View style={[styles.barFill,{width:fill.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}]}/>
  {busy&&w>0&&<Animated.View style={[styles.barShimmer,{transform:[{translateX:shimmer.interpolate({inputRange:[0,1],outputRange:[-80,w]})}]}]}/>}
 </View>;
}
function StepIcon({status}:{status:AgentPlanStep['status']}){
 const spin=useLoop(status==='active',900);
 const pop=useSpringOn(status);
 if(status==='done')return <Animated.View style={[styles.stepDone,{transform:[{scale:pop}]}]}><Feather name="check" size={11} color="#FFF"/></Animated.View>;
 if(status==='active')return <View style={styles.stepIcon}><Animated.View style={[styles.stepSpinner,{transform:[{rotate:spin.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}]}/></View>;
 return <View style={styles.stepIcon}><View style={styles.stepPending}/></View>;
}
function PlanRow({step,index}:{step:AgentPlanStep;index:number}){
 const enter=useEntrance(index*55);
 return <Animated.View style={[styles.stepRow,enter]}>
  <StepIcon status={step.status}/>
  <Text style={[styles.stepText,step.status==='done'&&styles.stepTextDone,step.status==='active'&&styles.stepTextActive]} numberOfLines={2}>{step.title}</Text>
 </Animated.View>;
}
function Dots(){
 const a=useLoop(true,1100),b=useLoop(true,1100,180),c=useLoop(true,1100,360);
 const dot=(v:Animated.Value)=>({opacity:v.interpolate({inputRange:[0,0.3,0.6,1],outputRange:[0.25,1,0.25,0.25]}),
  transform:[{translateY:v.interpolate({inputRange:[0,0.3,0.6,1],outputRange:[0,-2.5,0,0]})}]});
 return <View style={styles.dots}>{[a,b,c].map((v,i)=><Animated.View key={i} style={[styles.dot,dot(v)]}/>)}</View>;
}
export function ThinkingIndicator({label='Thinking'}:{label?:string}){
 const enter=useEntrance();
 return <Animated.View style={[styles.thinking,enter]}><Orb state="busy"/><Text style={styles.thinkingText}>{label}</Text><Dots/></Animated.View>;
}
// eslint-disable-next-line no-control-regex
const lastLines=(t:string)=>t.replace(/\u001b\[[0-9;]*[A-Za-z]/g,'').split('\n').map(l=>l.trim()).filter(Boolean).slice(-2).join('\n');
function LiveAction({event}:{event:AgentEvent}){
 const enter=useEntrance(0,6);
 const icon=TOOL_ICONS[event.tool||'']||KIND_ICONS[event.kind]||'activity';
 return <Animated.View style={[styles.live,enter]}>
  <View style={styles.liveIcon}><Feather name={icon} size={14} color={C.accent}/></View>
  <View style={{flex:1,gap:3}}>
   <Text style={styles.liveText} numberOfLines={1}>{event.message}</Text>
   {!!event.output&&<Text style={styles.liveOut} numberOfLines={2}>{lastLines(event.output)}</Text>}
  </View>
  <Dots/>
 </Animated.View>;
}
function FileChip({path,index}:{path:string;index:number}){
 const enter=useEntrance(Math.min(index,8)*40,4);
 const ext=path.split('.').pop()?.toLowerCase()||'';
 return <Animated.View style={[styles.chip,enter]}>
  <View style={[styles.chipDot,{backgroundColor:EXT_COLORS[ext]||C.faint}]}/>
  <Text style={styles.chipText} numberOfLines={1}>{path.split('/').pop()}</Text>
 </Animated.View>;
}
function CheckBadge({label,value}:{label:string;value?:string}){
 const pop=useSpringOn(value||'none');
 const ok=value==='passed'||value==='ready',bad=value==='failed';
 return <Animated.View style={[styles.badge,ok&&{backgroundColor:C.greenSoft},bad&&{backgroundColor:C.redSoft},{transform:[{scale:pop}]}]}>
  <Feather name={ok?'check':bad?'x':'circle'} size={11} color={ok?C.green:bad?C.red:C.faint}/>
  <Text style={[styles.badgeText,ok&&{color:C.green},bad&&{color:C.red}]}>{label}</Text>
 </Animated.View>;
}
function TimelineRow({event,last}:{event:AgentEvent;last:boolean}){
 const enter=useEntrance(0,6);
 const failed=event.status==='failed'||event.kind==='error';
 const running=event.status==='running';
 const icon=failed?'alert-circle':TOOL_ICONS[event.tool||'']||KIND_ICONS[event.kind]||'circle';
 return <Animated.View style={[styles.tRow,enter]}>
  <View style={styles.tTrack}>
   <View style={[styles.tIcon,failed&&{backgroundColor:C.redSoft},event.status==='done'&&{backgroundColor:C.greenSoft}]}>
    <Feather name={icon} size={12} color={failed?C.red:event.status==='done'?C.green:C.accent}/>
   </View>
   {!last&&<View style={styles.tRail}/>}
  </View>
  <View style={styles.tBody}>
   <Text style={[styles.tText,event.kind==='commentary'&&styles.tCommentary,failed&&{color:C.red}]} selectable>{event.message.slice(0,700)}</Text>
   <Text style={styles.tMeta}>{running?'running…':event.ms!=null?(event.ms<1000?event.ms+'ms':(event.ms/1000).toFixed(1)+'s'):''}</Text>
  </View>
 </Animated.View>;
}
function ApprovalCard({approval,onApprove}:{approval:AgentApproval;onApprove?:(allow:boolean,always:boolean)=>void}){
 const enter=useEntrance(0,10);
 const glow=useLoop(true,1600);
 const [sent,setSent]=useState(false);
 const decide=(allow:boolean,always:boolean)=>{setSent(true);onApprove?.(allow,always);};
 return <Animated.View style={[styles.approval,enter]}>
  <View style={styles.approvalHead}>
   <Animated.View style={[styles.approvalIcon,{opacity:glow.interpolate({inputRange:[0,0.5,1],outputRange:[1,0.55,1]})}]}>
    <Feather name="shield" size={14} color={C.amber}/>
   </Animated.View>
   <Text style={styles.approvalTitle}>Allow this command?</Text>
  </View>
  <Text style={styles.approvalCmd} selectable>$ {approval.command}</Text>
  {!!approval.reason&&<Text style={styles.approvalReason}>{approval.reason}</Text>}
  <View style={styles.approvalRow}>
   <Pressable disabled={sent} onPress={()=>decide(false,false)} style={[styles.apBtn,styles.apGhost]}><Text style={styles.apGhostText}>Deny</Text></Pressable>
   <Pressable disabled={sent} onPress={()=>decide(true,true)} style={[styles.apBtn,styles.apGhost]}><Text style={styles.apGhostText}>Always allow</Text></Pressable>
   <Pressable disabled={sent} onPress={()=>decide(true,false)} style={[styles.apBtn,styles.apPrimary,sent&&{opacity:0.6}]}><Text style={styles.apPrimaryText}>{sent?'Sent':'Allow'}</Text></Pressable>
  </View>
 </Animated.View>;
}
// Collapse running/done/failed updates of one tool call into a single row.
function mergeEvents(events:AgentEvent[]){
 const out:AgentEvent[]=[];const byRef=new Map<string,number>();
 for(const e of events){
  if(e.kind==='progress'||e.kind==='plan')continue;
  if(e.ref){
   const i=byRef.get(e.ref);
   if(i!==undefined){out[i]={...out[i],...e,id:out[i].id,message:e.kind==='error'?e.message:out[i].message};continue;}
   byRef.set(e.ref,out.length);
  }
  out.push(e);
 }
 return out;
}

export function AgentActivity({events,busy,headline,onContinue,continuable,meta=emptyAgentMeta,onUndo,onApprove}:{
 events:AgentEvent[];busy:boolean;headline:string;onContinue?:()=>void;continuable?:boolean;meta?:AgentMeta;
 onUndo?:()=>void;onApprove?:(allow:boolean,always:boolean)=>void;
}){
 const [expanded,setExpanded]=useState(false);
 const merged=useMemo(()=>mergeEvents(events),[events]);
 const elapsed=useElapsed(meta.startedAt??events[0]?.at??null,busy);
 const enter=useEntrance();
 const pressScale=useRef(new Animated.Value(1)).current;
 if(!busy&&!events.length&&!headline)return null;
 const last=merged.at(-1);
 const failed=!busy&&(meta.phase==='failed'||meta.phase==='paused'||meta.checks.typecheck==='failed'||meta.checks.build==='failed'||last?.kind==='error'||last?.kind==='paused');
 const state:'busy'|'done'|'failed'=busy?'busy':failed?'failed':'done';
 const running=busy?[...merged].reverse().find(e=>e.status==='running'):undefined;
 const thought=[...merged].reverse().find(e=>e.kind==='commentary');
 const title=busy?(PHASES[meta.phase]||'Working'):failed?(meta.phase==='paused'?'Paused':'Needs attention'):'Work complete';
 const subtitle=(running?.message||thought?.message||headline||'Preparing your workspace').replace(/\s+/g,' ').slice(0,160);
 const total=meta.plan.length;
 const doneCount=meta.plan.filter(s=>s.status==='done').length+meta.plan.filter(s=>s.status==='active').length*0.5;
 const progress=total?Math.min(1,doneCount/total):busy?null:1;
 const hasChecks=Object.keys(meta.checks).length>0;
 const toggle=()=>{LayoutAnimation.configureNext(LayoutAnimation.create(240,'easeInEaseOut','opacity'));setExpanded(v=>!v);};
 const press=(to:number)=>Animated.spring(pressScale,{toValue:to,friction:6,tension:220,useNativeDriver:true}).start();
 return <Animated.View style={[styles.card,enter]}>
  <Pressable onPress={toggle} style={styles.header} accessibilityRole="button"
   accessibilityLabel={expanded?'Collapse agent activity':'Expand agent activity'}>
   <Orb state={state}/>
   <View style={styles.headText}>
    <FadeText text={title} style={styles.title} lines={1}/>
    <FadeText text={subtitle} style={styles.subtitle} lines={2}/>
   </View>
   <View style={styles.headRight}>
    {!!elapsed&&<Text style={styles.elapsed}>{elapsed}</Text>}
    <Feather name={expanded?'chevron-up':'chevron-down'} size={17} color={C.muted}/>
   </View>
  </Pressable>
  <ProgressBar progress={progress} busy={busy}/>
  {!!meta.metrics?.requests&&<Text style={styles.performance}>AI {elapsedLabel(meta.metrics.modelMs)} across {meta.metrics.requests} response{meta.metrics.requests===1?'':'s'} · Tools {elapsedLabel(meta.metrics.toolMs)}</Text>}
  {total>0&&<View style={styles.plan}>
   <Text style={styles.section}>PLAN · {meta.plan.filter(s=>s.status==='done').length}/{total}</Text>
   {meta.plan.map((s,i)=><PlanRow key={i+s.title} step={s} index={i}/>)}
  </View>}
  {busy&&meta.pendingApproval&&<ApprovalCard key={meta.pendingApproval.ref} approval={meta.pendingApproval} onApprove={onApprove}/>}
  {running&&!meta.pendingApproval&&<LiveAction key={running.ref||running.id} event={running}/>}
  {!running&&busy&&thought&&<View style={styles.thought}><Text style={styles.thoughtText} numberOfLines={3}>{thought.message}</Text></View>}
  {meta.files.length>0&&<View style={styles.block}>
   <Text style={styles.section}>FILES · {meta.files.length}</Text>
   <View style={styles.chips}>{meta.files.slice(-12).map((f,i)=><FileChip key={f} path={f} index={i}/>)}
    {meta.files.length>12&&<View style={styles.chip}><Text style={styles.chipText}>+{meta.files.length-12}</Text></View>}</View>
  </View>}
  {hasChecks&&<View style={styles.checks}>
   <CheckBadge label="Types" value={meta.checks.typecheck}/>
   <CheckBadge label="Build" value={meta.checks.build}/>
   {meta.checks.style&&<CheckBadge label="CSS" value={meta.checks.style}/>}
   <CheckBadge label="Preview" value={meta.checks.preview}/>
  </View>}
  {expanded&&<View style={styles.timeline}>
   <Text style={styles.section}>ACTIVITY · {merged.length}</Text>
   {merged.slice(-40).map((e,i,a)=><TimelineRow key={e.ref||String(e.id)} event={e} last={i===a.length-1}/>)}
  </View>}
  {(continuable||(onUndo&&(meta.checkpoints?.length??0)>0))&&<View style={styles.actions}>
  {continuable&&<Animated.View style={{transform:[{scale:pressScale}],alignSelf:'flex-start'}}>
   <Pressable onPress={onContinue} onPressIn={()=>press(0.96)} onPressOut={()=>press(1)} style={styles.continue}
    accessibilityRole="button" accessibilityLabel="Continue coding session">
    <Feather name="play" size={13} color="#FFF"/>
    <Text style={styles.continueText}>Continue from saved files</Text>
   </Pressable>
  </Animated.View>}
  {onUndo&&(meta.checkpoints?.length??0)>0&&<Pressable onPress={onUndo} style={styles.undo} accessibilityRole="button" accessibilityLabel="Undo this session's file changes">
   <Feather name="rotate-ccw" size={13} color={C.body}/><Text style={styles.undoText}>Undo changes</Text>
  </Pressable>}
  </View>}
 </Animated.View>;
}

const styles=StyleSheet.create({
 card:{marginTop:8,marginBottom:22,padding:14,borderRadius:20,backgroundColor:C.card,borderWidth:1,borderColor:C.line,
  shadowColor:'#5B4A7A',shadowOpacity:0.07,shadowRadius:16,shadowOffset:{width:0,height:6},elevation:2,gap:12},
 header:{flexDirection:'row',alignItems:'center',gap:12},
 headText:{flex:1,minWidth:0},
 title:{color:C.ink,fontSize:14.5,fontWeight:'700',letterSpacing:-0.2},
 subtitle:{color:C.muted,fontSize:12.5,lineHeight:18,marginTop:2},
 headRight:{flexDirection:'row',alignItems:'center',gap:6},
 elapsed:{fontSize:11.5,color:C.muted,fontVariant:['tabular-nums']},
 orbWrap:{width:34,height:34,alignItems:'center',justifyContent:'center'},
 orbRing:{position:'absolute',width:30,height:30,borderRadius:15,borderWidth:1.5},
 orbArc:{position:'absolute',width:34,height:34,borderRadius:17,borderWidth:2,borderColor:'transparent',borderTopColor:C.accent,borderRightColor:C.accentSoft},
 orbCore:{width:26,height:26,borderRadius:13,alignItems:'center',justifyContent:'center'},
 performance:{fontSize:10.5,color:C.muted,fontVariant:['tabular-nums'],letterSpacing:0.1},
 bar:{height:4,borderRadius:2,backgroundColor:C.tint,overflow:'hidden'},
 barFill:{position:'absolute',left:0,top:0,bottom:0,borderRadius:2,backgroundColor:C.accent},
 barShimmer:{position:'absolute',top:0,bottom:0,width:80,backgroundColor:'rgba(255,255,255,0.55)'},
 section:{fontSize:10.5,fontWeight:'700',letterSpacing:1,color:C.muted,marginBottom:8},
 plan:{paddingTop:2},
 stepRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:5},
 stepIcon:{width:18,height:18,alignItems:'center',justifyContent:'center'},
 stepPending:{width:14,height:14,borderRadius:7,borderWidth:1.5,borderColor:C.faint},
 stepSpinner:{width:16,height:16,borderRadius:8,borderWidth:2,borderColor:C.accentSoft,borderTopColor:C.accent},
 stepDone:{width:18,height:18,borderRadius:9,backgroundColor:C.accent,alignItems:'center',justifyContent:'center'},
 stepText:{flex:1,fontSize:13.5,lineHeight:19,color:C.body},
 stepTextActive:{color:C.ink,fontWeight:'600'},
 stepTextDone:{color:C.muted},
 live:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,paddingHorizontal:11,borderRadius:14,backgroundColor:C.tint},
 liveIcon:{width:26,height:26,borderRadius:8,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},
 liveText:{flex:1,fontSize:13,color:C.ink,fontWeight:'500'},
 thought:{borderLeftWidth:2,borderLeftColor:C.accentSoft,paddingLeft:10},
 thoughtText:{fontSize:12.5,lineHeight:18,color:C.body,fontStyle:'italic'},
 dots:{flexDirection:'row',gap:3,alignItems:'center',height:12},
 dot:{width:4,height:4,borderRadius:2,backgroundColor:C.accent},
 block:{},
 chips:{flexDirection:'row',flexWrap:'wrap',gap:6},
 chip:{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:5,paddingHorizontal:9,borderRadius:999,backgroundColor:'#F7F5F9',borderWidth:1,borderColor:C.line,maxWidth:180},
 chipDot:{width:6,height:6,borderRadius:3},
 chipText:{fontSize:11.5,color:C.body,fontWeight:'500'},
 checks:{flexDirection:'row',gap:6},
 badge:{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:5,paddingHorizontal:9,borderRadius:999,backgroundColor:'#F4F2F6'},
 badgeText:{fontSize:11.5,fontWeight:'600',color:C.muted},
 timeline:{borderTopWidth:1,borderTopColor:C.line,paddingTop:12},
 tRow:{flexDirection:'row',gap:10},
 tTrack:{width:22,alignItems:'center'},
 tIcon:{width:22,height:22,borderRadius:7,backgroundColor:C.tint,alignItems:'center',justifyContent:'center'},
 tRail:{width:1,flex:1,minHeight:10,backgroundColor:C.line,marginVertical:3},
 tBody:{flex:1,minWidth:0,paddingBottom:12,flexDirection:'row',gap:8},
 tText:{flex:1,fontSize:12.5,lineHeight:18,color:C.body},
 tCommentary:{fontStyle:'italic',color:C.muted},
 tMeta:{fontSize:11,color:C.faint,fontVariant:['tabular-nums']},
 continue:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:10,paddingHorizontal:14,borderRadius:14,backgroundColor:C.accent},
 continueText:{fontSize:13,fontWeight:'700',color:'#FFF'},
 thinking:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10},
 liveOut:{fontFamily:'Menlo',fontSize:10.5,color:C.faint,lineHeight:14},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},
 undo:{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:10,paddingHorizontal:13,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:'#FBFAFC'},
 undoText:{fontSize:13,fontWeight:'600',color:C.body},
 approval:{padding:12,borderRadius:16,backgroundColor:'#FFF9EF',borderWidth:1,borderColor:'#F1E2C4',gap:8},
 approvalHead:{flexDirection:'row',alignItems:'center',gap:8},
 approvalIcon:{width:24,height:24,borderRadius:8,backgroundColor:'#FBEFD6',alignItems:'center',justifyContent:'center'},
 approvalTitle:{fontSize:13.5,fontWeight:'700',color:C.ink},
 approvalCmd:{fontFamily:'Menlo',fontSize:12,color:C.ink,backgroundColor:'#FFFFFF',borderRadius:10,padding:10,borderWidth:1,borderColor:'#F1E2C4'},
 approvalReason:{fontSize:12,color:C.body,lineHeight:17},
 approvalRow:{flexDirection:'row',gap:6,justifyContent:'flex-end'},
 apBtn:{paddingVertical:8,paddingHorizontal:12,borderRadius:11},
 apGhost:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#EDE3D2'},
 apGhostText:{fontSize:12.5,fontWeight:'600',color:C.body},
 apPrimary:{backgroundColor:C.ink},
 apPrimaryText:{fontSize:12.5,fontWeight:'700',color:'#FFF'},
 thinkingText:{fontSize:13.5,color:C.muted,fontWeight:'500'},
});

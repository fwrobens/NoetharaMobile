import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  supabase, getSession, signInWithGitHub, signInWithEmail, signUpWithEmail,
  logout, getOAuthReturnUrl, AUTH_CALLBACK_URL, noetharaAPI, getGitHubToken,
  type Repo, type GithubEntry,
} from '../lib/noetharaBackend';

const colors = { text:'#252529',muted:'#77777E',purple:'#7255CB',line:'#E9E7E3',soft:'#F6F3EF',green:'#25B55B' };
const icon = (name: React.ComponentProps<typeof Feather>['name'], size=19, color=colors.text) => <Feather name={name} size={size} color={color}/>;
function Action({ title, onPress, dark = false, disabled = false }: { title:string;onPress:()=>void;dark?:boolean;disabled?:boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.action,dark&&styles.darkAction,disabled&&{opacity:0.6}]}>
    <Text style={[styles.actionText,dark&&{color:'#fff'}]}>{title}</Text>
  </Pressable>;
}
function Item({ title, subtitle, iconName, onPress, trailing }: {title:string;subtitle?:string;iconName:React.ComponentProps<typeof Feather>['name'];onPress:()=>void;trailing?:string}) {
  return <Pressable onPress={onPress} style={styles.item}>
    <View style={styles.itemIcon}>{icon(iconName,19)}</View>
    <View style={{flex:1}}>
      <Text style={styles.itemTitle}>{title}</Text>
      {!!subtitle&&<Text style={styles.itemSubtitle}>{subtitle}</Text>}
    </View>
    {!!trailing&&<Text style={styles.muted}>{trailing}</Text>}
    {icon('chevron-right',18,'#99999E')}
  </Pressable>;
}
function Section({ label, children }: { label:string;children:React.ReactNode }) {
  return <View style={{marginBottom:23}}>
    <Text style={styles.sectionLabel}>{label}</Text>
    <View style={styles.section}>{children}</View>
  </View>;
}
function Note({ children }: {children:React.ReactNode}) {
  return <View style={styles.note}><Text style={styles.noteText}>{children}</Text></View>;
}
function Input({ value, onChange, placeholder, secure=false }: { value:string;onChange:(v:string)=>void;placeholder:string;secure?:boolean}) {
  return <TextInput value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} secureTextEntry={secure}
    placeholder={placeholder} placeholderTextColor="#9A989B" style={styles.input}/>;
}
export type SelectedGitHubFile = { repo:string; branch:string; path:string };
export function IntegrationsSettings({ onBack, openRepos }: { onBack:()=>void;openRepos:()=>void }) {
  const [section,setSection]=useState<'home'|'providers'|'github'|'account'>('home');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [signedIn,setSignedIn]=useState(false);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [status,setStatus]=useState<{beam:boolean;fallback:boolean}|null>(null);
  useEffect(()=>{getSession().then(s=>setSignedIn(Boolean(s))).catch(()=>{});},[]);
  useEffect(()=>{if(signedIn)noetharaAPI.status().then(setStatus).catch(()=>setStatus(null));},[signedIn,section]);
  async function run(action:()=>Promise<unknown>) {
    setMessage('');setLoading(true);
    try {await action();setSignedIn(Boolean(await getSession()));}
    catch(e){setMessage(e instanceof Error ? e.message :'Connection failed');}
    finally {setLoading(false);Keyboard.dismiss();}
  }
  const main = () => section==='home' ? onBack() : setSection('home');
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={main} style={styles.back}>{icon('chevron-left',25)}</Pressable>
        <Text style={styles.heading}>{section==='home'?'Settings':section==='providers'?'LLM Providers':section==='github'?'GitHub':'Account'}</Text>
        <Pressable onPress={onBack}><Text style={styles.done}>Done</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {section==='home' ? <>
          <Section label="Account">
            <Item title={signedIn?'Connected account':'Sign in / Create account'}
              subtitle={signedIn?'Authenticated with Supabase':'Required for Beam and repositories'}
              iconName="user" onPress={()=>setSection('account')} />
          </Section>
          <Section label="Development">
            <Item title="LLM Providers" subtitle="Beam AI · Reflection free API" iconName="cpu" trailing={status?.beam?'Ready':'Setup'} onPress={()=>setSection('providers')} />
            <Item title="GitHub Integration" subtitle="OAuth · browse private repositories" iconName="github"
              trailing={getGitHubToken()?'Connected':''} onPress={()=>setSection('github')}/>
            <Item title="Repository files" subtitle="Choose source files for AI context" iconName="folder" onPress={openRepos}/>
            <Item title="Connectors" subtitle="Read-only GitHub tools" iconName="grid" onPress={()=>setSection('github')}/>
          </Section>
          <Section label="Preferences">
            <Item title="Appearance" subtitle="Ivory · native light theme" iconName="sun" onPress={()=>Alert.alert('Appearance','Your existing soft-ivory design has been preserved.')}/>
            <Item title="Speech" subtitle="iPhone dictation" iconName="mic" onPress={()=>Alert.alert('Speech','Use the microphone on the iOS keyboard.')}/>
          </Section>
        </> : section==='account' ? <>
          <Note>Sign in to your private Supabase backend. GitHub OAuth can also create the account when configured.</Note>
          <Section label={signedIn?'Signed in':'Email account'}>
            <View style={styles.fieldWrap}>
              <Input value={email} onChange={setEmail} placeholder="Email address" />
              <Input value={password} onChange={setPassword} placeholder="Password" secure/>
              {!signedIn&&<><Action dark title="Sign in" disabled={loading} onPress={()=>run(async()=>{await signInWithEmail(email,password);})}/>
              <Action title="Create account" disabled={loading} onPress={()=>run(async()=>{
                const session=await signUpWithEmail(email,password);
                if(!session) setMessage('Check your email for the confirmation link, then sign in.');
              })}/></>}
              {signedIn&&<Action title="Sign out" disabled={loading} onPress={()=>run(logout)}/>}
            </View>
          </Section>
          <Section label="GitHub OAuth">
            <View style={styles.fieldWrap}><Action title="Continue with GitHub" dark disabled={loading} onPress={()=>run(signInWithGitHub)}/></View>
          </Section>
        </> : section==='providers' ? <>
          <Note>Beam is the working provider path. ChatGPT Plus/Pro sharing only works for eligible authorized apps, so this project cannot simply use a subscription as an OpenAI API key.</Note>
          <Section label="Current provider">
            <Item title="Beam by Reflection" subtitle="Model Beam-1.0-501B-A23B" iconName="zap" trailing={status?.beam?'Key ready':'No key'} onPress={()=>{}}/>
            <Item title="Fallback: Vercel Beam Free" subtitle="Only if a Vercel gateway key is configured" iconName="repeat" trailing={status?.fallback?'Ready':'Off'} onPress={()=>{}}/>
            <Item title="ChatGPT Plus / Pro" subtitle="Subscription sharing not configured for this app" iconName="message-circle" trailing="Pending" onPress={()=>Alert.alert('ChatGPT plan','An eligible approved Sign in with ChatGPT integration is required. ChatGPT subscriptions are not generic API keys.')}/>
          </Section>
          <Section label="Server configuration"><View style={styles.fieldWrap}>
            <Text style={styles.fieldText}>Set REFLECTION_API_KEY in Supabase → Edge Function Secrets. You may alternatively set VERCEL_AI_GATEWAY_KEY for free-tier Beam requests. Do not paste keys into this app.</Text>
            <Action title="Refresh connection status" onPress={()=>run(async()=>setStatus(await noetharaAPI.status()))} disabled={loading}/>
          </View></Section>
          <Section label="Connection URLs"><View style={styles.fieldWrap}>
            <Text style={styles.caption}>YOUR PRIVATE BACKEND GATEWAY</Text>
            <Text selectable style={styles.url}>https://smiubazuuptrknffmouo.supabase.co/functions/v1/noethara-api/chat</Text>
            <Text style={styles.caption}>PRIMARY BEAM API (SERVER ONLY)</Text>
            <Text selectable style={styles.url}>https://api.reflection.ai/openai/v1</Text>
            <Text style={styles.caption}>OPTIONAL FREE-MODEL FALLBACK (SERVER ONLY)</Text>
            <Text selectable style={styles.url}>https://ai-gateway.vercel.sh/v1</Text>
          </View></Section>
        </> : <>
          <Note>Your GitHub OAuth callback is the fixed Supabase URL below. The second redirect returns to your running Expo app.</Note>
          <Section label="GitHub OAuth">
            <View style={styles.fieldWrap}>
              <Text style={styles.caption}>GITHUB OAUTH APP CALLBACK</Text><Text selectable style={styles.url}>{AUTH_CALLBACK_URL}</Text>
              <Text style={styles.caption}>EXPO GO REDIRECT (ALLOWLIST IN SUPABASE)</Text><Text selectable style={styles.url}>{getOAuthReturnUrl()}</Text>
              <Text style={styles.fieldText}>For Expo Go, the development redirect can change each time the tunnel changes. For permanent deep links, use a development or standalone build with noetharadev://auth/callback.</Text>
              <Action dark title={getGitHubToken()?'Reconnect GitHub':'Connect GitHub'} disabled={loading} onPress={()=>run(signInWithGitHub)}/>
              <Action title="Browse GitHub repositories" onPress={openRepos}/>
            </View>
          </Section>
          <Section label="Permissions"><View style={styles.fieldWrap}>
            <Text style={styles.fieldText}>GitHub requests currently support listing repositories and reading files for AI context. No commands, commits or clone operations are executed.</Text>
          </View></Section>
        </>}
        {loading&&<ActivityIndicator color={colors.purple} style={{marginTop:6}}/>}
        {!!message&&<Note>{message}</Note>}
      </ScrollView>
    </View>
  );
}

export function RepositoryBrowser({ onBack, onChoose }: {
  onBack:()=>void;onChoose:(file:SelectedGitHubFile)=>void;
}) {
  const [repos,setRepos]=useState<Repo[]>([]);
  const [selected,setSelected]=useState<Repo|null>(null);
  const [path,setPath]=useState('');
  const [entries,setEntries]=useState<GithubEntry[]>([]);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  async function loadRepos(){
    setLoading(true);setMessage('');
    try {setRepos((await noetharaAPI.repos()).repos);}
    catch(e){setMessage(e instanceof Error?e.message:'Could not load repositories');}
    finally {setLoading(false);}
  }
  async function openFolder(repo:Repo,nextPath:string){
    setLoading(true);setMessage('');
    try {
      const data=await noetharaAPI.contents(repo.full_name,nextPath,repo.default_branch);
      if(data.kind==='file'){onChoose({repo:repo.full_name,path:nextPath,branch:repo.default_branch});return;}
      setSelected(repo);setPath(nextPath);setEntries(data.entries||[]);
    }catch(e){setMessage(e instanceof Error?e.message:'Could not read file');}
    finally{setLoading(false);}
  }
  useEffect(()=>{loadRepos();},[]);
  return <View style={styles.root}>
    <View style={styles.header}>
      <Pressable style={styles.back} onPress={()=>{if(selected){setSelected(null);setPath('');}else onBack();}}>{icon('chevron-left',25)}</Pressable>
      <Text style={styles.heading}>{selected?'Repository Files':'GitHub Repositories'}</Text>
      <Pressable onPress={loadRepos}>{icon('refresh-cw',19)}</Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.scroll}>
      {selected&&<Text style={styles.repoInfo}>{selected.full_name} / {path||'root'}</Text>}
      {!selected&&<Note>Select a repository to browse its files and attach one to the AI chat. This is read-only, not a Linux clone.</Note>}
      {loading&&<ActivityIndicator color={colors.purple}/>}
      {!!message&&<Note>{message}</Note>}
      {!selected ? repos.map(r=><Item key={r.full_name} title={r.full_name}
        subtitle={(r.private?'Private':'Public')+' · '+r.default_branch} iconName="github"
        onPress={()=>openFolder(r,'')}/>) : <>
        {path!==''&&<Item title=".. (Parent folder)" iconName="corner-up-left" onPress={()=>{
          const parent=path.split('/').slice(0,-1).join('/');openFolder(selected,parent);
        }}/>}
        {entries.map(entry=><Item key={entry.path} title={entry.name}
          subtitle={entry.type==='dir'?'Folder':'Tap to attach to AI'} iconName={entry.type==='dir'?'folder':'file-text'}
          onPress={()=>openFolder(selected,entry.path)}/>)}
      </>}
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#FCFAF7'},
  header:{height:69,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:19},
  back:{padding:7,marginLeft:-7},heading:{fontSize:20,fontWeight:'700',color:colors.text},
  done:{color:colors.purple,fontSize:16,fontWeight:'600'},scroll:{padding:20,paddingTop:12,paddingBottom:40},
  sectionLabel:{fontSize:13,color:colors.muted,marginBottom:10,marginLeft:9,letterSpacing:0.1},
  section:{backgroundColor:'#FFF',borderRadius:20,borderColor:colors.line,borderWidth:1,overflow:'hidden'},
  item:{minHeight:68,paddingHorizontal:15,paddingVertical:13,flexDirection:'row',alignItems:'center',gap:13,
    borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#ECE9E6'},
  itemIcon:{height:37,width:37,borderRadius:11,backgroundColor:'#F6F4F1',alignItems:'center',justifyContent:'center'},
  itemTitle:{fontSize:16,color:colors.text,fontWeight:'500'},
  itemSubtitle:{fontSize:12.5,color:colors.muted,marginTop:3,lineHeight:18},
  muted:{fontSize:13,color:colors.muted},
  note:{backgroundColor:'#F3F0EB',borderRadius:16,padding:17,marginBottom:21},
  noteText:{fontSize:13,color:'#666369',lineHeight:21},
  fieldWrap:{padding:15,gap:12},fieldText:{fontSize:13,lineHeight:22,color:colors.muted},
  action:{backgroundColor:'#F6F4F1',paddingVertical:13,borderRadius:13,alignItems:'center',justifyContent:'center'},
  darkAction:{backgroundColor:'#202023'},actionText:{fontSize:14,fontWeight:'600',color:colors.text},
  input:{backgroundColor:'#F7F5F2',paddingHorizontal:14,paddingVertical:13,borderRadius:12,color:colors.text,fontSize:15},
  caption:{fontSize:11,fontWeight:'700',letterSpacing:0.3,color:colors.muted},
  url:{fontSize:12,color:colors.purple,lineHeight:19},
  repoInfo:{fontSize:13,color:colors.muted,marginBottom:14}
});

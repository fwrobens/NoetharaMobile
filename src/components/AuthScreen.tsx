import React, { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { signInWithEmail, signUpWithEmail, signInWithGitHub, signInWithGoogle } from '../lib/noetharaBackend';

export function AuthScreen({ onGuest }: { onGuest: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const act = async (name:string, callback:()=>Promise<unknown>) => {
    setError(''); setInfo(''); setLoading(name);
    try { await callback(); Keyboard.dismiss(); }
    catch(err) { setError(err instanceof Error ? err.message : 'Could not sign in.'); }
    finally { setLoading(null); }
  };
  const emailAuth = () => {
    if (!email.includes('@') || password.length < 6) {
      setError('Enter a valid email and password of at least six characters.');
      return;
    }
    void act('email', async () => {
      if (mode==='signup') {
        const session = await signUpWithEmail(email,password);
        if (!session) setInfo('Check your inbox for the confirmation email, then sign in.');
      } else await signInWithEmail(email,password);
    });
  };
  return (
    <LinearGradient colors={['#FCFBF9','#F8F6F2','#F4F1EE']} style={styles.root}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoRow}>
          <View style={styles.iconBox}><Feather name="terminal" size={24} color="#604B91" /></View>
          <Text style={styles.brand}>Noethara <Text style={{fontWeight:'400'}}>Dev</Text></Text>
          <View style={styles.liveDot}/>
        </View>
        <View style={styles.hero}>
          <Text style={styles.kicker}>YOUR DEVELOPMENT WORKSPACE</Text>
          <Text style={styles.headline}>Build anywhere.<Text style={{color:'#7C61BD'}}>\nCreate freely.</Text></Text>
          <Text style={styles.subline}>Your personal AI coding workspace, designed for the palm of your hand.</Text>
          <View style={styles.tagRow}>
            <View style={styles.tag}><Feather name="cpu" size={13} color="#74639B"/><Text style={styles.tagText}>Beam + NVIDIA</Text></View>
            <View style={styles.tag}><Feather name="github" size={13} color="#74639B"/><Text style={styles.tagText}>GitHub integration</Text></View>
          </View>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{mode==='signin'?'Welcome back':'Create your account'}</Text>
          <Text style={styles.panelSub}>Use your account to securely connect projects and models.</Text>
          <View style={styles.socialButtons}>
            <Pressable style={styles.social} onPress={()=>void act('github',signInWithGitHub)} disabled={loading!==null}>
              <Feather name="github" size={20} color="#222226"/><Text style={styles.socialText}>Continue with GitHub</Text>
              {loading==='github'&&<ActivityIndicator color="#7053BC"/>}
            </Pressable>
            <Pressable style={styles.social} onPress={()=>void act('google',signInWithGoogle)} disabled={loading!==null}>
              <Text style={styles.googleMark}>G</Text><Text style={styles.socialText}>Continue with Google</Text>
              {loading==='google'&&<ActivityIndicator color="#7053BC"/>}
            </Pressable>
          </View>
          <View style={styles.or}><View style={styles.rule}/><Text style={styles.orText}>OR CONTINUE WITH EMAIL</Text><View style={styles.rule}/></View>
          <View style={styles.field}>
            <Feather name="mail" size={18} color="#98969C"/>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
              autoComplete="email" placeholder="Email address" placeholderTextColor="#AAA6AC" style={styles.input}/>
          </View>
          <View style={styles.field}>
            <Feather name="lock" size={18} color="#98969C"/>
            <TextInput value={password} onChangeText={setPassword} autoCapitalize="none"
              autoComplete={mode==='signin'?'current-password':'new-password'} secureTextEntry={!showPassword}
              placeholder="Password" placeholderTextColor="#AAA6AC" style={styles.input}/>
            <Pressable onPress={()=>setShowPassword(!showPassword)} accessibilityLabel="Show or hide password">
              <Feather name={showPassword?'eye-off':'eye'} size={18} color="#8E8B94"/>
            </Pressable>
          </View>
          {!!error&&<Text style={styles.error}>{error}</Text>}
          {!!info&&<Text style={styles.info}>{info}</Text>}
          <Pressable style={styles.submit} onPress={emailAuth} disabled={loading!==null}>
            {loading==='email'?<ActivityIndicator color="#FFFFFF"/>:<><Text style={styles.submitText}>{mode==='signin'?'Sign in':'Create account'}</Text><Feather name="arrow-right" color="#FFFFFF" size={20}/></>}
          </Pressable>
          <Pressable onPress={()=>{setMode(mode==='signin'?'signup':'signin');setError('');}}>
            <Text style={styles.switchText}>{mode==='signin'?"New here?  ":'Already registered?  '}
              <Text style={styles.switchAction}>{mode==='signin'?'Create an account':'Sign in'}</Text></Text>
          </Pressable>
        </View>
        <Pressable style={styles.guest} onPress={onGuest}>
          <Text style={styles.guestText}>Explore UI preview</Text><Feather name="arrow-up-right" size={16} color="#6D6176"/>
        </Pressable>
        <Text style={styles.footer}>Private workspace · API keys stay on the server</Text>
      </ScrollView>
    </LinearGradient>
  );
}
const styles=StyleSheet.create({
 root:{flex:1},
 content:{paddingHorizontal:25,paddingTop:22,paddingBottom:38,flexGrow:1},
 logoRow:{flexDirection:'row',alignItems:'center',gap:11,marginTop:4},
 iconBox:{width:42,height:42,borderRadius:14,backgroundColor:'#F0EAF7',borderColor:'#FFFFFF',borderWidth:1,alignItems:'center',justifyContent:'center'},
 brand:{fontWeight:'700',letterSpacing:-0.5,fontSize:20,color:'#282529'},
 liveDot:{width:9,height:9,borderRadius:9,backgroundColor:'#28C968'},
 hero:{marginTop:38,marginBottom:34},
 kicker:{color:'#A49AAB',fontWeight:'700',letterSpacing:1.4,fontSize:10.5,marginBottom:12},
 headline:{color:'#242127',fontSize:38,fontWeight:'700',letterSpacing:-1.8,lineHeight:46},
 subline:{color:'#85808A',fontSize:14.5,lineHeight:23,marginTop:16,maxWidth:330},
 tagRow:{flexDirection:'row',gap:9,marginTop:21,flexWrap:'wrap'},
 tag:{flexDirection:'row',gap:7,alignItems:'center',borderRadius:13,backgroundColor:'rgba(245,240,248,0.95)',paddingHorizontal:12,paddingVertical:9},
 tagText:{fontSize:11,color:'#6D617A',fontWeight:'600'},
 panel:{backgroundColor:'#FFFFFF',padding:20,borderRadius:26,borderWidth:1,borderColor:'#FFFFFF',
  shadowColor:'#867D77',shadowOpacity:0.12,shadowOffset:{width:0,height:12},shadowRadius:29,elevation:4},
 panelTitle:{fontSize:22,color:'#272429',fontWeight:'700',letterSpacing:-0.5},
 panelSub:{marginTop:5,color:'#98949B',fontSize:12.5,lineHeight:19,marginBottom:20},
 socialButtons:{gap:9},
 social:{height:49,backgroundColor:'#F9F8F6',borderRadius:13,flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:16,borderColor:'#EDE9E6',borderWidth:1},
 socialText:{flex:1,fontSize:14,fontWeight:'600',color:'#323036'},
 googleMark:{fontWeight:'800',fontSize:20,color:'#4285F4',width:20,textAlign:'center'},
 or:{flexDirection:'row',alignItems:'center',marginVertical:18,gap:9},
 rule:{flex:1,height:1,backgroundColor:'#EDEBE9'},
 orText:{fontSize:9,fontWeight:'600',color:'#B0ABB2',letterSpacing:0.9},
 field:{height:48,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#F9F8F6',
  borderRadius:13,paddingHorizontal:14,marginBottom:10,borderColor:'#F1EEEC',borderWidth:1},
 input:{flex:1,fontSize:14.5,color:'#252429',height:'100%'},
 error:{fontSize:12,color:'#C45050',lineHeight:18,marginTop:2},
 info:{fontSize:12,color:'#447C52',lineHeight:18,marginTop:2},
 submit:{marginTop:11,backgroundColor:'#222124',height:52,borderRadius:14,
  alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10},
 submitText:{color:'#FFFFFF',fontWeight:'700',fontSize:15},
 switchText:{textAlign:'center',fontSize:12.5,color:'#96919B',marginTop:19},
 switchAction:{fontWeight:'700',color:'#7857C5'},
 guest:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8,paddingTop:28,paddingBottom:16},
 guestText:{fontSize:13,fontWeight:'600',color:'#6D6176'},
 footer:{fontSize:11,color:'#A6A0A7',textAlign:'center'},
});

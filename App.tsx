import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Rect } from 'react-native-svg';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { IntegrationsSettings, RepositoryBrowser, type SelectedGitHubFile } from './src/components/NoetharaIntegrations';
import { ConnectedChat } from './src/components/ConnectedChat';
import { AuthScreen } from './src/components/AuthScreen';
import { LocalPlayground } from './src/components/LocalPlayground';
import { RemoteTerminal } from './src/components/RemoteTerminal';
import { TerminalDashboard } from './src/components/TerminalDashboard';
import type { SelectedProject } from './src/lib/githubRepoContext';
import { supabase, getSession, getPreferredModel, savePreferredModel, listConversations, recoverPendingOAuthRedirect, handleOAuthRedirect, type ConversationSummary, BEAM_ID } from './src/lib/noetharaBackend';
import { ModelPicker } from './src/components/ModelPicker';

type Page = 'workspace' | 'terminals' | 'chat' | 'files' | 'settings' | 'playground' | 'terminal';
type FeatherName = React.ComponentProps<typeof Feather>['name'];
type ToolKey = 'ESC' | '+' | 'TAB' | 'CTRL' | 'up' | 'down' | 'left' | 'right' | 'mic' | 'hide';

const COLORS = {
  ink: '#202124',
  muted: '#929396',
  mutedDark: '#74777C',
  ivory: '#FAF9F6',
  violet: '#7150C7',
  amber: '#DD941F',
  green: '#29C45D',
  border: 'rgba(83, 76, 64, 0.065)',
  shadow: '#9B9188',
};
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const FONT = Platform.OS === 'ios' ? 'System' : 'sans-serif';

function Icon({ name, size = 20, color = COLORS.ink }: { name: FeatherName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}
function SoftPanel({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <View style={[styles.softPanel, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.93)', 'rgba(255,255,255,0.55)', 'rgba(246,242,236,0.27)']}
        start={{ x: 0.03, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </View>
  );
}
function Tap({ onPress, children, style, accessibilityLabel }: { onPress: () => void; children: React.ReactNode; style?: any; accessibilityLabel?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [style, pressed && { opacity: 0.72, transform: [{ scale: 0.97 }] }]}>
      {children}
    </Pressable>
  );
}

const GLYPHS: Record<string, string[]> = {
  o: ['00000', '01110', '01010', '01010', '01010', '01110', '00000'],
  p: ['00000', '01110', '01010', '01110', '01000', '01000', '01000'],
  e: ['00000', '01110', '01010', '01110', '01000', '01110', '00000'],
  n: ['00000', '01100', '01010', '01010', '01010', '01010', '00000'],
  c: ['00000', '01110', '01000', '01000', '01000', '01110', '00000'],
  d: ['00010', '00010', '01110', '01010', '01010', '01110', '00000'],
};

function OpenCodeWordmark({ width }: { width: number }) {
  const step = 6;
  const letters = 'opencode'.split('');
  const virtualWidth = letters.length * step - 1;
  const painted = letters.flatMap((letter, i) =>
    GLYPHS[letter].flatMap((row, y) =>
      row.split('').flatMap((digit, x) => digit === '1'
        ? [<Rect key={String(i) + '-' + String(y) + '-' + String(x)} x={i * step + x} y={y}
             width={1.045} height={1.045} fill={i < 4 ? (i % 2 === 0 ? '#909092' : '#A3A1A0') : '#202022'} />]
        : [])));
  return (
    <Svg accessible accessibilityLabel="Two-tone OpenCode logo" width={width} height={width * 7 / virtualWidth}
      viewBox={'0 0 ' + String(virtualWidth) + ' 7'}>
      {painted}
    </Svg>
  );
}
function OrbitalHero({ size }: { size: number }) {
  const orbit = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const rotating = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true }));
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(halo, { toValue: 1, duration: 3200, useNativeDriver: true }),
      Animated.timing(halo, { toValue: 0, duration: 3200, useNativeDriver: true }),
    ]));
    rotating.start(); floating.start(); breathing.start();
    return () => { rotating.stop(); floating.stop(); breathing.stop(); };
  }, [orbit, bob, halo]);
  const rotation = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const translation = bob.interpolate({ inputRange: [0, 1], outputRange: [3, -6] });
  const alpha = halo.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: alpha }]}>
        <Svg width={size} height={size} viewBox="0 0 250 250">
          <Circle cx="125" cy="125" r="114" stroke="#DAD6D1" strokeWidth="0.8" fill="none" />
          <Circle cx="125" cy="125" r="77" stroke="#D5D0CA" strokeWidth="1" fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ rotate: rotation }] }]}>
        <View style={[styles.orbDot, { top: '17%', left: '16%', backgroundColor: '#7656C7' }]} />
        <View style={[styles.orbDot, { top: '46%', right: '-1%', backgroundColor: '#DC9422' }]} />
        <View style={[styles.orbDot, { bottom: '16%', left: '31%', width: 12, height: 12, backgroundColor: '#C9C9C9' }]} />
      </Animated.View>
      <Animated.View style={[styles.terminalTile, { transform: [{ translateY: translation }] }]}>
        <LinearGradient colors={['#FFFFFF', '#FBFAF8', '#F4F1ED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 25 }]} />
        <Icon name="terminal" size={36} color="#4C4D4F" />
      </Animated.View>
    </View>
  );
}

function Header({ title, onMenu, isChat = false }: { title: string; onMenu: () => void; isChat?: boolean }) {
  return (
    <View style={styles.header}>
      <Tap style={styles.headerIcon} onPress={onMenu} accessibilityLabel="Open navigation">
        <Icon name="menu" size={27} />
      </Tap>
      {isChat ? (
        <Text style={styles.chatHeader}>{title}</Text>
      ) : (
        <View style={styles.headerLabel}>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.liveDot} />
        </View>
      )}
      <Tap style={styles.headerMore} onPress={() => Alert.alert('Workspace', 'UI preview — cloud terminal integration is not connected yet.')} accessibilityLabel="More options">
        <Icon name="more-horizontal" size={26} />
      </Tap>
    </View>
  );
}
function TipCard() {
  return (
    <SoftPanel style={styles.tipPanel}>
      <View style={styles.tipIcon}><MaterialCommunityIcons name="lightbulb-outline" size={23} color="#383633" /></View>
      <Text style={styles.tipText}>
        <Text style={{ color: COLORS.amber }}>Tip  </Text>
        Run <Text style={{ color: '#252628' }}>/connect</Text> to add an AI provider and start coding
      </Text>
    </SoftPanel>
  );
}
function ShortcutHint({ label, detail }: { label: string; detail: string }) {
  return <View style={styles.hint}><Text style={styles.hintKey}>{label}</Text><Text style={styles.hintText}>{detail}</Text></View>;
}
function HintRow() {
  return <View style={styles.hintRow}><ShortcutHint label="tab" detail="agents" /><ShortcutHint label="ctrl+p" detail="commands" /></View>;
}
function TerminalFooter() {
  return (
    <View style={styles.terminalFooter}>
      <Text style={styles.footerMuted}>~</Text>
      <View style={styles.footerGreen}><View style={styles.footerGreenDot} /></View>
      <Text style={styles.footerStrong}>1 MCP</Text>
      <Text style={styles.footerMuted}>/status</Text>
      <View style={{ flex: 1 }} />
      <Text style={styles.footerMuted}>1.18.31</Text>
    </View>
  );
}
function EditorToolbar({ onKey }: { onKey: (key: ToolKey) => void }) {
  const { width } = useWindowDimensions();
  const buttons: Array<{ key: ToolKey; icon?: FeatherName; label?: string }> = [
    { key: 'ESC', label: 'ESC', icon: 'rotate-ccw' }, { key: '+', icon: 'plus' },
    { key: 'TAB', label: 'TAB', icon: 'corner-down-right' }, { key: 'CTRL', label: 'CTRL' },
    { key: 'up', icon: 'arrow-up' }, { key: 'down', icon: 'arrow-down' },
    { key: 'left', icon: 'arrow-left' }, { key: 'right', icon: 'arrow-right' },
    { key: 'mic', icon: 'mic' }, { key: 'hide', icon: 'chevrons-down' },
  ];
  // Shrink the key proportions as one row instead of clipping the final
  // keyboard dismissal control on smaller iPhones.
  const narrow = width < 350;
  return (
    <LinearGradient colors={['rgba(245,243,244,0.97)', 'rgba(237,236,239,0.98)']} style={styles.editorToolbar}>
      <View style={styles.toolbarContents}>
        {buttons.map(b =>
          <Tap key={b.key} style={[styles.toolbarKey, {
            flex: b.key === 'ESC' || b.key === 'TAB' ? 1.38 : b.key === 'CTRL' ? 1.14 : 1,
          }]} onPress={() => onKey(b.key)} accessibilityLabel={b.key === 'hide' ? 'Hide keyboard' : b.key}>
            {b.icon && <Icon name={b.icon} size={b.label ? (narrow ? 11 : 12) : (narrow ? 17 : 19)} />}
            {b.label && <Text numberOfLines={1} style={[styles.toolbarLabel, narrow && { fontSize: 8 }]}>{b.label}</Text>}
          </Tap>
        )}
      </View>
    </LinearGradient>
  );
}
function Composer({
  prompt, setPrompt, inputRef, selection, setSelection, onFocus, onBlur, onSend,
  isFocused, mode, setMode, provider, setProvider, openModelPicker, quality, setQuality,
}: {
  prompt: string; setPrompt: (value: string) => void; inputRef: React.RefObject<TextInput | null>;
  selection: { start: number; end: number }; setSelection: (value: { start: number; end: number }) => void;
  onFocus: () => void; onBlur: () => void; onSend: () => void;
  isFocused: boolean; mode: string; setMode: (value: string) => void; provider: string;
  setProvider: (value: string) => void; openModelPicker: () => void; quality: string; setQuality: (value: string) => void;
}) {
  const choose = (label: string, options: string[], setter: (value: string) => void) => {
    Alert.alert(label, 'Visual selector — no external API is connected.', [
      ...options.map(text => ({ text, onPress: () => setter(text) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };
  return (
    <SoftPanel style={[styles.composerPanel, isFocused && styles.composerFocused]}>
      <LinearGradient colors={['#7353CA', '#A17BDA']} style={styles.composerAccent} />
      <View style={styles.composerInputArea}>
        <TextInput
          ref={inputRef} value={prompt} onChangeText={setPrompt} multiline
          autoCapitalize="sentences" autoCorrect={false}
          placeholder={'Ask anything… "Fix a TODO\nin the codebase"'}
          placeholderTextColor="#929394"
          onFocus={onFocus} onBlur={onBlur}
          onSelectionChange={event => setSelection(event.nativeEvent.selection)}
          selection={selection}
          style={styles.composerInput}
          returnKeyType="default"
          accessibilityLabel="Ask OpenCode"
        />
        {isFocused && (
          <Tap onPress={onSend} style={styles.sendBubble} accessibilityLabel="Send prompt">
            <Icon name="arrow-up" color="#FFFFFF" size={24} />
          </Tap>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
        style={styles.composerTools} contentContainerStyle={styles.composerToolsContent}>
        <Tap style={styles.option} onPress={() => choose('Agent mode', ['Build', 'Plan'], setMode)}>
          <Icon name="hexagon" color={COLORS.violet} size={18} />
          <Text style={[styles.optionText, { color: COLORS.violet }]}>{mode}</Text><Icon name="chevron-down" color={COLORS.violet} size={13} />
        </Tap>
        <Text style={styles.optionDivider}>·</Text>
        <Tap style={styles.option} onPress={openModelPicker}>
          <Text numberOfLines={1} style={[styles.optionText,{maxWidth:105}]}>{provider.includes('/')?provider.split('/').pop():provider.replace('Beam-1.0-501B-A23B','Beam Free')}</Text><Icon name="chevron-down" color={COLORS.ink} size={13} />
        </Tap>
        <Text style={styles.optionDivider}>·</Text>
        <Tap style={styles.option} onPress={() => Alert.alert('OpenCode', 'OpenCode server integration is planned. This is a native front-end preview.')}>
          <Text style={[styles.optionText, { color: COLORS.mutedDark }]}>OpenCode</Text><Icon name="chevron-down" color={COLORS.mutedDark} size={13} />
        </Tap>
        <Text style={styles.optionDivider}>·</Text>
        <Tap style={styles.option} onPress={() => choose('Reasoning effort', ['max', 'normal', 'min'], setQuality)}>
          <Text style={[styles.optionText, { color: COLORS.amber }]}>{quality}</Text><Icon name="chevron-down" color={COLORS.amber} size={13} />
        </Tap>
      </ScrollView>
    </SoftPanel>
  );
}

function Workspace({
  openMenu, prompt, setPrompt, inputRef, selection, setSelection,
  keyboardVisible, setKeyboardVisible, send, onTool, mode, setMode, provider, setProvider, openModelPicker, quality, setQuality,
}: {
  openMenu: () => void; prompt: string; setPrompt: (p: string) => void; inputRef: React.RefObject<TextInput | null>;
  selection: { start: number; end: number }; setSelection: (v: { start: number; end: number }) => void;
  keyboardVisible: boolean; setKeyboardVisible: (v: boolean) => void; send: () => void;
  onTool: (key: ToolKey) => void;
  mode: string; setMode: (v: string) => void; provider: string; setProvider: (v: string) => void; openModelPicker: () => void;
  quality: string; setQuality: (v: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const small = height < 750;
  // Content scrolls when the phone is short; the footer remains in a separate
  // layout row. This prevents the tip from overlapping the terminal status.
  const heroHeight = Math.min(315, Math.max(small ? 192 : 230, height * (small ? 0.305 : 0.365)));
  return (
    <View style={styles.fill}>
      <Header title="Noethara Dev" onMenu={openMenu} />
      <View style={[styles.workspaceBody, { width: Math.min(width, 520) }]}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.workspaceScrollContent, keyboardVisible && styles.workspaceScrollFocused]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none">
          {!keyboardVisible && (
            <View style={[styles.hero, { height: heroHeight }]}>
              <OrbitalHero size={Math.min(width * (small ? 0.48 : 0.53), 207)} />
              <View style={styles.wordmark}>
                <OpenCodeWordmark width={Math.min(width - 68, 341)} />
              </View>
            </View>
          )}
          <View style={keyboardVisible ? styles.focusedComposerWrap : styles.composerWrap}>
            <Composer prompt={prompt} setPrompt={setPrompt} inputRef={inputRef}
              selection={selection} setSelection={setSelection}
              onFocus={() => setKeyboardVisible(true)} onBlur={() => setKeyboardVisible(false)}
              onSend={send} isFocused={keyboardVisible}
              mode={mode} setMode={setMode} provider={provider} setProvider={setProvider} openModelPicker={openModelPicker}
              quality={quality} setQuality={setQuality} />
            <HintRow />
          </View>
          {!keyboardVisible && <View style={styles.workspaceSpacer} />}
          <View style={[styles.tipWrap, keyboardVisible && styles.tipFocused]}>
            <TipCard />
          </View>
        </ScrollView>
        <View style={styles.workspaceDock}>
          {keyboardVisible ? <EditorToolbar onKey={onTool} /> : <TerminalFooter />}
        </View>
      </View>
    </View>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <View style={styles.badge}><Text style={styles.badgeText}>{children}</Text></View>;
}
function ChatPage({ onMenu, latest }: { onMenu: () => void; latest: string }) {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<string[]>(latest ? [latest] : []);
  return (
    <View style={styles.fill}>
      <Header title="New Chat" isChat onMenu={onMenu} />
      <View style={styles.chatBody}>
        <ScrollView style={styles.fill} contentContainerStyle={{ paddingVertical: 18 }} keyboardShouldPersistTaps="handled">
          {conversation.map((m, i) =>
            <View style={styles.chatBubble} key={String(i)}><Text style={styles.chatBubbleText}>{m}</Text></View>
          )}
          {conversation.length > 0 && <SoftPanel style={{ padding: 14, marginTop: 13 }}>
            <Text style={styles.infoCopy}>Your message is saved in this local preview. Connect an OpenCode server and AI provider to receive agent responses.</Text>
          </SoftPanel>}
        </ScrollView>
        <Tap style={styles.projectPicker} onPress={() => Alert.alert('Projects', 'No GitHub project is connected yet.')}>
          <Icon name="folder" size={17} color={COLORS.mutedDark} /><Text style={{ fontSize: 13, color: COLORS.ink }}>No project</Text><Icon name="chevron-down" size={14} />
        </Tap>
        {conversation.length === 0 && <SoftPanel style={styles.gitHubBox}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Icon name="github" size={25} /><Text style={[styles.infoCopy, { flex: 1 }]}>Connect GitHub so your agent can read and push to your repos.</Text>
          </View>
          <Tap style={styles.gitHubButton} onPress={() => Alert.alert('GitHub', 'GitHub OAuth integration is not installed yet. This is the native UI preview.')}>
            <Icon name="link" color="#FFFFFF" size={18}/><Text style={styles.gitHubButtonText}>Connect GitHub</Text>
          </Tap>
          <Text style={[styles.projectMeta, { textAlign: 'center' }]}>Prefer the terminal? Use GitHub CLI</Text>
        </SoftPanel>}
        <SoftPanel style={styles.chatComposer}>
          <TextInput
            multiline style={styles.chatMessageInput} placeholder="Message" placeholderTextColor={COLORS.muted}
            value={message} onChangeText={setMessage}
          />
          <View style={styles.chatActions}>
            <Tap onPress={() => Alert.alert('Attachments', 'Attachment support is not connected in this preview.')}><Icon name="plus-circle" size={22} color={COLORS.mutedDark}/></Tap>
            <Tap style={styles.selectModel} onPress={() => Alert.alert('AI model', 'Select a model once the AI API is connected.')}>
              <Text style={{ fontSize: 13, color: COLORS.ink }}>Select model</Text><Icon name="chevron-down" size={14}/>
            </Tap>
            <Tap onPress={() => Alert.alert('Permissions', 'Terminal permissions will be configurable once a remote agent is connected.')}><Icon name="shield" color={COLORS.mutedDark} size={20}/></Tap>
            <Tap onPress={() => Alert.alert('Voice', 'Use the iPhone dictation microphone on the system keyboard.')}><Icon name="mic" size={20} color={COLORS.mutedDark}/></Tap>
            <Tap onPress={() => { if (message.trim()) { setConversation(old => [...old, message.trim()]); setMessage(''); Keyboard.dismiss(); } }} style={styles.roundSend}>
              <Icon name="arrow-up" size={21} color="#FFFFFF"/>
            </Tap>
          </View>
        </SoftPanel>
      </View>
    </View>
  );
}
function FilesPage({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.fill}>
      <View style={styles.pageHeading}>
        <Tap onPress={onBack} style={styles.backButton}><Icon name="chevron-left" size={28} /></Tap>
        <Text style={styles.bigHeading}>Files</Text>
      </View>
      <View style={styles.emptyFiles}>
        <SoftPanel style={styles.emptyFolder}><Icon name="folder" size={38} color={COLORS.violet} /></SoftPanel>
        <Text style={styles.emptyTitle}>Your files, in one place.</Text>
        <Text style={styles.emptySub}>Once you connect a project workspace, its folders and code files will appear here.</Text>
      </View>
    </View>
  );
}

function NavigationDrawer({
  progress, active, onClose, onNavigate, page, chats, onOpenChat, onNewChat, onTerminal
}: {
  progress: Animated.Value; active:boolean; onClose:()=>void; onNavigate:(p:Page)=>void; page:Page;
  chats: ConversationSummary[]; onOpenChat:(id:string)=>void; onNewChat:()=>void; onTerminal:()=>void;
}) {
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width*0.79,338);
  const offset = progress.interpolate({inputRange:[0,1],outputRange:[-drawerWidth,0],extrapolate:'clamp'});
  const backdropOpacity = progress.interpolate({inputRange:[0,1],outputRange:[0,0.34],extrapolate:'clamp'});
  return (
    <View pointerEvents={active?'auto':'none'} style={styles.drawerOverlay}>
      <Animated.View style={[StyleSheet.absoluteFillObject,{opacity:backdropOpacity,backgroundColor:'#101012'}]}>
        <Pressable accessibilityLabel="Close menu" onPress={onClose} style={StyleSheet.absoluteFillObject}/>
      </Animated.View>
      <Animated.View style={[styles.drawerShell,{width:drawerWidth,transform:[{translateX:offset}]}]}>
        <LinearGradient colors={['#FEFDFC','#FCFBF9','#F9F7F4']} style={StyleSheet.absoluteFillObject}/>
        <SafeAreaView style={styles.fill} edges={['top','bottom']}>
          <View style={styles.drawerBrand}><Text style={styles.drawerBrandText}>Noethara Dev</Text><View style={styles.liveDot}/></View>
          <View style={{gap:4,marginTop:20}}>
            {([
              {label:'Terminals',icon:'terminal' as FeatherName,page:'terminals' as Page},
              {label:'Code',icon:'message-circle' as FeatherName,page:'chat' as Page},
              {label:'Files',icon:'folder' as FeatherName,page:'files' as Page},
              {label:'Playground',icon:'code' as FeatherName,page:'playground' as Page},
            ]).map(item=><Tap key={item.page} onPress={()=>onNavigate(item.page)}
              style={[styles.drawerNavItem,page===item.page&&styles.drawerSelected]}>
              <Icon name={item.icon} size={22}/><Text style={[styles.drawerNavText,{fontSize:17}]}>{item.label}</Text>
            </Tap>)}
          </View>
          <Text style={[styles.drawerSubheading,{marginTop:19,marginBottom:10}]}>Open terminals</Text>
          <Tap onPress={onTerminal} style={styles.drawerTerminal}>
            <Icon name="monitor" size={20}/><Text style={[styles.drawerNavText,{fontSize:16}]}>OpenCode CLI</Text>
            <Icon name="chevron-right" size={16} color={COLORS.muted}/>
          </Tap>
          <View style={{flex:1,minHeight:80,marginTop:16}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingRight:22}}>
              <Text style={[styles.drawerSubheading,{marginTop:6,marginBottom:12}]}>Recent chats</Text>
              <Tap onPress={onNewChat} style={{padding:8}}><Icon name="plus" size={20}/></Tap>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
              contentContainerStyle={{paddingHorizontal:14,paddingBottom:15}}>
              {chats.length===0&&<Text style={{color:'#969199',fontSize:12,paddingHorizontal:12,paddingVertical:9}}>Your conversations appear here.</Text>}
              {chats.map(chat=><Tap onPress={()=>onOpenChat(chat.id)} key={chat.id}
                style={{paddingHorizontal:12,paddingVertical:13,borderRadius:12,flexDirection:'row',alignItems:'center',gap:12}}>
                <Icon name="message-square" size={16} color="#756B7C"/>
                <Text numberOfLines={1} style={{fontSize:14,color:'#4A4750',flex:1}}>{chat.title||'New chat'}</Text>
              </Tap>)}
            </ScrollView>
          </View>
          <View style={styles.drawerBottom}>
            <Tap onPress={()=>onNavigate('settings')} style={styles.settingsRound}><Icon name="settings" size={24}/></Tap>
            <Tap onPress={onNewChat} style={styles.drawerNew}><Icon name="plus" size={24} color="#FFFFFF"/><Text style={styles.drawerNewText}>New chat</Text></Tap>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function RootApp() {
  const [page,setPage]=useState<Page>('workspace');
  const [authReady,setAuthReady]=useState(false);
  const [signedIn,setSignedIn]=useState(false);
  const [guestPreview,setGuestPreview]=useState(false);
  const [showHomeModels,setShowHomeModels]=useState(false);
  const [keyboardVisible,setKeyboardVisible]=useState(false);
  const [prompt,setPrompt]=useState('');
  const [mode,setMode]=useState('Build');
  const [provider,setProvider]=useState(BEAM_ID);
  const [quality,setQuality]=useState('max');
  const [lastMessage,setLastMessage]=useState('');
  const [githubFile,setGithubFile]=useState<SelectedGitHubFile|null>(null);
  const [githubProject,setGithubProject]=useState<SelectedProject|null>(null);
  const [selection,setSelection]=useState({start:0,end:0});
  const [chats,setChats]=useState<ConversationSummary[]>([]);
  const [activeChatId,setActiveChatId]=useState<string|null>(null);
  const [chatVersion,setChatVersion]=useState(0);
  const [terminalAgent,setTerminalAgent]=useState<'opencode'|'codex'|'claude'>('opencode');
  const inputRef=useRef<TextInput>(null);
  const {width:screenWidth}=useWindowDimensions();
  const drawerWidth=Math.min(screenWidth*0.79,338);
  const drawerProgress=useRef(new Animated.Value(0)).current;
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [drawerDragging,setDrawerDragging]=useState(false);
  const drawerActive=drawerOpen||drawerDragging;
  const settleDrawer=(open:boolean)=>{
    setDrawerOpen(open);
    setDrawerDragging(false);
    Animated.spring(drawerProgress,{toValue:open?1:0,useNativeDriver:true,
      speed:24,bounciness:0,overshootClamping:true}).start();
  };
  const refreshChats=()=>{
    if(!signedIn)return;
    void listConversations().then(setChats).catch(()=>{});
  };
  useEffect(()=>{
    let active=true;
    void recoverPendingOAuthRedirect()
      .catch(()=>null)
      .then(()=>getSession())
      .then(session=>{if(active){setSignedIn(!!session);setAuthReady(true);}})
      .catch(()=>{if(active)setAuthReady(true);});
    const subscription=Linking.addEventListener('url',({url})=>{
      if(/[?&#](code|access_token|error)=/.test(url)){
        void handleOAuthRedirect(url)
          .then(session=>{if(session&&active){setSignedIn(true);setGuestPreview(false);}})
          .catch(()=>{});
      }
    });
    const {data:authListener}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(active){setSignedIn(!!session);if(session)setGuestPreview(false);}
    });
    return()=>{active=false;subscription.remove();authListener.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{void getPreferredModel().then(setProvider).catch(()=>{});},[]);
  useEffect(()=>{if(signedIn)refreshChats();else setChats([]);},[signedIn]);
  useEffect(()=>{
    const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboardVisible(true));
    const hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboardVisible(false));
    return()=>{show.remove();hide.remove();};
  },[]);
  const gestures=React.useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponderCapture:(_e,g)=>{
      if(keyboardVisible)return false;
      const sideways=Math.abs(g.dx)>6&&Math.abs(g.dx)>Math.abs(g.dy)*1.2;
      if(!sideways)return false;
      if(drawerOpen)return g.dx<0&&g.x0<drawerWidth+12;
      return g.dx>0&&g.x0<45;
    },
    onPanResponderGrant:()=>{
      drawerProgress.stopAnimation();
      setDrawerDragging(true);
    },
    onPanResponderMove:(_e,g)=>{
      const value=drawerOpen?1+g.dx/drawerWidth:g.dx/drawerWidth;
      drawerProgress.setValue(Math.max(0,Math.min(1,value)));
    },
    onPanResponderRelease:(_e,g)=>{
      const amount=drawerOpen?1+g.dx/drawerWidth:g.dx/drawerWidth;
      const shouldOpen=drawerOpen
        ? amount>0.56 && g.vx> -0.5
        : amount>0.35 || g.vx>0.55;
      settleDrawer(shouldOpen);
    },
    onPanResponderTerminate:()=>settleDrawer(drawerOpen),
    onPanResponderTerminationRequest:()=>true,
  }),[drawerOpen,keyboardVisible,drawerWidth,drawerProgress]);
  const openDrawer=()=>{Keyboard.dismiss();refreshChats();settleDrawer(true);};
  const closeDrawer=()=>settleDrawer(false);
  const go=(next:Page)=>{
    Keyboard.dismiss();setKeyboardVisible(false);
    closeDrawer();
    setPage(next);
  };
  const newChat=()=>{
    setActiveChatId(null);setLastMessage('');setChatVersion(v=>v+1);
    go('chat');
  };
  const openHistory=(id:string)=>{
    setActiveChatId(id);setLastMessage('');setChatVersion(v=>v+1);
    go('chat');
  };
  const send=()=>{
    if(!prompt.trim())return;
    setActiveChatId(null);
    setLastMessage(prompt.trim());
    setChatVersion(v=>v+1);
    setPrompt('');
    Keyboard.dismiss();setKeyboardVisible(false);
    setPage('chat');
  };
  const openTerminal=(agent:'opencode'|'codex'|'claude'='opencode')=>{
    setTerminalAgent(agent);go('terminal');
  };
  const tool=(key:ToolKey)=>{
    if(key==='hide'||key==='ESC'){Keyboard.dismiss();inputRef.current?.blur();return;}
    if(key==='mic'){Alert.alert('Dictation','Use the microphone on the iPhone keyboard.');return;}
    if(key==='CTRL'){Alert.alert('CTRL','Hardware keyboard modifiers are supported by iOS.');return;}
    if(key==='up'||key==='down'||key==='left'||key==='right'){
      const delta=(key==='left'||key==='up')?-1:1;
      const pos=Math.max(0,Math.min(prompt.length,selection.start+delta));
      setSelection({start:pos,end:pos});inputRef.current?.focus();return;
    }
    const insert=key==='TAB'?'  ':'+';
    const start=Math.min(selection.start,selection.end);
    const end=Math.max(selection.start,selection.end);
    setPrompt(prompt.slice(0,start)+insert+prompt.slice(end));
    const pos=start+insert.length;
    setSelection({start:pos,end:pos});inputRef.current?.focus();
  };
  if(!authReady)return <View style={[styles.fill,{backgroundColor:'#FCFAF7',alignItems:'center',justifyContent:'center'}]}>
    <Text style={{color:'#8165C9'}}>Loading Noethara Dev…</Text>
  </View>;
  if(!signedIn&&!guestPreview)return <View style={{flex:1,backgroundColor:'#FCFAF7'}}>
    <StatusBar style="dark"/>
    <SafeAreaView style={styles.fill} edges={['top','bottom']}>
      <AuthScreen onGuest={()=>setGuestPreview(true)}/>
    </SafeAreaView>
  </View>;
  return (
    <View style={styles.fill} {...gestures.panHandlers}>
      <LinearGradient colors={['#FCFAF7','#FBF9F6','#F7F5F2']} style={styles.fill}>
        <StatusBar style="dark"/>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS==='ios'?'padding':undefined}>
          <SafeAreaView style={styles.fill} edges={keyboardVisible?['top']:['top','bottom']}>
            {page==='workspace'&&<Workspace openMenu={openDrawer} prompt={prompt} setPrompt={setPrompt}
              inputRef={inputRef} selection={selection} setSelection={setSelection}
              keyboardVisible={keyboardVisible} setKeyboardVisible={setKeyboardVisible}
              send={send} onTool={tool} mode={mode} setMode={setMode} provider={provider}
              setProvider={setProvider} openModelPicker={()=>setShowHomeModels(true)}
              quality={quality} setQuality={setQuality}/>}
            {page==='terminals'&&<TerminalDashboard onBack={()=>go('workspace')} onAgent={openTerminal}/>}
            {page==='terminal'&&<RemoteTerminal agent={terminalAgent} onBack={()=>go('terminals')}/>}
            {page==='chat'&&<ConnectedChat key={chatVersion} onMenu={openDrawer}
              onSettings={()=>go('settings')} onFiles={()=>go('files')}
              latest={lastMessage} conversationId={activeChatId}
              onChatSaved={id=>{setActiveChatId(id);refreshChats();}}
              initialModel={provider} attachedFile={githubFile} attachedProject={githubProject}
              onRemoveFile={()=>setGithubFile(null)} onRemoveProject={()=>setGithubProject(null)}/>}
            {page==='files'&&<RepositoryBrowser onBack={()=>go('workspace')}
              onChoose={file=>{setGithubFile(file);setGithubProject({repo:file.repo,branch:file.branch});newChat();}}
              onChooseRepo={project=>{setGithubFile(null);setGithubProject(project);newChat();}}/>}
            {page==='playground'&&<LocalPlayground onBack={()=>go('workspace')} onChat={(fileName,content)=>{
              if(!signedIn){Alert.alert('Sign in required','Sign in before sending code to a model.');go('settings');return;}
              setActiveChatId(null);
              setLastMessage('Review this local code file: '+fileName+'\n\n'+content.slice(0,9000));
              setChatVersion(v=>v+1);go('chat');
            }}/>}
            {page==='settings'&&<IntegrationsSettings onBack={()=>go('workspace')} openRepos={()=>go('files')}/>}
          </SafeAreaView>
        </KeyboardAvoidingView>
        <NavigationDrawer progress={drawerProgress} active={drawerActive} page={page}
          chats={chats} onClose={closeDrawer} onNavigate={go}
          onOpenChat={openHistory} onNewChat={newChat} onTerminal={()=>openTerminal('opencode')}/>
        <ModelPicker visible={showHomeModels} onClose={()=>setShowHomeModels(false)}
          selected={provider} onSelect={value=>{setProvider(value);void savePreferredModel(value);}}/>
      </LinearGradient>
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><RootApp /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  softPanel: {
    overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: '#FFFFFF',
    shadowColor: COLORS.shadow, shadowOpacity: 0.135, shadowOffset: { width: 0, height: 12 }, shadowRadius: 27,
    elevation: 4,
  },
  header: { height: 74, marginTop: 3, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  headerIcon: { width: 36, height: 42, justifyContent: 'center' },
  headerLabel: { flexDirection: 'row', alignItems: 'center', gap: 11, marginLeft: 13 },
  headerTitle: { color: COLORS.ink, fontFamily: FONT, fontSize: 22, fontWeight: '600', letterSpacing: -0.55 },
  liveDot: { width: 10, height: 10, borderRadius: 10, backgroundColor: COLORS.green },
  headerMore: { marginLeft: 'auto', width: 32, alignItems: 'center', justifyContent: 'center' },
  chatHeader: { fontSize: 19, fontWeight: '600', color: COLORS.ink, position: 'absolute', left: 0, right: 0, textAlign: 'center', zIndex: -1 },
  workspaceBody: { flex: 1, alignSelf: 'center', paddingHorizontal: 20 },
  workspaceScrollContent: { flexGrow: 1, paddingBottom: 18 },
  workspaceScrollFocused: { flexGrow: 0, paddingTop: 4, paddingBottom: 12 },
  workspaceSpacer: { flexGrow: 1, minHeight: 20 },
  workspaceDock: { flexShrink: 0, backgroundColor: 'transparent', paddingTop: 4, paddingBottom: 0 },
  hero: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24 },
  wordmark: { marginTop: 13, alignItems: 'center' },
  orbDot: { position: 'absolute', width: 15, height: 15, borderRadius: 16, borderWidth: 3, borderColor: '#FBFAF7' },
  terminalTile: {
    width: 75, height: 75, borderRadius: 25, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.98)',
    shadowColor: '#99928D', shadowOffset: { width: 0, height: 19 }, shadowOpacity: 0.24, shadowRadius: 26, elevation: 7,
  },
  composerWrap: { marginTop: 8 },
  focusedComposerWrap: { marginTop: 9 },
  composerPanel: { paddingLeft: 20, paddingRight: 15, minHeight: 126, paddingBottom: 13, paddingTop: 15 },
  composerFocused: { minHeight: 150, shadowOpacity: 0.13 },
  composerAccent: { position: 'absolute', left: 10, top: 9, bottom: 9, width: 2, borderRadius: 2 },
  composerInputArea: { flexDirection: 'row', alignItems: 'center', minHeight: 62 },
  composerInput: { flex: 1, paddingVertical: 4, paddingHorizontal: 1, fontFamily: MONO, fontSize: 16, lineHeight: 24, color: '#313237', minHeight: 54, maxHeight: 104, textAlignVertical: 'top' },
  sendBubble: { width: 39, height: 39, borderRadius: 28, marginLeft: 8, backgroundColor: '#C3ACEF', alignItems: 'center', justifyContent: 'center' },
  composerTools: { marginTop: 8, flexGrow: 0 },
  composerToolsContent: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingRight: 12 },
  option: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 6 },
  optionText: { fontFamily: MONO, fontSize: 12.5, color: '#27282A' },
  optionDivider: { color: '#A7A5A5', fontFamily: MONO, fontSize: 15, marginHorizontal: 1 },
  hintRow: { flexDirection: 'row', alignSelf: 'center', gap: 15, alignItems: 'center', marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hintKey: { fontFamily: MONO, fontSize: 12, color: '#252627', backgroundColor: '#F7F6F4', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderColor: '#E8E5E1', borderWidth: 1, borderRadius: 7 },
  hintText: { color: COLORS.muted, fontFamily: MONO, fontSize: 12 },
  tipWrap: { marginTop: 14, flexShrink: 0 },
  tipFocused: { marginTop: 16 },
  tipPanel: { paddingVertical: 16, paddingHorizontal: 14, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FCF6ED' },
  tipIcon: { width: 37, height: 37, borderRadius: 22, backgroundColor: '#F9DCB1', alignItems: 'center', justifyContent: 'center' },
  tipText: { fontFamily: MONO, fontSize: 13.2, lineHeight: 20, flexShrink: 1, color: COLORS.mutedDark },
  terminalFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8D5D0', height: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerMuted: { fontFamily: MONO, color: COLORS.muted, fontSize: 12.5 },
  footerStrong: { fontFamily: MONO, color: COLORS.ink, fontSize: 12.5 },
  footerGreen: { height: 11, width: 11, borderWidth: 1.4, borderRadius: 12, borderColor: '#2EBC63', justifyContent: 'center', alignItems: 'center' },
  footerGreenDot: { width: 4, height: 4, borderRadius: 4, backgroundColor: '#2EBC63' },
  editorToolbar: { height: 56, marginHorizontal: -16, borderRadius: 18, justifyContent: 'center', paddingVertical: 6 },
  toolbarContents: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 3, width: '100%' },
  toolbarKey: { backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 10, minWidth: 0, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, shadowColor: '#8B8992', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 },
  toolbarLabel: { fontSize: 9, color: COLORS.ink, fontWeight: '500' },
  drawerOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  drawerShell: { flex: 1, height: '100%', borderTopRightRadius: 31, borderBottomRightRadius: 31, overflow: 'hidden', shadowColor: '#141414', shadowOpacity: 0.18, shadowOffset: { width: 10, height: 0 }, shadowRadius: 25, elevation: 16 },
  drawerBrand: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginTop: 32, gap: 11 },
  drawerBrandText: { fontSize: 22, fontWeight: '600', color: COLORS.ink },
  drawerNavItem: { height: 65, borderRadius: 17, marginHorizontal: 15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 21 },
  drawerSelected: { backgroundColor: 'rgba(236,235,233,0.75)' },
  drawerNavText: { fontSize: 20, color: COLORS.ink, fontWeight: '400' },
  drawerSubheading: { marginHorizontal: 25, marginTop: 42, marginBottom: 16, fontSize: 15, color: COLORS.mutedDark },
  drawerTerminal: { height: 59, marginHorizontal: 15, borderRadius: 14, flexDirection: 'row', gap: 15, alignItems: 'center', paddingHorizontal: 18, backgroundColor: '#F1F0EE' },
  drawerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginBottom: 18 },
  settingsRound: { width: 53, height: 53, borderRadius: 29, backgroundColor: '#FCFBFA', borderWidth: 1, borderColor: '#E5E3E2', alignItems: 'center', justifyContent: 'center', shadowColor: '#98938F', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 5 }, shadowRadius: 11 },
  drawerNew: { backgroundColor: '#202124', borderRadius: 35, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 54, gap: 8 },
  drawerNewText: { color: 'white', fontWeight: '600', fontSize: 17 },
  pageHeading: { height: 80, marginTop: 10, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { padding: 7 },
  bigHeading: { fontSize: 30, fontWeight: '700', letterSpacing: -1, color: COLORS.ink },
  badge: { borderRadius: 16, backgroundColor: '#E7EFE7', paddingHorizontal: 11, paddingVertical: 7 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#29814C' },
  sectionScroll: { alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 34 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: COLORS.ink },
  sectionNote: { fontSize: 13, color: COLORS.mutedDark },
  agentCard: { width: 146, height: 116, padding: 13, justifyContent: 'space-between', borderRadius: 17 },
  agentIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  agentCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agentText: { color: COLORS.ink, fontWeight: '600', fontSize: 14, flexShrink: 1 },
  featureProject: { minHeight: 139, padding: 15, gap: 14, flexDirection: 'row', alignItems: 'center' },
  projectIcon: { height: 46, width: 46, borderRadius: 14, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  projectName: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  projectMeta: { fontSize: 12.5, color: COLORS.mutedDark },
  recentProject: { minHeight: 94, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14 },
  newProjectButton: { alignSelf: 'flex-end', borderRadius: 30, backgroundColor: '#202124', height: 52, paddingHorizontal: 25, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6 },
  newProjectLabel: { fontSize: 16, color: 'white', fontWeight: '600' },
  chatBody: { flex: 1, paddingHorizontal: 19, paddingBottom: 10 },
  chatBubble: { alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: '#EDECE9', padding: 14, borderRadius: 17, marginTop: 12 },
  chatBubbleText: { fontSize: 14, color: COLORS.ink },
  infoCopy: { fontSize: 14, color: COLORS.ink, lineHeight: 22 },
  projectPicker: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E6E4E1', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 25, marginBottom: 10 },
  gitHubBox: { padding: 15, gap: 17, marginBottom: 13 },
  gitHubButton: { backgroundColor: '#202124', borderRadius: 12, height: 47, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  gitHubButtonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  chatComposer: { padding: 13, minHeight: 104, justifyContent: 'space-between' },
  chatMessageInput: { fontSize: 15, color: COLORS.ink, minHeight: 38, maxHeight: 110, textAlignVertical: 'top' },
  chatActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectModel: { flexDirection: 'row', borderWidth: 1, borderColor: '#E4E3E0', paddingHorizontal: 11, paddingVertical: 8, alignItems: 'center', gap: 8, borderRadius: 20 },
  roundSend: { backgroundColor: '#202124', height: 37, width: 37, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyFiles: { flex: 1, paddingHorizontal: 38, alignItems: 'center', justifyContent: 'center', paddingBottom: 110 },
  emptyFolder: { height: 100, width: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, color: COLORS.ink, fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 14, lineHeight: 23, color: COLORS.mutedDark, textAlign: 'center', marginTop: 10 },
});

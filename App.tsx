import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
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

type Page = 'workspace' | 'terminals' | 'chat' | 'files';
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
  const buttons: Array<{ key: ToolKey; icon?: FeatherName; label?: string }> = [
    { key: 'ESC', label: 'ESC', icon: 'rotate-ccw' }, { key: '+', icon: 'plus' },
    { key: 'TAB', label: 'TAB', icon: 'corner-down-right' }, { key: 'CTRL', label: 'CTRL' },
    { key: 'up', icon: 'arrow-up' }, { key: 'down', icon: 'arrow-down' },
    { key: 'left', icon: 'arrow-left' }, { key: 'right', icon: 'arrow-right' },
    { key: 'mic', icon: 'mic' }, { key: 'hide', icon: 'chevrons-down' },
  ];
  return (
    <LinearGradient colors={['rgba(245,243,244,0.96)', 'rgba(237,236,239,0.97)']} style={styles.editorToolbar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'space-between', gap: 4, paddingHorizontal: 6 }}>
        {buttons.map(b =>
          <Tap key={b.key} style={styles.toolbarKey} onPress={() => onKey(b.key)} accessibilityLabel={b.key}>
            {b.icon && <Icon name={b.icon} size={b.label ? 14 : 20} />}
            {b.label && <Text style={styles.toolbarLabel}>{b.label}</Text>}
          </Tap>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function Composer({
  prompt, setPrompt, inputRef, selection, setSelection, onFocus, onBlur, onSend,
  isFocused, mode, setMode, provider, setProvider, quality, setQuality,
}: {
  prompt: string; setPrompt: (value: string) => void; inputRef: React.RefObject<TextInput | null>;
  selection: { start: number; end: number }; setSelection: (value: { start: number; end: number }) => void;
  onFocus: () => void; onBlur: () => void; onSend: () => void;
  isFocused: boolean; mode: string; setMode: (value: string) => void; provider: string;
  setProvider: (value: string) => void; quality: string; setQuality: (value: string) => void;
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
        <Tap style={styles.option} onPress={() => choose('AI model', ['Beam Free', 'Gemini Free', 'Local Model'], setProvider)}>
          <Text style={styles.optionText}>{provider}</Text><Icon name="chevron-down" color={COLORS.ink} size={13} />
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
  keyboardVisible, setKeyboardVisible, send, onTool, mode, setMode, provider, setProvider, quality, setQuality,
}: {
  openMenu: () => void; prompt: string; setPrompt: (p: string) => void; inputRef: React.RefObject<TextInput | null>;
  selection: { start: number; end: number }; setSelection: (v: { start: number; end: number }) => void;
  keyboardVisible: boolean; setKeyboardVisible: (v: boolean) => void; send: () => void;
  onTool: (key: ToolKey) => void;
  mode: string; setMode: (v: string) => void; provider: string; setProvider: (v: string) => void;
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
              mode={mode} setMode={setMode} provider={provider} setProvider={setProvider}
              quality={quality} setQuality={setQuality} />
            <HintRow />
          </View>
          <View style={styles.workspaceSpacer} />
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
function TerminalsPage({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const shortcuts: Array<{ label: string; icon: FeatherName; color: string; bg: string }> = [
    { label: 'Claude Code', icon: 'sun', color: '#D67755', bg: '#FBEAE4' },
    { label: 'Codex', icon: 'terminal', color: '#705AC9', bg: '#F0EEFB' },
    { label: 'Gemini', icon: 'star', color: '#36999B', bg: '#EDF7F6' },
  ];
  const projects = [
    { name: 'NoetharaMobile', folder: '/workspace/noetharamobile', color: '#7760C9' },
    { name: 'Starter App', folder: '/workspace/starter-app', color: '#268F60' },
    { name: 'Dev Tools', folder: '/workspace/dev-tools', color: '#CC942D' },
  ];
  return (
    <View style={styles.fill}>
      <View style={styles.pageHeading}>
        <Tap onPress={onBack} style={styles.backButton}><Icon name="chevron-left" size={28} /></Tap>
        <Text style={styles.bigHeading}>Terminals</Text>
        <View style={{ flex: 1 }} />
        <Badge>●  Preview</Badge>
        <Tap onPress={() => Alert.alert('Terminals', 'No live cloud terminal is connected yet.')} style={{ padding: 8 }}>
          <Icon name="more-horizontal" size={25} />
        </Tap>
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={[styles.sectionScroll, { width: Math.min(width, 520) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Your shortcuts</Text>
          <Tap onPress={() => Alert.alert('Shortcuts', 'Agent shortcuts can be connected after the terminal backend is configured.')}>
            <Icon name="plus" size={23} color={COLORS.mutedDark} />
          </Tap>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 11, paddingVertical: 5, paddingRight: 6 }}>
          {shortcuts.map(s => <Tap key={s.label} onPress={() => Alert.alert(s.label, 'Shortcut preview only — provider is not connected.')}>
            <SoftPanel style={styles.agentCard}>
              <View style={[styles.agentIcon, { backgroundColor: s.bg }]}><Icon name={s.icon} size={26} color={s.color} /></View>
              <View style={styles.agentCardBottom}><Text style={styles.agentText}>{s.label}</Text><Icon name="chevron-right" size={14} color={COLORS.mutedDark} /></View>
            </SoftPanel>
          </Tap>)}
        </ScrollView>
        <View style={[styles.sectionHeading, { marginTop: 34 }]}>
          <Text style={styles.sectionTitle}>Projects</Text>
          <Text style={styles.sectionNote}>UI examples</Text>
        </View>
        <SoftPanel style={styles.featureProject}>
          <View style={styles.projectIcon}><Icon name="folder" size={28} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.projectName}>Home</Text><Text style={styles.projectMeta}>/home/workspace</Text>
            <Text style={styles.projectMeta}>1 demo terminal</Text>
            <View style={{ alignSelf: 'flex-start' }}><Badge>OpenCode · Demo</Badge></View>
          </View>
          <Icon name="chevron-right" size={21} color={COLORS.mutedDark} />
        </SoftPanel>
        <View style={[styles.sectionHeading, { marginTop: 36 }]}>
          <Text style={styles.sectionTitle}>Recent projects</Text><Text style={styles.sectionNote}>Examples</Text>
        </View>
        {projects.map(p => <SoftPanel key={p.name} style={styles.recentProject}>
          <View style={[styles.projectIcon, { backgroundColor: p.color + '17' }]}><Icon name="folder" color={p.color} size={25} /></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={styles.projectName}>{p.name}</Text><Text style={styles.projectMeta}>{p.folder}</Text><Text style={styles.projectMeta}>Demo workspace</Text></View>
          <Icon name="chevron-right" color={COLORS.mutedDark} size={21} />
        </SoftPanel>)}
        <Tap onPress={() => Alert.alert('Create project', 'A cloud runtime will be needed to create and run remote projects.')} style={styles.newProjectButton}>
          <Icon name="plus" size={22} color="white" /><Text style={styles.newProjectLabel}>New</Text>
        </Tap>
      </ScrollView>
    </View>
  );
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

function NavigationDrawer({ visible, onClose, onNavigate, page }: { visible: boolean; onClose: () => void; onNavigate: (p: Page) => void; page: Page }) {
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.79, 338);
  const slide = useRef(new Animated.Value(-400)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, {
        toValue: visible ? 0 : -400,
        speed: visible ? 19 : 22,
        bounciness: visible ? 3 : 0,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, { toValue: visible ? 1 : 0, duration: 255, useNativeDriver: true }),
    ]).start();
  }, [visible, slide, backdrop]);
  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={styles.drawerOverlay}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdrop, backgroundColor: 'rgba(15, 15, 17, 0.32)' }]}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFillObject} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View style={[styles.drawerShell, { width: drawerWidth, transform: [{ translateX: slide }] }]}>
        <LinearGradient colors={['#FEFDFC', '#FCFBF9', '#F9F7F4']} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
          <View style={styles.drawerBrand}><Text style={styles.drawerBrandText}>Noethara Dev</Text><View style={styles.liveDot} /></View>
          <View style={{ gap: 8, marginTop: 28 }}>
            {([
              { label: 'Terminals', icon: 'terminal' as FeatherName, page: 'terminals' as Page },
              { label: 'Code', icon: 'message-circle' as FeatherName, page: 'chat' as Page },
              { label: 'Files', icon: 'folder' as FeatherName, page: 'files' as Page },
            ]).map(item => <Tap key={item.page} onPress={() => onNavigate(item.page)}
              style={[styles.drawerNavItem, page === item.page && styles.drawerSelected]}>
                <Icon name={item.icon} size={24} /><Text style={styles.drawerNavText}>{item.label}</Text>
              </Tap>)}
          </View>
          <Text style={styles.drawerSubheading}>Open terminals</Text>
          <Tap style={styles.drawerTerminal} onPress={() => onNavigate('workspace')}>
            <Icon name="monitor" size={20}/><Text style={styles.drawerNavText}>Terminal 1</Text>
          </Tap>
          <View style={{ flex: 1 }} />
          <View style={styles.drawerBottom}>
            <Tap onPress={() => Alert.alert('Settings', 'This personal Expo UI currently has no cloud credentials configured.')} style={styles.settingsRound}><Icon name="settings" size={24} /></Tap>
            <Tap onPress={() => onNavigate('chat')} style={styles.drawerNew}><Icon name="plus" size={24} color="white"/><Text style={styles.drawerNewText}>New</Text></Tap>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function RootApp() {
  const [page, setPage] = useState<Page>('workspace');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('Build');
  const [provider, setProvider] = useState('Beam Free');
  const [quality, setQuality] = useState('max');
  const [lastMessage, setLastMessage] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const inputRef = useRef<TextInput>(null);
  const { width: screenWidth } = useWindowDimensions();
  const gestures = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_evt, g) => {
      const horizontal = Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.35;
      if (!horizontal) return false;
      if (drawerVisible) return g.dx < -15 && g.x0 < Math.min(screenWidth * 0.79, 338);
      return !keyboardVisible && g.dx > 15 && g.x0 <= 35;
    },
    onPanResponderRelease: (_evt, g) => {
      if (drawerVisible) {
        if (g.dx < -62 || g.vx < -0.5) setDrawerVisible(false);
      } else if (!keyboardVisible && (g.dx > 62 || g.vx > 0.5)) {
        Keyboard.dismiss();
        setDrawerVisible(true);
      }
    },
    onPanResponderTerminationRequest: () => true,
  }), [drawerVisible, keyboardVisible, screenWidth]);
  const openDrawer = () => {
    Keyboard.dismiss();
    setDrawerVisible(true);
  };
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const go = (next: Page) => {
    Keyboard.dismiss();
    setKeyboardVisible(false);
    setDrawerVisible(false);
    setPage(next);
  };
  const send = () => {
    if (!prompt.trim()) return;
    setLastMessage(prompt.trim());
    setPrompt('');
    Keyboard.dismiss();
    setKeyboardVisible(false);
    setPage('chat');
  };
  const tool = (key: ToolKey) => {
    if (key === 'hide' || key === 'ESC') { Keyboard.dismiss(); inputRef.current?.blur(); return; }
    if (key === 'mic') { Alert.alert('Dictation', 'Tap the microphone on the iPhone keyboard to dictate text.'); return; }
    if (key === 'CTRL') { Alert.alert('Ctrl', 'On mobile, use the shortcut buttons or a hardware keyboard for modifier-key combinations.'); return; }
    if (key === 'up' || key === 'down' || key === 'left' || key === 'right') {
      const delta = key === 'left' || key === 'up' ? -1 : 1;
      const position = Math.max(0, Math.min(prompt.length, selection.start + delta));
      setSelection({ start: position, end: position }); inputRef.current?.focus(); return;
    }
    const insert = key === 'TAB' ? '  ' : '+';
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    setPrompt(prompt.slice(0, start) + insert + prompt.slice(end));
    const pos = start + insert.length;
    setSelection({ start: pos, end: pos });
    inputRef.current?.focus();
  };
  return (
    <View style={styles.fill} {...gestures.panHandlers}>
      <LinearGradient colors={['#FCFAF7', '#FBF9F6', '#F7F5F2']} style={styles.fill}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
          {page === 'workspace' && <Workspace openMenu={openDrawer} prompt={prompt} setPrompt={setPrompt}
            inputRef={inputRef} selection={selection} setSelection={setSelection}
            keyboardVisible={keyboardVisible} setKeyboardVisible={setKeyboardVisible}
            send={send} onTool={tool} mode={mode} setMode={setMode} provider={provider}
            setProvider={setProvider} quality={quality} setQuality={setQuality} />}
          {page === 'terminals' && <TerminalsPage onBack={() => go('workspace')} />}
          {page === 'chat' && <ChatPage key={lastMessage} onMenu={openDrawer} latest={lastMessage} />}
          {page === 'files' && <FilesPage onBack={() => go('workspace')} />}
        </SafeAreaView>
      </KeyboardAvoidingView>
      <NavigationDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} onNavigate={go} page={page} />
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
  workspaceScrollFocused: { paddingTop: 4, paddingBottom: 14 },
  workspaceSpacer: { flexGrow: 1, minHeight: 20 },
  workspaceDock: { flexShrink: 0, backgroundColor: 'transparent', paddingTop: 6, paddingBottom: 3 },
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
  tipFocused: { marginTop: 20 },
  tipPanel: { paddingVertical: 16, paddingHorizontal: 14, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FCF6ED' },
  tipIcon: { width: 37, height: 37, borderRadius: 22, backgroundColor: '#F9DCB1', alignItems: 'center', justifyContent: 'center' },
  tipText: { fontFamily: MONO, fontSize: 13.2, lineHeight: 20, flexShrink: 1, color: COLORS.mutedDark },
  terminalFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8D5D0', height: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerMuted: { fontFamily: MONO, color: COLORS.muted, fontSize: 12.5 },
  footerStrong: { fontFamily: MONO, color: COLORS.ink, fontSize: 12.5 },
  footerGreen: { height: 11, width: 11, borderWidth: 1.4, borderRadius: 12, borderColor: '#2EBC63', justifyContent: 'center', alignItems: 'center' },
  footerGreenDot: { width: 4, height: 4, borderRadius: 4, backgroundColor: '#2EBC63' },
  editorToolbar: { height: 58, marginHorizontal: -16, borderRadius: 18, justifyContent: 'center', paddingVertical: 6 },
  toolbarKey: { backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 10, minWidth: 31, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, gap: 2, shadowColor: '#8B8992', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 },
  toolbarLabel: { fontSize: 10, color: COLORS.ink, fontWeight: '500' },
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

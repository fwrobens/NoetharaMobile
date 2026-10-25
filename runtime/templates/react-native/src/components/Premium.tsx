import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps, ViewProps } from 'react-native';
import { colors, radius, space, type as typography } from '../theme';

type Tone='primary'|'secondary'|'ghost';
export function PremiumCard({children,style,...props}:ViewProps&{children:ReactNode}){
  return <View style={[styles.card,style]} {...props}>{children}</View>;
}
export function PremiumButton({label,onPress,tone='primary',loading=false,disabled=false}:{
  label:string;onPress:()=>void;tone?:Tone;loading?:boolean;disabled?:boolean;
}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{disabled:disabled||loading,busy:loading}}
    disabled={disabled||loading} onPress={onPress}
    style={({pressed})=>[styles.button,tone==='primary'?styles.primary:tone==='secondary'?styles.secondary:styles.ghost,
      pressed&&styles.pressed,(disabled||loading)&&styles.disabled]}>
      {loading?<ActivityIndicator color={tone==='primary'?colors.bg:colors.text} size="small"/>:null}
      <Text style={[styles.buttonText,{color:tone==='primary'?colors.bg:colors.text}]}>{label}</Text>
  </Pressable>;
}
export function PremiumInput({label,hint,error,...props}:TextInputProps&{
  label:string;hint?:string;error?:string;
}){
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput {...props} style={[styles.input,props.style,Boolean(error)&&styles.inputError]}
      placeholderTextColor={colors.textMuted} accessibilityLabel={label}/>
    {error||hint?<Text style={[styles.hint,Boolean(error)&&styles.error]}>{error||hint}</Text>:null}
  </View>;
}
export function PremiumBadge({children}: {children:ReactNode}){
  return <View style={styles.badge}><Text style={styles.badgeText}>{children}</Text></View>;
}
export function PremiumSection({title,description,children}:{
  title:string;description?:string;children:ReactNode;
}){
  return <View style={styles.section}>
    <Text style={styles.title}>{title}</Text>
    {description?<Text style={styles.description}>{description}</Text>:null}
    {children}
  </View>;
}
export function PremiumSheet({visible,title,onClose,children}:{
  visible:boolean;title:string;onClose:()=>void;children:ReactNode;
}){
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={styles.scrim}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose}
            style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
        </View>
        <ScrollView>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  card:{borderRadius:radius.xl,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface,padding:space.xl},
  button:{minHeight:48,borderRadius:radius.md,justifyContent:'center',alignItems:'center',
    flexDirection:'row',gap:space.sm,paddingHorizontal:space.xl,paddingVertical:space.md},
  primary:{backgroundColor:colors.accent},
  secondary:{backgroundColor:colors.surfaceRaised,borderColor:colors.border,borderWidth:1},
  ghost:{backgroundColor:'transparent'},
  pressed:{opacity:.86,transform:[{scale:.98}]},
  disabled:{opacity:.5},
  buttonText:{...typography.headline},
  field:{gap:space.sm},
  label:{...typography.caption,color:colors.text},
  input:{minHeight:48,borderRadius:radius.md,backgroundColor:colors.surfaceRaised,
    borderWidth:1,borderColor:colors.border,color:colors.text,
    paddingVertical:space.md,paddingHorizontal:space.lg,...typography.body},
  inputError:{borderColor:colors.danger},
  hint:{...typography.caption,color:colors.textMuted},
  error:{color:colors.danger},
  badge:{alignSelf:'flex-start',paddingHorizontal:space.md,paddingVertical:space.sm,
    borderRadius:radius.pill,backgroundColor:colors.accentSoft},
  badgeText:{...typography.overline,color:colors.accent},
  section:{gap:space.md,paddingVertical:space.xl},
  title:{...typography.display,color:colors.text},
  description:{...typography.body,color:colors.textMuted},
  scrim:{flex:1,backgroundColor:'rgba(0,0,0,.6)',justifyContent:'flex-end'},
  sheet:{backgroundColor:colors.surface,borderTopLeftRadius:radius.xl,
    borderTopRightRadius:radius.xl,padding:space.xl,maxHeight:'85%'},
  sheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.lg},
  sheetTitle:{...typography.title,color:colors.text},
  close:{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'},
  closeText:{fontSize:28,color:colors.text},
});

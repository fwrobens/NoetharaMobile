import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, space, type } from './theme';
import { PremiumBadge, PremiumButton, PremiumCard } from './components/Premium';

export default function App() {
  const enter=useRef(new Animated.Value(0)).current;
  const [started,setStarted]=useState(false);
  useEffect(()=>{
    Animated.timing(enter,{toValue:1,duration:520,
      easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();
  },[enter]);
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <Animated.View style={{opacity:enter,transform:[{
        translateY:enter.interpolate({inputRange:[0,1],outputRange:[16,0]})
      }]}}>
        <PremiumBadge>BUILT WITH NOETHARA</PremiumBadge>
        <Text style={styles.title}>Your next great idea.</Text>
        <Text style={styles.body}>A refined starting point with real design tokens,
          polished components, and thoughtful mobile interactions.</Text>
        <PremiumCard style={styles.card}>
          <Text style={styles.cardTitle}>Designed to grow</Text>
          <Text style={styles.cardCopy}>Create screens, connect APIs, and reuse
            the components in src/components/Premium.tsx.</Text>
        </PremiumCard>
        <PremiumButton label={started?'Ready to build':'Get started'}
          onPress={()=>setStarted(true)}/>
        {started?<Text style={styles.caption}>Your workspace is ready.</Text>:null}
      </Animated.View>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},
  content:{flexGrow:1,justifyContent:'center',padding:space.xl,
    maxWidth:560,width:'100%',alignSelf:'center'},
  title:{...type.display,color:colors.text,marginTop:space.xl,marginBottom:space.md},
  body:{...type.body,color:colors.textMuted,marginBottom:space.xxl},
  card:{marginBottom:space.xl,gap:space.sm},
  cardTitle:{...type.title,color:colors.text},
  cardCopy:{...type.body,color:colors.textMuted},
  caption:{...type.caption,color:colors.textMuted,marginTop:space.md,textAlign:'center'},
});

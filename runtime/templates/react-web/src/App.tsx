import { ArrowRight, Sparkles } from 'lucide-react';
import { PremiumBadge, PremiumButton, PremiumCard } from './components/Premium';

export default function App() {
  return <main>
    <section className="container hero fade-up">
      <PremiumBadge><Sparkles size={14}/> Built with Noethara</PremiumBadge>
      <h1>Built to feel different.</h1>
      <p>Premium design primitives are ready. Build a real product by reusing the cards,
        buttons and semantic tokens rather than hand-coding inconsistent elements.</p>
      <PremiumButton onClick={()=>document.querySelector('#start')?.scrollIntoView({behavior:'smooth'})}>
        Explore the experience <ArrowRight size={16} aria-hidden="true"/>
      </PremiumButton>
      <PremiumCard id="start" style={{marginTop:32,maxWidth:540,width:'100%'}}>
        <h2 style={{margin:'0 0 8px'}}>Your next great idea</h2>
        <p style={{margin:0,color:'var(--muted)'}}>React · TypeScript · Responsive components</p>
      </PremiumCard>
    </section>
  </main>;
}

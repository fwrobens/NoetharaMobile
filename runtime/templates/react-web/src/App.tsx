import { ArrowRight, Sparkles } from 'lucide-react';

export default function App() {
  return (
    <main>
      <section className="container hero fade-up">
        <span className="pill"><Sparkles size={14} /> Built with Noethara</span>
        <h1>Your website starts here.</h1>
        <p>Replace this hero with the real product. Tokens live in src/styles.css.</p>
        <a className="btn btn-primary" href="#start">Get started <ArrowRight size={16} /></a>
      </section>
    </main>
  );
}

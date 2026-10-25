import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import './premium.css';

type Tone='primary'|'secondary'|'ghost';
type PremiumButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{tone?:Tone;loading?:boolean};
type PremiumCardProps=HTMLAttributes<HTMLElement>&{children:ReactNode;as?:'article'|'section'|'div'};
type PremiumInputProps=InputHTMLAttributes<HTMLInputElement>&{label:string;hint?:string;error?:string};
export function PremiumCard({children,as:Tag='article',className='',...rest}:PremiumCardProps){
  return <Tag className={'premium-card '+className} {...rest}>{children}</Tag>;
}
export function PremiumButton({children,tone='primary',loading=false,disabled,className='',...rest}:PremiumButtonProps){
  return <button className={'premium-button premium-button--'+tone+' '+className}
    disabled={disabled||loading} aria-busy={loading||undefined} {...rest}>
    {loading?<span className="premium-spinner" aria-hidden="true"/>:null}{children}
  </button>;
}
export function PremiumInput({label,hint,error,id,className='',...rest}:PremiumInputProps){
  const inputId=id||'input-'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  return <div className={'premium-field '+className}>
    <label htmlFor={inputId}>{label}</label>
    <input id={inputId} aria-invalid={Boolean(error)} aria-describedby={error||hint?inputId+'-hint':undefined} {...rest}/>
    {error||hint?<small id={inputId+'-hint'} className={error?'premium-error':'premium-hint'}>{error||hint}</small>:null}
  </div>;
}
export function PremiumBadge({children}: {children:ReactNode}){
  return <span className="premium-badge">{children}</span>;
}
export function PremiumSection({title,description,children}:{
  title:string;description?:string;children:ReactNode;
}){
  return <section className="premium-section">
    <div className="premium-section-header"><h2>{title}</h2>{description?<p>{description}</p>:null}</div>
    {children}
  </section>;
}
export function PremiumSheet({open,onClose,title,children}:{
  open:boolean;onClose:()=>void;title:string;children:ReactNode;
}){
  if(!open)return null;
  return <div role="presentation" className="premium-sheet-backdrop" onMouseDown={e=>{
    if(e.target===e.currentTarget)onClose();
  }}>
    <div role="dialog" aria-modal="true" aria-label={title} className="premium-sheet">
      <div className="premium-sheet-header"><h2>{title}</h2>
        <button type="button" className="premium-sheet-close" aria-label="Close sheet" onClick={onClose}>×</button></div>
      {children}
    </div>
  </div>;
}

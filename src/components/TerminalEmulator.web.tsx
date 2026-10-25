// Browser-specific terminal renderer. No credentials enter the iframe.
// The authenticated WebSocket stays in RemoteTerminal, in the parent page.
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

export type TerminalEmulatorHandle = {
  write: (data: string) => void;
  reset: () => void;
  fit: () => void;
  focus: () => void;
};
type Props = {
  onReady: () => void;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onError: (message: string) => void;
};

const HTML = [
  '<!doctype html><html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' https://cdn.jsdelivr.net; style-src \'unsafe-inline\' https://cdn.jsdelivr.net; img-src data:; font-src data:; connect-src \'none\';">',
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.css">',
  '<style>*{box-sizing:border-box}html,body,#terminal{margin:0;width:100%;height:100%;overflow:hidden;background:#141416}#terminal{padding:8px}.xterm{height:100%}</style>',
  '</head><body><div id="terminal"></div>',
  '<script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.js"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js"></script>',
  '<script>(function(){',
  'function send(type,values){parent.postMessage(Object.assign({source:"noethara-term-frame",type:type},values||{}),"*")}',
  'if(typeof Terminal!=="function"||typeof FitAddon==="undefined"){send("error",{message:"Terminal renderer could not load."});return}',
  'try {',
  'var terminal=new Terminal({fontSize:12,fontFamily:"Menlo,Consolas,monospace",scrollback:4000,cursorBlink:true,theme:{background:"#141416",foreground:"#F0EEF2",cursor:"#BD9CFF"}});',
  'var fitAddon=new FitAddon.FitAddon();terminal.loadAddon(fitAddon);terminal.open(document.getElementById("terminal"));',
  'function fit(){fitAddon.fit();send("resize",{cols:terminal.cols,rows:terminal.rows})}',
  'terminal.onData(function(data){send("input",{data:data})});',
  'terminal.onResize(function(size){send("resize",{cols:size.cols,rows:size.rows})});',
  'addEventListener("message",function(e){var p=e.data;if(!p||p.source!=="noethara-term-host")return;',
  'if(p.type==="write"&&typeof p.data==="string")terminal.write(p.data);',
  'else if(p.type==="reset")terminal.reset();else if(p.type==="fit")fit();else if(p.type==="focus")terminal.focus();});',
  'addEventListener("resize",fit);if(typeof ResizeObserver!=="undefined")new ResizeObserver(fit).observe(document.getElementById("terminal"));',
  'requestAnimationFrame(function(){fit();send("ready")});',
  '}catch(err){send("error",{message:String(err&&err.message||err)})}',
  '})();</script></body></html>',
].join('');

export const TerminalEmulator = forwardRef<TerminalEmulatorHandle, Props>(
  function TerminalEmulator({ onReady, onInput, onResize, onError }, ref) {
    const frame = useRef<HTMLIFrameElement | null>(null);
    const onReadyRef = useRef(onReady);
    const onInputRef = useRef(onInput);
    const onResizeRef = useRef(onResize);
    const onErrorRef = useRef(onError);
    onReadyRef.current = onReady;
    onInputRef.current = onInput;
    onResizeRef.current = onResize;
    onErrorRef.current = onError;
    const send = (type: string, data?: string) => {
      frame.current?.contentWindow?.postMessage({ source:'noethara-term-host', type, data }, '*');
    };
    useImperativeHandle(ref, () => ({
      write: (data) => send('write',data),
      reset: () => send('reset'),
      fit: () => send('fit'),
      focus: () => send('focus'),
    }));
    useEffect(() => {
      const receive = (e: MessageEvent) => {
        if (e.source !== frame.current?.contentWindow || e.data?.source !== 'noethara-term-frame') return;
        const msg = e.data as {type?:string;data?:string;cols?:number;rows?:number;message?:string};
        if (msg.type === 'ready') onReadyRef.current();
        else if (msg.type === 'input' && typeof msg.data === 'string') onInputRef.current(msg.data);
        else if (msg.type === 'resize' && Number.isInteger(msg.cols) && Number.isInteger(msg.rows))
          onResizeRef.current(msg.cols!,msg.rows!);
        else if (msg.type === 'error') onErrorRef.current(msg.message || 'Terminal renderer unavailable');
      };
      window.addEventListener('message',receive);
      return () => window.removeEventListener('message',receive);
    },[]);
    return <View style={styles.root}>
      {React.createElement('iframe',{
        ref:frame,
        srcDoc:HTML,
        title:'Noethara terminal',
        sandbox:'allow-scripts',
        style:{display:'block',width:'100%',height:'100%',border:0,backgroundColor:'#141416'},
      })}
    </View>;
  }
);
const styles=StyleSheet.create({root:{flex:1,minHeight:200,backgroundColor:'#141416'}});

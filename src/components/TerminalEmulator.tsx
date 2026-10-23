import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { StyleSheet } from 'react-native';

// Runs a genuine VT/ANSI terminal inside the already-included Expo Go WebView.
// The Supabase token and WebSocket stay in native code, not in this document.
// Pin third-party renderer versions; CSP prevents terminal JS from networking.
// TODO: bundle/vend these assets for offline support before production release.
// React Native 0.88/TS 6 exposes WebView's platform-discriminated props as
// never in JSX. Render through its common React component interface.
const NativeWebView = WebView as unknown as React.ComponentType<any>;
const HTML = "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover\">\n<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' data:; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\">\n<link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.css\">\n<style>\n*{box-sizing:border-box}\nhtml,body,#terminal{width:100%;height:100%;margin:0;overflow:hidden}\nbody{background:#141416}\n#terminal{padding:10px 8px}\n.xterm{height:100%}\n.xterm .xterm-viewport{overscroll-behavior:contain}\n</style>\n</head>\n<body>\n<div id=\"terminal\"></div>\n<script src=\"https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.js\" onerror=\"window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'Terminal renderer could not load. Check network access.'}))\"></script>\n<script src=\"https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.js\" onerror=\"window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:'Terminal sizing module could not load.'}))\"></script>\n<script>\n(function(){\n  var native=window.ReactNativeWebView;\n  function send(v){native.postMessage(JSON.stringify(v));}\n  if(typeof Terminal!=='function'||typeof FitAddon==='undefined'){\n    send({type:'error',message:'Terminal renderer unavailable. Check network access.'});return;\n  }\n  try{\n    var term=new Terminal({\n      allowProposedApi:false,scrollback:4000,cursorBlink:true,\n      fontFamily:\"Menlo,Consolas,monospace\",fontSize:13,lineHeight:1.23,\n      convertEol:false,screenReaderMode:false,\n      theme:{background:'#141416',foreground:'#F0EEF2',cursor:'#BD9CFF',\n        selectionBackground:'#64538888',black:'#141416',red:'#FA7676',\n        green:'#7BD7A2',yellow:'#F4C776',blue:'#8CACFF',\n        magenta:'#D6A5F9',cyan:'#8EDBE4',white:'#F2F1F3'}\n    });\n    var addon=new FitAddon.FitAddon();\n    term.loadAddon(addon);\n    term.open(document.getElementById('terminal'));\n    term.onData(function(data){send({type:'input',data:data});});\n    term.onResize(function(e){send({type:'resize',cols:e.cols,rows:e.rows});});\n    window.receiveTerminalPacket=function(packet){\n      if(!packet)return;\n      if(packet.type==='write'&&typeof packet.data==='string')term.write(packet.data);\n      else if(packet.type==='reset')term.reset();\n      else if(packet.type==='focus')term.focus();\n      else if(packet.type==='fit')fit();\n    };\n    var fitted=false;\n    function fit(){\n      if(!document.getElementById('terminal').clientWidth)return;\n      addon.fit();fitted=true;\n    }\n    window.addEventListener('resize',fit);\n    if(window.ResizeObserver){\n      new ResizeObserver(function(){fit();}).observe(document.getElementById('terminal'));\n    }\n    requestAnimationFrame(function(){fit();send({type:'ready'});});\n  }catch(e){send({type:'error',message:String(e&&e.message||e)});}\n})();\n</script>\n</body>\n</html>";

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
export const TerminalEmulator = forwardRef<TerminalEmulatorHandle, Props>(
function TerminalEmulator({ onReady, onInput, onResize, onError }, ref) {
  const view = useRef<any>(null);
  function emit(packet: object) {
    view.current?.injectJavaScript('window.receiveTerminalPacket(' +
      JSON.stringify(packet) + '); true;');
  }
  useImperativeHandle(ref, () => ({
    write: data => emit({ type:'write',data }),
    reset: () => emit({ type:'reset' }),
    fit: () => emit({ type:'fit' }),
    focus: () => emit({ type:'focus' }),
  }), []);
  function receive(event: WebViewMessageEvent) {
    try {
      const data=JSON.parse(event.nativeEvent.data) as
        {type?:string;data?:string;cols?:number;rows?:number;message?:string};
      if(data.type==='ready')onReady();
      else if(data.type==='input' && typeof data.data==='string')onInput(data.data);
      else if(data.type==='resize' && Number.isInteger(data.cols) && Number.isInteger(data.rows))
        onResize(data.cols!,data.rows!);
      else if(data.type==='error')onError(data.message||'Renderer error');
    } catch { onError('Terminal renderer returned an invalid message.'); }
  }
  return <NativeWebView
    ref={view}
    source={{html:HTML}}
    originWhitelist={['*']}
    onMessage={receive}
    onError={(event: {nativeEvent:{description?:string}})=>onError(event.nativeEvent.description||'WebView failed')}
    onShouldStartLoadWithRequest={(request: {url:string})=>request.url==='about:blank'}
    scrollEnabled={false}
    bounces={false}
    allowsInlineMediaPlayback={false}
    javaScriptEnabled
    domStorageEnabled={false}
    style={styles.view}
  />;
});
const styles=StyleSheet.create({view:{flex:1,backgroundColor:'#141416'}});

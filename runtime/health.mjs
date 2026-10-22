// Internal NoetharaMobile EC2 health endpoint.
// This is not the Expo app, a public chat API, or a terminal transport.
import { createServer } from 'node:http';
const host = '127.0.0.1';
const port = Number(process.env.NOETHARA_HEALTH_PORT || 3000);
createServer((req,res)=>{
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if(path !== '/health'){
    res.statusCode=404;
    res.end(JSON.stringify({error:'Not found'}));
    return;
  }
  res.statusCode=200;
  res.end(JSON.stringify({
    service:'noethara-mobile-linux-runtime',
    healthy:true,
    cliGateway:'private-loopback',
    expoFrontendHosted:false,
    apiReady:false,
  }));
}).listen(port,host,()=>console.log('Noethara health listening on '+host+':'+port));

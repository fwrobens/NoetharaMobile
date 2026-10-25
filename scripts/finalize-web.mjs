// Expo's web bundler may include icons in its asset manifest without
// writing self-hosted .ttf files into dist/. Copy exactly the icon families
// used in Noethara and emit @font-face declarations for Safari/Chrome.
// Keep filenames stable even when Expo changes its content-hash suffix.
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const source = join(process.cwd(),'node_modules','@expo','vector-icons','build',
  'vendor','react-native-vector-icons','Fonts');
const destination = join(process.cwd(),'dist');
const list = await readdir(source);
const families = ['Feather','MaterialCommunityIcons'];
await mkdir(join(destination,'fonts'),{recursive:true});
for (const family of families) {
  const candidate = list.find(filename =>
    (filename===family+'.ttf'||(filename.startsWith(family+'.')&&filename.endsWith('.ttf'))));
  if (!candidate) throw Error('Missing icon font '+family+' in '+source);
  await copyFile(join(source,candidate),join(destination,'fonts',family+'.ttf'));
  console.log('[Noethara web] Included icon font',family);
}
const file = join(destination,'index.html');
const original = await readFile(file,'utf8');
if (!original.includes('</head>')) throw Error('Expo export did not produce valid index.html');
const css = families.map(family =>
  "@font-face{font-family:'"+family+"';src:url('/fonts/"+family+
  ".ttf') format('truetype');font-style:normal;font-weight:normal;font-display:block}"
).join('\n');
const updated=original.replace('</head>', '<style id="noethara-icon-font-fallback">\n'+css+'\n</style></head>');
await writeFile(file,updated,'utf8');
console.log('[Noethara web] Icon fonts embedded in dist/index.html');

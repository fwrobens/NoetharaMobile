import { createApp } from './app.js';
import { openDb } from './db.js';

const port = Number(process.env.PORT ?? 8787);
createApp(openDb()).listen(port, '0.0.0.0', () => console.log(`API listening on http://localhost:${port}`));

import { Hono } from 'hono';
import { api } from './routes/api';
import { internal } from './routes/internal';

/** The whole server. `index.ts` serves it inside Devvit; tests call it directly. */
export const app = new Hono();

app.route('/api', api);
app.route('/internal', internal);

// Local development server that mimics the Vercel function on :3001
import http from 'node:http';
import handler from '../api/index.js';
http.createServer((req, res) => handler(req, res)).listen(3001, '0.0.0.0', () => console.log('API on :3001'));

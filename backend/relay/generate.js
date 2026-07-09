import { GenerateToken } from './auth/tokenManager.ts';
import dotenv from 'dotenv';
dotenv.config();

const secret = 'lknLKn345ljBöll57öH()j46';
const payload = {
    deviceId: 'my-local-server', // ID deines lokalen Servers
    role: 'server'
};

const token = await GenerateToken(payload, secret);
console.log("Dein RELAY_TOKEN:");
console.log(token);

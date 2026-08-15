import * as mongoDB from "mongodb";

let activeClient: mongoDB.MongoClient | null = null;

export async function connectToDatabase(MongoURI: string): Promise<mongoDB.MongoClient | null> {
    const client: mongoDB.MongoClient = new mongoDB.MongoClient(MongoURI);
    try {
        await client.connect();
        return client;
    } catch (e) {
        console.error('Failed to connect to MongoDB:', e);
        return null;
    }
}

export async function initializeDatabase(): Promise<mongoDB.MongoClient | null> {
    if (!process.env.MONGO_URI) {  // Fallback to memory-only auth mode
        console.log('MONGO_URI is not set. Running in memory-only auth mode.');
        return null;
    }

    try {
        const result = await connectToDatabase(process.env.MONGO_URI);
        if (result) {
            console.log('Successfully connected to MongoDB database.');
            activeClient = result;
            
            // Create TTL index for temporary users
            await result.db("NetLink").collection("users").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
            
            return result;
        } else {
            console.warn('MongoDB connection returned null, running in memory-only auth mode.');
            return null;
        }
    } catch (error) {
        console.error('Failed to connect to MongoDB, running in memory-only auth mode:', error);
        return null;
    }
}

export function getMongoClient(): mongoDB.MongoClient | null {
    return activeClient;
}

export async function StoreToken(client: mongoDB.MongoClient, token: string) {
    const db: mongoDB.Db = client.db("NetLink");
    try {
        const collection: mongoDB.Collection = db.collection("tokens");
        await collection.insertOne({ token, timestamp: new Date() });
    } catch (error) {
        console.error('Failed to store token', error);
    }
}

export async function CheckToken(client: mongoDB.MongoClient, token: string) {
    const db: mongoDB.Db = client.db("NetLink");
    try {
        const collection: mongoDB.Collection = db.collection("tokens");
        const result = await collection.findOne({ token });
        return result;
    } catch (error) {
        console.error('Failed to check token', error);
    }
}

export async function CheckUser(client: mongoDB.MongoClient, username: string) {
    // Check by username or email
    try {
        return client.db("NetLink").collection("users").findOne({
            $or: [{ username: username }, { email: username }]
        });
    } catch (error) {
        console.error('Failed to check user', error);
    }
}

export async function GetUsers(client: mongoDB.MongoClient) {
    try {
        return client.db("NetLink").collection("users").find({}, { projection: { password: 0 } }).toArray();
    } catch (error) {
        console.error('Failed to get users', error);
    }
}

export async function RegisterUser(client: mongoDB.MongoClient, userData: any) {
    const { username, email, password } = userData;
    // Check if user or email already exists
    const existing = await client.db("NetLink").collection("users").findOne({
        $or: [{ username }, { email }]
    });
    if (existing) {
        throw new Error("User or email already exists");
    }
    return client.db("NetLink").collection("users").insertOne({
        username,
        email,
        password,
        role: 'user',
        permissions: [],
        targets: [],
        createdAt: new Date(),
        updatedAt: new Date()
    });
}


export async function CreateUser(client: mongoDB.MongoClient, userData: any) {
    const { username, password, role, permissions, expiresAt } = userData;
    const userDoc: any = {
        username,
        password,
        role: role || 'user',
        permissions: permissions || [],
        targets: userData.targets || [],
        createdAt: new Date(),
        updatedAt: new Date()
    };
    if (expiresAt) {
        userDoc.expiresAt = new Date(expiresAt);
    }
    return client.db("NetLink").collection("users").insertOne(userDoc);
}

export async function UpdateUser(client: mongoDB.MongoClient, username: string, userData: any) {
    const updateDoc: any = {
        updatedAt: new Date()
    };
    if (userData.password) updateDoc.password = userData.password;
    if (userData.role) updateDoc.role = userData.role;
    if (userData.permissions) updateDoc.permissions = userData.permissions;

    return client.db("NetLink").collection("users").updateOne(
        { username },
        { $set: updateDoc }
    );
}

export async function DeleteUser(client: mongoDB.MongoClient, username: string) {
    return client.db("NetLink").collection("users").deleteOne({ username });
}


export async function GetServerLogins(client: mongoDB.MongoClient, username: string) {
    return client.db("NetLink").collection("server_logins").find({ username }).toArray();
}

export async function SaveServerLogin(client: mongoDB.MongoClient, username: string, loginData: any) {
    const { id, name, ip, port, loginUsername, password, type } = loginData;
    return client.db("NetLink").collection("server_logins").updateOne(
        { username, id },
        { $set: { name, ip, port, loginUsername, password, type, updatedAt: new Date() } },
        { upsert: true }
    );
}

export async function DeleteServerLogin(client: mongoDB.MongoClient, username: string, id: string) {
    return client.db("NetLink").collection("server_logins").deleteOne({ username, id });
}

export async function GetDockConfig(client: mongoDB.MongoClient, username: string) {
    return client.db("NetLink").collection("dock_config").findOne({ username });
}

export async function SaveDockConfig(client: mongoDB.MongoClient, username: string, pinnedApps: any[]) {
    return client.db("NetLink").collection("dock_config").updateOne(
        { username },
        { $set: { pinnedApps, updatedAt: new Date() } },
        { upsert: true }
    );
}

// Sanitize query to prevent malicious operator injection
function sanitizeQuery(query: any): any {
    if (!query || typeof query !== 'object') return {};
    const safeQuery: Record<string, any> = {};
    const bannedKeys = ['$where', '$function', '$accumulator', '__proto__', 'constructor', 'prototype'];

    for (const [key, value] of Object.entries(query)) {
        if (bannedKeys.includes(key.toLowerCase())) continue;
        if (key === '_id' && typeof value === 'string' && mongoDB.ObjectId.isValid(value)) {
            safeQuery[key] = new mongoDB.ObjectId(value);
        } else if (Array.isArray(value)) {
            safeQuery[key] = value.map(v => typeof v === 'object' && v !== null ? sanitizeQuery(v) : v);
        } else if (typeof value === 'object' && value !== null) {
            safeQuery[key] = sanitizeQuery(value);
        } else {
            safeQuery[key] = value;
        }
    }
    return safeQuery;
}

// Convert string id to ObjectId if valid
function parseIdFilter(id?: string): Record<string, any> {
    if (!id) return {};
    if (mongoDB.ObjectId.isValid(id)) {
        return { $or: [{ _id: new mongoDB.ObjectId(id) }, { id: id }, { _id: id }] };
    }
    return { $or: [{ id: id }, { _id: id }] };
}

export function getAppCollectionName(appId: string, collection: string): string {
    const cleanAppId = appId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanCol = collection.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `app_${cleanAppId}_${cleanCol}`;
}

export interface AppDatabaseActionPayload {
    query?: any;
    data?: any;
    id?: string;
    options?: {
        limit?: number;
        skip?: number;
        sort?: any;
        projection?: any;
    };
}

// Execute scoped database action for an application
export async function ExecuteAppDatabaseAction(
    client: mongoDB.MongoClient,
    appId: string,
    collection: string,
    userId: string,
    action: string,
    payload: AppDatabaseActionPayload = {}
): Promise<any> {
    const colName = getAppCollectionName(appId, collection);
    const db = client.db("NetLink");
    const col = db.collection(colName);

    const userScope = { _userId: userId };
    const safeQuery = { ...sanitizeQuery(payload.query), ...userScope };

    switch (action) {
        case 'find': {
            const limit = Math.min(Math.max(1, payload.options?.limit || 50), 500);
            const skip = Math.max(0, payload.options?.skip || 0);
            const sort = payload.options?.sort || { createdAt: -1 };
            const projection = payload.options?.projection || {};

            const cursor = col.find(safeQuery, { projection }).sort(sort).skip(skip).limit(limit);
            return await cursor.toArray();
        }

        case 'findOne': {
            let filter = safeQuery;
            if (payload.id) {
                filter = { ...parseIdFilter(payload.id), ...userScope };
            }
            const projection = payload.options?.projection || {};
            return await col.findOne(filter, { projection });
        }

        case 'insert': {
            if (!payload.data) {
                throw new Error("Missing 'data' for insert action");
            }
            if (Array.isArray(payload.data)) {
                const now = new Date();
                const docs = payload.data.map(d => ({
                    ...d,
                    _userId: userId,
                    createdAt: d.createdAt ? new Date(d.createdAt) : now,
                    updatedAt: now
                }));
                const result = await col.insertMany(docs);
                return { insertedCount: result.insertedCount, insertedIds: result.insertedIds };
            } else {
                const now = new Date();
                const doc = {
                    ...payload.data,
                    _userId: userId,
                    createdAt: payload.data.createdAt ? new Date(payload.data.createdAt) : now,
                    updatedAt: now
                };
                const result = await col.insertOne(doc);
                return { insertedId: result.insertedId, document: doc };
            }
        }

        case 'update': {
            if (!payload.data) {
                throw new Error("Missing 'data' for update action");
            }
            let filter = safeQuery;
            if (payload.id) {
                filter = { ...parseIdFilter(payload.id), ...userScope };
            }
            const now = new Date();
            const hasOperators = Object.keys(payload.data).some(k => k.startsWith('$'));
            const updateDoc = hasOperators
                ? { ...payload.data, $set: { ...(payload.data.$set || {}), updatedAt: now } }
                : { $set: { ...payload.data, updatedAt: now } };

            delete (updateDoc.$set as any)?._userId;
            delete (updateDoc.$set as any)?._id;

            const result = await col.updateMany(filter, updateDoc);
            return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
        }

        case 'delete': {
            let filter = safeQuery;
            if (payload.id) {
                filter = { ...parseIdFilter(payload.id), ...userScope };
            }
            const result = await col.deleteMany(filter);
            return { deletedCount: result.deletedCount };
        }

        case 'count': {
            return { count: await col.countDocuments(safeQuery) };
        }

        default:
            throw new Error(`Unsupported action: ${action}. Supported actions: find, findOne, insert, update, delete, count`);
    }
}


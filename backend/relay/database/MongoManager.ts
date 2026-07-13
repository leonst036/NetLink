import * as mongoDB from "mongodb";

let activeClient: mongoDB.MongoClient | null = null;

export async function connectToDatabase(MongoURI: string) {
    const client: mongoDB.MongoClient = new mongoDB.MongoClient(MongoURI);
    try {
        await client.connect();
        return client;
    } catch (e) {
        console.log(e);
        return e;
    }
}

export async function initializeDatabase(): Promise<mongoDB.MongoClient | null> {
    if (!process.env.MONGO_URI) {  // Fallback to memory-only auth mode
        console.log('MONGO_URI is not set. Running in memory-only auth mode.');
        return null;
    }

    try {
        const result = await connectToDatabase(process.env.MONGO_URI);
        if (result instanceof mongoDB.MongoClient) {
            console.log('Successfully connected to MongoDB database.');
            activeClient = result;
            return result;
        } else {
            console.warn('MongoDB connection returned an error, running in memory-only auth mode:', result);
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
    const { username, password, role, permissions } = userData;
    return client.db("NetLink").collection("users").insertOne({
        username,
        password,
        role: role || 'user',
        permissions: permissions || [],
        targets: [],
        createdAt: new Date(),
        updatedAt: new Date()
    });
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

export async function GetTopology(client: mongoDB.MongoClient, username: string, target: string) {
    return client.db("NetLink").collection("network_data").findOne({ username, target });
}

export async function SaveTopology(client: mongoDB.MongoClient, username: string, target: string, nodes: any, edges: any, nicknames: any) {
    return client.db("NetLink").collection("network_data").updateOne(
        { username, target },
        { $set: { nodes, edges, nicknames, updatedAt: new Date() } },
        { upsert: true }
    );
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
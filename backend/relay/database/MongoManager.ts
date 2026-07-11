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
    const collection: mongoDB.Collection = db.collection("tokens");
    await collection.insertOne({ token, timestamp: new Date() });
}

export async function CheckToken(client: mongoDB.MongoClient, token: string) {
    const db: mongoDB.Db = client.db("NetLink");
    const collection: mongoDB.Collection = db.collection("tokens");
    const result = await collection.findOne({ token });
    return result;
}
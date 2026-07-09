import * as mongoDB from "mongodb";

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
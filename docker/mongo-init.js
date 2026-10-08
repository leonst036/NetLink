db = db.getSiblingDB('NetLink');

// Seed default RELAY_TOKEN for local_server
const defaultToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXZpY2VJZCI6ImxvY2FsLXNlcnZlciIsImlhdCI6MTc4NjE0ODk1M30.LYcW99CQ4nfekI73qy5hwkzZLmlrbOx3MPa9huMt4pI";

db.tokens.updateOne(
  { token: defaultToken },
  { $setOnInsert: { token: defaultToken, timestamp: new Date() } },
  { upsert: true }
);

console.log("MongoDB initialized with default NetLink token.");

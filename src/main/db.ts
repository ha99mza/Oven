// src/main/db.ts
import { MongoClient } from "mongodb"

const uri = "mongodb://localhost:27017"
const client = new MongoClient(uri)

let isConnected = false

export async function connectDB() {
  if (!isConnected) {
    await client.connect()
    isConnected = true
    console.log("✅ MongoDB connecté")
  }
  return client.db("oven_tracker")
}

export async function insertSession(ovenId: string, session: any) {
  const db = await connectDB()
  const col = db.collection(`sessions_${ovenId}`)
  await col.insertOne(session)
}

export async function getSessions(ovenId: string) {
  const db = await connectDB()
  const col = db.collection(`sessions_${ovenId}`)
  return await col.find().toArray()
}

/*export async function getTemperatures(productId: string) {
  const db = await connectDB()
  const col = db.collection(productId)
  return await col.find().sort({ timestamp: 1 }).toArray()
}*/
export async function getTemperatures(productId: string) {
  const db = await connectDB()
  const col = db.collection(productId)

  const docs = await col
    .find({}, { projection: { _id: 0, temperature: 1, timestamp: 1 } })
    .sort({ timestamp: 1 })
    .toArray()

  // 🔁 Transformation explicite : { temperature, timestamp } → { value, timestamp }
  return docs.map((doc) => ({
    value: doc.temperature,
    timestamp: doc.timestamp,
  }))
}

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
  return await col.find().sort({ startTime: -1 }).toArray()
}

/*export async function getTemperatures(productId: string) {
  const db = await connectDB()
  const col = db.collection(productId)
  return await col.find().sort({ timestamp: 1 }).toArray()
}*/
export async function getTemperatures(productId: string, startTime?: string, endTime?: string) {
  const db = await connectDB()
  const col = db.collection(productId)

  // Filtre de base
  const query: any = {}

  // Si startTime et endTime sont fournis → on filtre par intervalle
  if (startTime && endTime) {
    query.timestamp = {
      $gte: new Date(startTime),
      $lte: new Date(endTime)
    }
  }

  const docs = await col
    .find(query, { projection: { _id: 0, temperature: 1, timestamp: 1 } })
    .sort({ timestamp: 1 }) // tri croissant
    .toArray()

  return docs.map((doc) => ({
    value: doc.temperature,
    timestamp: doc.timestamp,
  }))
}

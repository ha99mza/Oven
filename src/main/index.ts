import { app, shell, BrowserWindow, ipcMain } from "electron"
import { join } from "path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import { SerialPort, ReadlineParser } from "serialport"
import { MongoClient } from "mongodb"
import { getSessions, insertSession, getTemperatures } from "./db"

// -------- Types / État sessions en mémoire --------
type ActiveSession = {
  ovenId: "oven1" | "oven2"
  productId: number
  operation: string
  pieceNumber: number
  startTime: string // ISO
}

let sessionsState: Record<"oven1" | "oven2", ActiveSession | null> = {
  oven1: null,
  oven2: null
}

// -------- Flags & mesures courantes --------
let oven1_status = false
let oven2_status = false
let currentProductId_Oven1 = ""
let currentProductId_Oven2 = ""
let currentTemperatureOven1 = 0
let currentTemperatureOven2 = 0

//
let lastInsertOven1 = 0
let lastInsertOven2 = 0
const INSERT_INTERVAL_MS = 60_000 // 60 secondes

let serialPort: SerialPort | null = null
let parser: ReadlineParser | null = null

function initSerialReader(callback: (data: any) => void) {
  if (serialPort?.isOpen) return

  serialPort = new SerialPort({
    path: "/dev/ttyS2", // Windows ex: COM11 — Linux: "/dev/ttyS2"
    baudRate: 115200
  })

  parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }))

  parser.on("data", (line: string) => {
    try {
      const parsed = JSON.parse(line.trim())
      callback(parsed)
    } catch {
      // ligne invalide -> on ignore
    }
  })

  serialPort.on("error", (err) => {
    console.error("Erreur port série:", err?.message || err)
  })
}


async function insertTemperatureIfActive(parsed: any) {
  try {
    const now = Date.now()
    const mongo = new MongoClient("mongodb://localhost:27017")
    await mongo.connect()
    const db = mongo.db("oven_tracker")

    if (typeof parsed?.temp1 === "number") {
      currentTemperatureOven1 = Math.floor(parsed.temp1)
      if (oven1_status && currentProductId_Oven1 && (now - lastInsertOven1 >= INSERT_INTERVAL_MS)) {
        await db.collection(currentProductId_Oven1).insertOne({
          temperature: parsed.temp1,
          timestamp: new Date()
        })
        lastInsertOven1 = now
      }
    }

    if (typeof parsed?.temp2 === "number") {
      currentTemperatureOven2 = Math.floor(parsed.temp2)
      if (oven2_status && currentProductId_Oven2 && (now - lastInsertOven2 >= INSERT_INTERVAL_MS)) {
        await db.collection(currentProductId_Oven2).insertOne({
          temperature: parsed.temp2,
          timestamp: new Date()
        })
        lastInsertOven2 = now
      }
    }

    await mongo.close()
  } catch (e) {
    console.error("Insertion Mongo échouée:", e)
  }
}

// -------- Fenêtre --------
function createWindow(): void {
  // Démarre la lecture série au lancement
  initSerialReader((data) => {
    // console.log("📡 Série:", data)
    insertTemperatureIfActive(data)
  })

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    kiosk: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

// -------- Cycle de vie app --------
app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron")
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    try {
      parser?.removeAllListeners("data")
      if (serialPort?.isOpen) serialPort.close(() => {})
    } catch {}
    app.quit()
  }
})

// -------- IPC: Mongo (historique & lectures) --------
ipcMain.handle("save-session", async (_event, ovenId: string, session: any) => {
  await insertSession(ovenId, session)
})

ipcMain.handle("get-sessions", async (_event, ovenId: string) => {
  return await getSessions(ovenId)
})

ipcMain.handle("get-session-temperatures", async (_event, productId: string, startTime?: string, endTime?: string) => {
  return await getTemperatures(productId, startTime, endTime)
})

ipcMain.handle("check-product-id-exists", async (_event, productId: number) => {
  const mongo = new MongoClient("mongodb://localhost:27017")
  try {
    await mongo.connect()
    const db = mongo.db("oven_tracker")
    const collections = await db.listCollections().toArray()
    return collections.some((c) => c.name === String(productId))
  } finally {
    await mongo.close()
  }
})

// -------- IPC: État de session en mémoire --------
ipcMain.handle("start-session", (_e, payload: {
  ovenId: "oven1" | "oven2",
  productId: number,
  operation: string,
  pieceNumber: number
}) => {
  const { ovenId, productId, operation, pieceNumber } = payload

  if (sessionsState[ovenId]) {
    return { ok: false, reason: "already-running" }
  }

  // Activer l'enregistrement pour ce four
  if (ovenId === "oven1") {
    oven1_status = true
    currentProductId_Oven1 = String(productId)
  } else {
    oven2_status = true
    currentProductId_Oven2 = String(productId)
  }

  sessionsState[ovenId] = {
    ovenId,
    productId,
    operation,
    pieceNumber,
    startTime: new Date().toISOString()
  }

  // reset du throttle à la création de session (facultatif)
  if (ovenId === "oven1") lastInsertOven1 = 0
  else lastInsertOven2 = 0

  return { ok: true }
})

ipcMain.handle("stop-session", (_e, ovenId: "oven1" | "oven2") => {
  // Désactiver l'enregistrement pour ce four
  if (ovenId === "oven1") {
    oven1_status = false
    currentProductId_Oven1 = ""
  } else {
    oven2_status = false
    currentProductId_Oven2 = ""
  }

  sessionsState[ovenId] = null
  return { ok: true }
})

ipcMain.handle("get-active-session", (_e, ovenId: "oven1" | "oven2") => {
  return sessionsState[ovenId] || null
})

// Températures live (pour Home)
ipcMain.handle("read-live-temperature", async () => {
  return {
    oven1: currentTemperatureOven1 || null,
    oven2: currentTemperatureOven2 || null
  }
})

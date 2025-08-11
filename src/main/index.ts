import { app, shell, BrowserWindow, ipcMain } from "electron"
import { join } from "path"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import { SerialPort, ReadlineParser } from "serialport"
import { MongoClient } from "mongodb"
import { getSessions, insertSession, getTemperatures } from "./db"

// ====== ÉTAT GLOBAL SANS PERSISTANCE DISQUE ======
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

let oven1_status = false
let oven2_status = false
let currentProductId_Oven1 = ""
let currentProductId_Oven2 = ""
let currentTemperatureOven1 = 0
let currentTemperatureOven2 = 0

let serialPort: SerialPort | null = null
let parser: ReadlineParser | null = null

// ====== LECTURE SÉRIE AU LANCEMENT ======
function initSerialReader(callback: (data: any) => void) {
  if (serialPort?.isOpen) return

  serialPort = new SerialPort({
    path: "COM10", // 👉 Windows (ex: COM10). Sous Linux: "/dev/ttyS2"
    baudRate: 115200
  })

  parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }))

  parser.on("data", (line: string) => {
    try {
      const parsed = JSON.parse(line.trim())
      callback(parsed)
    } catch {
      // ligne invalide
    }
  })

  serialPort.on("error", (err) => {
    console.error("Erreur port série:", err?.message || err)
  })
}

// Insère une mesure si la session de ce four est active
async function insertTemperatureIfActive(parsed: any) {
  try {
    const mongo = new MongoClient("mongodb://localhost:27017")
    await mongo.connect()
    const db = mongo.db("oven_tracker")

    if (typeof parsed?.temp1 === "number") {
      currentTemperatureOven1 = parsed.temp1
      if (oven1_status && currentProductId_Oven1) {
        await db.collection(currentProductId_Oven1).insertOne({
          temperature: parsed.temp1,
          timestamp: new Date()
        })
      }
    }

    if (typeof parsed?.temp2 === "number") {
      currentTemperatureOven2 = parsed.temp2
      if (oven2_status && currentProductId_Oven2) {
        await db.collection(currentProductId_Oven2).insertOne({
          temperature: parsed.temp2,
          timestamp: new Date()
        })
      }
    }

    await mongo.close()
  } catch (e) {
    console.error("Insertion Mongo échouée:", e)
  }
}


function createWindow(): void {
  // Start serial reader
  initSerialReader((data) => {
    // console.log( data)
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

// Mongo query
ipcMain.handle("save-session", async (_event, ovenId: string, session: any) => {
  await insertSession(ovenId, session)
})

ipcMain.handle("get-sessions", async (_event, ovenId: string) => {
  return await getSessions(ovenId)
})

ipcMain.handle("get-session-temperatures", async (_event, productId: string) => {
  return await getTemperatures(productId)
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

// ====== IPC: ÉTAT DE SESSION EN MÉMOIRE (PAS DE DISQUE) ======
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

  // Activer le flag d'enregistrement pour ce four
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

  return { ok: true }
})

ipcMain.handle("stop-session", (_e, ovenId: "oven1" | "oven2") => {
  // Couper le flag d'enregistrement pour ce four
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

// Température live (utile pour Home)
ipcMain.handle("read-live-temperature", async () => {
  return {
    oven1: currentTemperatureOven1.toFixed(0) || null,
    oven2: currentTemperatureOven2.toFixed(0) || null
  }
})

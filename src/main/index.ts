import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getSessions } from "./db" 
import { insertSession } from "./db"
import { getTemperatures } from "./db"
import { SerialPort, ReadlineParser } from "serialport"

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})


ipcMain.handle("save-session", async (_event, ovenId, session) => {
  await insertSession(ovenId, session)
})

ipcMain.handle("get-sessions", async (_event, ovenId) => {
  return await getSessions(ovenId)
})
ipcMain.handle("get-session-temperatures", async (_event, productId) => {
  return await getTemperatures(productId)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
let serialPort: SerialPort | null = null
let parser: ReadlineParser | null = null
let currentProductId: string | null = null


ipcMain.handle("start-temperature-logging", async (_event, productId: number, ovenId: string) => {
  currentProductId = String(productId)
 

  if (serialPort?.isOpen) {
    console.warn("Le port série est déjà ouvert.")
    return
  }

  serialPort = new SerialPort({
    path: "COM14", // Com port 
    baudRate: 115200,
  })

  parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }))

  parser.on("data", async (line: string) => {
    try {
      const parsed = JSON.parse(line.trim())

      const key = ovenId === "oven1" ? "temp1" : "temp2"
      if (parsed[key] !== undefined) {
        const temperature = parsed[key]
        const document = {
          temperature,
          timestamp: new Date(),
        }

        const { MongoClient } = await import("mongodb")
        const mongo = new MongoClient("mongodb://localhost:27017")
        await mongo.connect()
        const db = mongo.db("oven_tracker")

        if (currentProductId) {
          await db.collection(currentProductId).insertOne(document)
          console.log(`
            Temp ${temperature} enregistrée dans ${currentProductId}`)
        } else {
          console.error("currentProductId is null, cannot insert document.")
        }
        await mongo.close()

        console.log(`Temp ${temperature} enregistrée dans ${currentProductId}`)
      }
    } catch (err) {
      console.error("Erreur JSON ou insertion :", line, err)
    }
  })
})

ipcMain.handle("stop-temperature-logging", async () => {
  try {
    parser?.removeAllListeners("data")
    parser = null

    if (serialPort && serialPort.isOpen) {
      await new Promise((resolve) => serialPort!.close(resolve))
      console.log("Port serie ferme.")
    }

    serialPort = null
  } catch (err) {
    console.error("Erreur lors de l'arrêt du port série :", err)
  }
})

ipcMain.handle("read-live-temperature", async () => {
  return new Promise((resolve) => {
    if (!serialPort?.isOpen) {
      return resolve({})
    }

    let resolved = false

    const handler = (line: string) => {
      try {
        const parsed = JSON.parse(line.trim())
        if (!resolved) {
          resolved = true
          parser?.removeListener("data", handler)
          resolve(parsed)
        }
      } catch (e) {
        // ignore invalid lines
      }
    }

    parser?.on("data", handler)

    // Timeout pour éviter blocage si rien reçu
    setTimeout(() => {
      if (!resolved) {
        parser?.removeListener("data", handler)
        resolve({})
      }
    }, 2000)
  })
})
ipcMain.handle("check-product-id-exists", async (_event, productId: number) => {
  const { MongoClient } = await import("mongodb")
  const mongo = new MongoClient("mongodb://localhost:27017")

  try {
    await mongo.connect()
    const db = mongo.db("oven_tracker")

    const collections = await db.listCollections().toArray()
    const exists = collections.some(c => c.name === String(productId))

    return exists
  } catch (err) {
    console.error("Erreur lors de la vérification du productId :", err)
    return false
  } finally {
    await mongo.close()
  }
})

// src/pages/TrackingPage.tsx
import React, { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import "react-simple-keyboard/build/css/index.css"
import Keyboard from "react-simple-keyboard"

type OvenId = "oven1" | "oven2"

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>
      }
    }
  }
}

export default function TrackingPage() {
  const { ovenId } = useParams<{ ovenId: OvenId }>()
  const navigate = useNavigate()
  const ovenName = ovenId === "oven1" ? "Oven I" : "Oven II"

  const [productId, setProductId] = useState<number | undefined>()
  const [operation, setOperation] = useState("")
  const [pieceNumber, setPieceNumber] = useState<number | undefined>()
  const [isRunning, setIsRunning] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  const [activeInput, setActiveInput] = useState<"productId" | "pieceNumber" | null>(null)
  const [inputValue, setInputValue] = useState("")

  const keyboardWrapRef = useRef<HTMLDivElement | null>(null)
  const productRef = useRef<HTMLInputElement | null>(null)
  const pieceRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (activeInput === "productId") setInputValue(productId ? String(productId) : "")
    if (activeInput === "pieceNumber") setInputValue(pieceNumber ? String(pieceNumber) : "")
  }, [activeInput, productId, pieceNumber])

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      const inKeyboard = !!keyboardWrapRef.current?.contains(target)
      const inProduct = !!productRef.current?.contains(target)
      const inPiece = !!pieceRef.current?.contains(target)
      if (!inKeyboard && !inProduct && !inPiece) setActiveInput(null)
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [])

  const onKeyboardChange = (input: string) => {
    const numeric = input.replace(/\D+/g, "")
    setInputValue(numeric)
    if (activeInput === "productId") setProductId(numeric ? Number(numeric) : undefined)
    if (activeInput === "pieceNumber") setPieceNumber(numeric ? Number(numeric) : undefined)
  }

  useEffect(() => {
    let mounted = true
    const restore = async () => {
      const session = await window.electron.ipcRenderer.invoke("get-active-session", ovenId)
      if (!mounted) return
      if (session) {
        setProductId(Number(session.productId))
        setOperation(session.operation || "")
        setPieceNumber(Number(session.pieceNumber))
        const st = new Date(session.startTime)
        setStartTime(st)
        setIsRunning(true)
        setElapsedTime(Math.floor((Date.now() - st.getTime()) / 1000))
      }
    }
    restore()
    return () => {
      mounted = false
    }
  }, [ovenId])

  useEffect(() => {
    if (!isRunning || !startTime) return
    const id = window.setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [isRunning, startTime])

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const onStart = async () => {
    if (!productId || !operation || !pieceNumber) {
      alert("Veuillez remplir tous les champs.")
      return
    }

    const res = await window.electron.ipcRenderer.invoke("start-session", {
      ovenId,
      productId,
      operation,
      pieceNumber
    })

    if (!res?.ok) {
      alert("Une session est déjà en cours pour ce four.")
      return
    }

    const now = new Date()
    setStartTime(now)
    setElapsedTime(0)
    setIsRunning(true)
    setActiveInput(null)
  }

  const onStop = async () => {
    await window.electron.ipcRenderer.invoke("stop-session", ovenId)
    const end = new Date()
    await window.electron.ipcRenderer.invoke("save-session", ovenId, {
      productId,
      operation,
      pieceNumber,
      startTime: startTime?.toISOString(),
      endTime: end.toISOString()
    })
    setIsRunning(false)
    setActiveInput(null)
  }

  const toggleStartStop = async () => {
    if (!isRunning) {
      await onStart()
    } else {
      await onStop()
    }
  }

  return (
    <div style={{ height: "100vh", backgroundColor: "#f6f8fa", display: "flex" }}>
      {/* Colonne gauche : Back + Card */}
      <div style={{ flex: 1, padding: "20px" }}>
        {/* Bouton Back */}
        <button
          onClick={() => navigate(-1)}
          style={{
            backgroundColor: "#d3d3d3",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
            fontSize: "18px",
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: "20px"
          }}
        >
          ⬅ Back
        </button>

        {/* Card */}
        <div
          style={{
            padding: "40px",
            backgroundColor: "white",
            borderRadius: "20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
          }}
        >
          <h2 style={{ textAlign: "center", marginBottom: "30px" }}>{ovenName} - Suivi</h2>

          <label>Ordre de Fabrication</label>
          <input
            ref={productRef}
            type="text"
            inputMode="numeric"
            disabled={isRunning}
            value={activeInput === "productId" ? inputValue : productId ?? ""}
            onFocus={() => {
              setActiveInput(null)
              setInputValue(productId ? String(productId) : "")
            }}
            onChange={(e) => {
              const v = e.target.value.replace(/\D+/g, "")
              setInputValue(v)
              setProductId(v ? Number(v) : undefined)
            }}
            style={inputStyle}
          />

          <label>Opération</label>
          <select
            disabled={isRunning}
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- Choisir --</option>
            <option value="Colle Blanche">Colle Blanche</option>
            <option value="Colle Noir">Colle Noir</option>
            <option value="1er Peinture">1er Peinture</option>
            <option value="Déshydratation">Déshydratation</option>
            <option value="2éme Peinture">2éme Peinture</option>
            <option value="Vernis Dolphon">Vernis Dolphon</option>
          </select>

          <label>Quantité</label>
          <input
            ref={pieceRef}
            type="text"
            inputMode="numeric"
            disabled={isRunning}
            value={activeInput === "pieceNumber" ? inputValue : pieceNumber ?? ""}
            onFocus={() => {
              setActiveInput("pieceNumber")
              setInputValue(pieceNumber ? String(pieceNumber) : "")
            }}
            onChange={(e) => {
              const v = e.target.value.replace(/\D+/g, "")
              setInputValue(v)
              setPieceNumber(v ? Number(v) : undefined)
            }}
            style={inputStyle}
          />

          {!isRunning && activeInput && (
            <div ref={keyboardWrapRef} style={{ marginTop: 10 }}>
              <Keyboard
                layout={{
                  default: ["1 2 3", "4 5 6", "7 8 9", "{bksp} 0"]
                }}
                theme="hg-theme-default hg-layout-numeric numeric-theme"
                onChange={onKeyboardChange}
                input={inputValue}
                onKeyPress={(button) => {
                  if (button === "{bksp}") {
                    const next = inputValue.slice(0, -1)
                    onKeyboardChange(next)
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Colonne droite : Chrono + bouton Start/Stop */}
      <div style={{ width: "200px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" }}>
        <div style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "20px" }}>
          {formatTime(elapsedTime)}
        </div>
        <button
          onClick={toggleStartStop}
          style={{
            backgroundColor: isRunning ? "#DC3545" : "#E7962C",
            color: "white",
            padding: "18px",
            width: "150px",
            height: "80px",
            border: "none",
            borderRadius: "15px",
            fontSize: "30px",
            fontWeight: "bold"
          }}
        >
          {isRunning ? "Stop" : "Start"}
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  margin: "10px 0",
  padding: "15px",
  borderRadius: "10px",
  border: "1px solid #ccc",
  fontSize: "18px"
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  padding: "8px",
  appearance: "auto"
}

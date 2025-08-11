import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"

export default function TrackingPage() {
  const { ovenId } = useParams<{ ovenId: "oven1" | "oven2" }>()
  const navigate = useNavigate()
  const ovenName = ovenId === "oven1" ? "Oven I" : "Oven II"

  const [productId, setProductId] = useState<number | undefined>()
  const [operation, setOperation] = useState("")
  const [pieceNumber, setPieceNumber] = useState<number | undefined>()
  const [isRunning, setIsRunning] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Restaure une session active
  useEffect(() => {
    let mounted = true
    const restore = async () => {
      const session = await window.electron.ipcRenderer.invoke("get-active-session", ovenId)
      if (!mounted) return
      if (session) {
        setProductId(Number(session.productId))
        setOperation(session.operation)
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

  // Chrono
  useEffect(() => {
    if (!isRunning || !startTime) return
    const id = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(id)
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

    try {
      const exists = await window.electron.ipcRenderer.invoke("check-product-id-exists", productId)
      if (exists) {
        alert(`Le Product ID ${productId} existe déjà. Veuillez en choisir un autre.`)
        return
      }
    } catch (e) {
      console.error("check-product-id-exists error:", e)
      alert("Erreur lors de la vérification du Product ID.")
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
  }

  const toggleStartStop = async () => {
    if (!isRunning) {
      await onStart()
    } else {
      await onStop()
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f6f8fa"
      }}
    >
      <div
        style={{
          padding: "40px",
          width: "100%",
          maxWidth: "600px",
          backgroundColor: "white",
          borderRadius: "20px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "30px" }}>{ovenName} - Suivi</h2>

        <label>Product ID</label>
        <input
          type="number"
          disabled={isRunning}
          value={productId ?? ""}
          onChange={(e) => setProductId(parseInt(e.target.value))}
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

        <label>N° de Pièce</label>
        <input
          type="number"
          disabled={isRunning}
          value={pieceNumber ?? ""}
          onChange={(e) => setPieceNumber(parseInt(e.target.value))}
          style={inputStyle}
        />

        <div style={{ textAlign: "center", margin: "20px", fontSize: "24px", fontWeight: "bold" }}>
          {formatTime(elapsedTime)}
        </div>

        <button
          onClick={toggleStartStop}
          style={{
            backgroundColor: isRunning ? "#DC3545" : "#E7962C",
            color: "white",
            padding: "18px",
            width: "100%",
            border: "none",
            borderRadius: "15px",
            fontSize: "16px",
            fontWeight: "bold"
          }}
        >
          {isRunning ? "Stop" : "Start"}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
          <button onClick={() => navigate("/")} style={secondaryButtonStyle}>
            Accueil
          </button>
          <button onClick={() => navigate(`/history/${ovenId}`)} style={secondaryButtonStyle}>
            Historique
          </button>
        </div>
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
  padding: "8px", // réduit pour ne pas masquer le texte
  appearance: "auto"
}

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "18px",
  margin: "0 5px",
  backgroundColor: "#d3d3d3",
  border: "none",
  borderRadius: "12px",
  fontWeight: "bold"
}

import React, { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"

export default function TrackingPage() {
  const { ovenId } = useParams()
  const navigate = useNavigate()
  const ovenName = ovenId === "oven1" ? "Oven I" : "Oven II"

  const [productId, setProductId] = useState<number | undefined>()
  const [operation, setOperation] = useState("")
  const [pieceNumber, setPieceNumber] = useState<number | undefined>()
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)
  let timer: NodeJS.Timeout
  // Chrono en secondes
  useEffect(() => {
    
    if (isRunning) {
      timer = setInterval(() => setElapsedTime((prev) => prev + 1), 1000)
    } else {
      clearInterval(timer)
    }
    return () => clearInterval(timer)
  }, [isRunning])

  // Format chrono
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // Démarrer / Arrêter
  const toggleStartStop = async () => {
    if (!isRunning) {
      
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
    } catch (error) {
      console.error("Erreur lors de la vérification du Product ID :", error)
      alert("Erreur lors de la vérification du Product ID.")
      return
    }
      setIsRunning(true)
      setElapsedTime(0)
      const start = new Date()
      setStartTime(start)

      try {
        await window.electron.ipcRenderer.invoke("start-temperature-logging", productId, ovenId)
        console.log("Lecture série démarrée")
      } catch (err) {
        console.error("Erreur de démarrage :", err)
        alert("Erreur lors du démarrage de la lecture série.")
      }
    } else {
      setIsRunning(false)
      const end = new Date()
      await saveSession(end)

      try {
        await window.electron.ipcRenderer.invoke("stop-temperature-logging")
        console.log("Lecture série arrêtée")
      } catch (err) {
        console.error("Erreur à l'arrêt :", err)
        alert("Erreur lors de l'arrêt de la lecture série.")
      }
    }
  }

  const saveSession = async (end: Date) => {
    const session = {
      productId,
      operation,
      pieceNumber,
      startTime: startTime?.toISOString(),
      endTime: end.toISOString(),
    }

    try {
      await window.electron.ipcRenderer.invoke("save-session", ovenId, session)
      //alert("Session enregistrée avec succès.")
    } catch (error) {
      console.error("Erreur d'enregistrement :", error)
      //alert("Échec de l'enregistrement.")
    }
  }

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#f6f8fa",
    }}>
      <div style={{
        padding: "40px",
        width: "100%",
        maxWidth: "600px",
        backgroundColor: "white",
        borderRadius: "20px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}>
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
          style={inputStyle}
        >
          <option value="">-- Choisir --</option>
          <option>Colle Blanche</option>
          <option>Colle Noir</option>
          <option>1er Peinture</option>
          <option>Déshydratation</option>
          <option>2éme Peinture</option>
          <option>Vernis Dolphon</option>
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

        <button onClick={toggleStartStop} style={{
          backgroundColor: isRunning ? "#DC3545" : "#E7962C",
          color: "white",
          padding: "12px",
          width: "100%",
          border: "none",
          borderRadius: "15px",
          fontSize: "16px",
          fontWeight: "bold"
        }}>
          {isRunning ? "Stop" : "Start"}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
          <button onClick={() => navigate("/")} style={secondaryButtonStyle}>Accueil</button>
          <button onClick={() => navigate(`/history/${ovenId}`)} style={secondaryButtonStyle}>Historique</button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  margin: "10px 0",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #ccc"
}

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  margin: "0 5px",
  backgroundColor: "#d3d3d3",
  border: "none",
  borderRadius: "12px",
  fontWeight: "bold"
}

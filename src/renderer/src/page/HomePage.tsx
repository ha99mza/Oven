import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import OvenCard from "../components/OvenCard"

export default function Home() {
  const navigate = useNavigate()
  const [oven1Temp, setOven1Temp] = useState<number | undefined>(undefined)
  const [oven2Temp, setOven2Temp] = useState<number | undefined>(undefined)
  const [, setIntervalId] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Fonction pour lire les températures toutes les 10 secondes
    const fetchTemperature = async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke("read-live-temperature")
        if (result.oven1 !== undefined) {
          setOven1Temp(result.oven1)
        }
        if (result.oven2 !== undefined) {
          setOven2Temp(result.oven2)
        }
      } catch (err) {
        console.error(" Erreur lecture température live:", err)
      }
    }

    
    const id = setInterval(fetchTemperature, 1000) // toutes les 1s
    setIntervalId(id)

    
    return () => {
      if (id) clearInterval(id)
    }
  }, [])

  const handleSelect = (ovenId: string) => {
    navigate(`/track/${ovenId}`)
  }

  const handleHistory = (ovenId: string) => {
    navigate(`/history/${ovenId}`)
  }

  return (
    <div style={{ padding: "20px", backgroundColor: "#f6f8fa", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", padding: "10px" }}>
        <h1 style={{ fontSize: "48px" }}>Oven Tracker</h1>
      </header>

      <hr />

      <div style={cardContainerStyle}>
        <div>
          <h2 style={{ textAlign: "center", fontSize:  "38px" }}>OVEN I</h2>
          <OvenCard
            title=""
            status={oven1Temp !== undefined ? "Active" : "Non Active"}
            temperature={oven1Temp ?? 0}
            onSelect={() => handleSelect("oven1")}
            onHistory={() => handleHistory("oven1")}
          />
        </div>

        <div>
          <h2 style={{ textAlign: "center", fontSize:  "38px"}}>OVEN II</h2>
          <OvenCard
            title=""
            status={oven2Temp !== undefined ? "Active" : "Non Active"}
            temperature={oven2Temp ?? 0}
            onSelect={() => handleSelect("oven2")}
            onHistory={() => handleHistory("oven2")}
          />
        </div>
      </div>
    </div>
  )
}

const cardContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "40px",
  marginTop: "40px",
}

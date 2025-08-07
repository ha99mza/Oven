import React, { useEffect, useState } from "react"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

interface TempData {
  value: number
  timestamp: string
}

interface SessionInfo {
  ovenId: string
  productId: number
  operation: string
  pieceNumber: number
  startTime: string
  endTime: string
}

export default function SessionDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const session = location.state?.session as SessionInfo | undefined

  const [temps, setTemps] = useState<TempData[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const rowsPerPage = 6

  useEffect(() => {
    const fetchTemps = async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke("get-session-temperatures", productId)
        setTemps(result)
      } catch (err) {
        console.error("Erreur de récupération des températures :", err)
      }
    }
    fetchTemps()
  }, [productId])

  const max = Math.max(...temps.map(t => t.value), 0)
  const min = Math.min(...temps.map(t => t.value), 9999)
  const moy = temps.length ? (temps.reduce((a, b) => a + b.value, 0) / temps.length) : 0
  const duration = temps.length >= 2
    ? Math.round((new Date(temps[temps.length - 1].timestamp).getTime() - new Date(temps[0].timestamp).getTime()) / 60000)
    : 0

  const start = currentPage * rowsPerPage
  const end = start + rowsPerPage
  const paginatedTemps = temps.slice(start, end)

  const handleExport = () => {
    const csvContent = [
      `Four;${session?.ovenId ?? "-"}`,
      `Product ID;${session?.productId ?? "-"}`,
      `Opération;${session?.operation ?? "-"}`,
      `N° Pièce;${session?.pieceNumber ?? "-"}`,
      `Début;${session?.startTime ? new Date(session.startTime).toLocaleString() : "-"}`,
      `Fin;${session?.endTime ? new Date(session.endTime).toLocaleString() : "-"}`,
      `Durée;${duration} min`,
      `Température Max;${max.toFixed(2)} °C`,
      `Température Min;${min.toFixed(2)} °C`,
      `Température Moy;${moy.toFixed(2)} °C`,
      '',
      'Température (°C);Horodatage',
      ...temps.map(t => `${t.value.toFixed(2)};${new Date(t.timestamp).toLocaleString()}`)
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Rapport_thermique_ProductID_${productId}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ backgroundColor: "#f6f8fa", minHeight: "100vh", paddingBottom: "40px" }}>
      <div style={{ backgroundColor: "#1E2A46", color: "white", padding: "30px", borderBottom: "3px solid #E7962C" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => navigate(-1)} style={backBtnStyle}>
            ⬅ Back
          </button>
          <h2 style={{ margin: 0 }}>Thermal Report of the Session</h2>
          <button onClick={handleExport} style={exportBtnStyle}>⬇ Export</button>
        </div>

        {/* Cartes des stats */}
        <div style={{ display: "flex", gap: "20px", marginTop: "30px", flexWrap: "wrap" }}>
          <Card title="Temp. Max" value={`${max.toFixed(2)} °C`} />
          <Card title="Temp. Min" value={`${min.toFixed(2)} °C`} />
          <Card title="Temp. Moy" value={`${moy.toFixed(0)} °C`} />
          <Card title="⏱️ Durée" value={`${duration} Min`} />
        </div>
      </div>

      {/* Section tableau + graphique */}
      <div style={{ display: "flex", gap: "30px", padding: "30px", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={cardContainerStyle}>
          <table style={tableStyle}>
            <thead style={theadStyle}>
              <tr>
                <th style={thStyle}>Température (°C)</th>
                <th style={thStyle}>Horodatage</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTemps.map((t, i) => (
                <tr key={i} style={{ textAlign: "center", borderBottom: "1px solid #eee" }}>
                  <td style={tdStyle}>{t.value.toFixed(2)}</td>
                  <td style={tdStyle}>{new Date(t.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: "center", marginTop: "10px" }}>
            <button onClick={() => setCurrentPage(p => Math.max(p - 1, 0))} disabled={currentPage === 0} style={arrowBtnStyle}>⬅</button>
            <button onClick={() => setCurrentPage(p => end < temps.length ? p + 1 : p)} disabled={end >= temps.length} style={arrowBtnStyle}>➡</button>
          </div>
        </div>

        {/* Graphe */}
        <div style={cardContainerStyle}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={temps}>
              <XAxis dataKey="timestamp" tickFormatter={ts => new Date(ts).toLocaleTimeString()} />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip formatter={(value: number) => `${value.toFixed(2)} °C`} />
              <Line type="monotone" dataKey="value" stroke="#E7962C" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

const Card = ({ title, value }: { title: string, value: string }) => (
  <div style={{ backgroundColor: "#24304d", padding: "20px", borderRadius: "12px", minWidth: "200px", flex: 1 }}>
    <h4 style={{ color: "#ccc", fontWeight: "normal" }}>{title}</h4>
    <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "8px" }}>{value}</div>
  </div>
)

const thStyle: React.CSSProperties = { padding: "12px", fontSize: "16px", fontWeight: "bold" }
const tdStyle: React.CSSProperties = { padding: "10px", fontSize: "15px" }

const backBtnStyle: React.CSSProperties = {
  backgroundColor: "#E7962C", color: "white", padding: "8px 16px", border: "none",
  borderRadius: "10px", fontWeight: "bold", cursor: "pointer"
}

const exportBtnStyle: React.CSSProperties = {
  backgroundColor: "#E7962C", color: "white", padding: "8px 16px",
  borderRadius: "10px", fontWeight: "bold", border: "none", cursor: "pointer"
}

const cardContainerStyle: React.CSSProperties = {
  backgroundColor: "white", padding: "20px", borderRadius: "12px", flex: 1,
  boxShadow: "0 0 10px rgba(0,0,0,0.1)"
}

const tableStyle: React.CSSProperties = {
  width: "100%", borderCollapse: "collapse", borderRadius: "10px", overflow: "hidden"
}

const theadStyle: React.CSSProperties = {
  backgroundColor: "#E7962C", color: "white"
}

const arrowBtnStyle: React.CSSProperties = {
  background: "#1E2A46", color: "white", border: "none", borderRadius: "50%",
  width: "36px", height: "36px", fontSize: "18px", cursor: "pointer", margin: "0 5px"
}

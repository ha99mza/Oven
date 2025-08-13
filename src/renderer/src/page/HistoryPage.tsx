import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

interface Session {
  productId: number
  operation: string
  pieceNumber: number
  startTime: string
  endTime: string
}

export default function HistoryPage() {
  const { ovenId } = useParams()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState<Session[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState<string>("") 
  const pageSize = 7

  const ovenName = ovenId === "oven1" ? "Oven I" : "Oven II"

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke("get-sessions", ovenId)
        setSessions(result)
      } catch (err) {
        console.error("Erreur lors du chargement des sessions :", err)
      }
    }
    fetchSessions()
  }, [ovenId])

  // 🔎 Filtrage par productId (supporte saisie partielle : "54" match "5454")
  const filteredSessions = useMemo(() => {
    const s = searchTerm.trim()
    if (!s) return sessions
    return sessions.filter((sess) =>
      String(sess.productId).includes(s)
    )
  }, [sessions, searchTerm])

  // Réinitialiser la pagination quand la recherche change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Pagination sur la liste filtrée
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize))
  const paginatedSessions = filteredSessions.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
  }

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1)
  }

  return (
    <div style={{ backgroundColor: "#f6f8fa", minHeight: "100vh" }}>
      
      <div style={{ backgroundColor: "#1E2A46", padding: "30px", color: "white", borderBottom: "3px solid #E7962C" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            backgroundColor: "#E7962C",
            color: "white",
            padding: "8px 16px",
            border: "none",
            borderRadius: "10px",
            fontWeight: "bold",
            marginBottom: "20px",
            cursor: "pointer",
            fontSize: "20px",
          }}
        >
          ⬅ Back
        </button>
        <h2 style={{ margin: "0 0 6px 0" }}>{ovenName} - Session History</h2>
        <p style={{ marginTop: 0 }}>Here you can find all recorded heating sessions of {ovenName}.</p>

        {/* 🔎 Barre de recherche */}
        
      </div>

      <div style={{ marginLeft: "50px",marginTop: "30px", display: "flex", gap: "10px", alignItems: "center" }}>
          <label htmlFor="search" style={{ fontWeight: 800, fontSize: "24px", }}>Rechercher par Orde de Fabrication :</label>
          <input
            id="search"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Ex: 5466"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.replace(/[^\d]/g, ""))} // n'accepte que des chiffres
            onKeyDown={(e) => {
              // Option: Enter ne change rien de spécial, mais on peut empêcher caractères non-numériques ici si besoin
            }}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #d0d7de",
              outline: "none",
              fontSize: "34px",
              width: "220px"
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={{
                backgroundColor: "#3f352bff",
                color: "white",
                border: "1px solid #3f352bff",
                borderRadius: "8px",
                padding: "12px 22px",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              Effacer
            </button>
          )}
          <span style={{ opacity: 0.85, fontSize: 13 }}>
            {filteredSessions.length} résultat(s)
          </span>
        </div>

      {/* 📄 Table */}
      <div style={{ padding: "30px", maxWidth: "1200px", margin: "0 auto" }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          backgroundColor: "white",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 4px 10px rgba(0,0,0,0.08)"
        }}>
          <thead style={{ backgroundColor: "#E7962C", color: "white" }}>
            <tr>
              <th style={thStyle}>Orde de Fabrication</th>
              <th style={thStyle}>Opération</th>
              <th style={thStyle}>Quantite</th>
              <th style={thStyle}>Début</th>
              <th style={thStyle}>Fin</th>
              <th style={thStyle}>Durée (s)</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSessions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: "20px" }}>
                  Aucun résultat.
                </td>
              </tr>
            ) : (
              paginatedSessions.map((session, index) => {
                const duration = Math.floor(
                  (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000
                )
                return (
                  <tr
                    key={`${session.productId}-${index}`}
                    style={{
                      textAlign: "center",
                      borderBottom: "1px solid #ddd",
                      cursor: "pointer"
                    }}
                    onClick={() =>
                      navigate(`/session-detail/${session.productId}`, {
                        state: { session }
                      })
                    }
                  >
                    <td style={tdStyle}>{session.productId}</td>
                    <td style={tdStyle}>{session.operation}</td>
                    <td style={tdStyle}>{session.pieceNumber}</td>
                    <td style={tdStyle}>{new Date(session.startTime).toLocaleString()}</td>
                    <td style={tdStyle}>{new Date(session.endTime).toLocaleString()}</td>
                    <td style={tdStyle}>{duration}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* 🔄 Pagination controls */}
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button onClick={prevPage} disabled={currentPage === 1} style={navButtonStyle}>⬅ Précédent</button>
          <span style={{ margin: "0 15px", fontSize: "14px" }}>Page {currentPage} / {totalPages}</span>
          <button onClick={nextPage} disabled={currentPage === totalPages} style={navButtonStyle}>Suivant ➡</button>
        </div>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: "14px",
  fontSize: "16px",
  fontWeight: "bold",
  borderBottom: "2px solid white"
}

const tdStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "15px"
}

const navButtonStyle: React.CSSProperties = {
  backgroundColor: "#E7962C",
  color: "white",
  padding: "8px 16px",
  border: "none",
  borderRadius: "8px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "20px",
}

// src/pages/institute/InstituteDashboardPage.tsx
// DEBUG VERSION — heavy console logging to find the exact issue
// Replace your current file with this, open browser console (F12),
// refresh the page, and tell me what you see in the console.

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

export default function InstituteDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pageState, setPageState] = useState<"loading" | "no-institute" | "dashboard" | "error">("loading");
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [institute, setInstitute] = useState<any>(null);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  const addDebug = (msg: string) => {
    console.log(`[a4ai DEBUG] ${msg}`);
    setDebugInfo(prev => [...prev, msg]);
  };

  const loadInstitute = useCallback(async () => {
    setDebugInfo([]);
    addDebug("=== Starting institute load ===");

    // Check 1: Is user available?
    if (!user) {
      addDebug("❌ user is NULL — not logged in or AuthProvider not ready");
      setPageState("error");
      return;
    }
    addDebug(`✅ User found — id: ${user.id}`);
    addDebug(`   Email: ${user.email}`);

    // Check 2: Is Supabase session valid?
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      addDebug("❌ No active Supabase session — auth might be broken");
      setPageState("error");
      return;
    }
    addDebug(`✅ Session active — user_id from session: ${sessionData.session.user.id}`);

    // Check 3: Try to read ALL institutes (no filter)
    addDebug("--- Querying: select * from institutes (no filter) ---");
    const { data: allInstitutes, error: allErr } = await supabase
      .from("institutes")
      .select("*");

    if (allErr) {
      addDebug(`❌ Query ALL institutes failed: ${allErr.message} (code: ${allErr.code})`);
      addDebug("   This means the table doesn't exist OR RLS is blocking even with no filter");
    } else {
      addDebug(`✅ Query ALL institutes returned ${allInstitutes?.length || 0} rows`);
      if (allInstitutes && allInstitutes.length > 0) {
        allInstitutes.forEach((inst: any, i: number) => {
          addDebug(`   Row ${i}: id=${inst.id}, name="${inst.name}", owner_id=${inst.owner_id}`);
        });
      } else {
        addDebug("   ⚠️ Table is empty OR RLS is returning 0 rows");
      }
    }

    // Check 4: Try to read with owner_id filter
    addDebug(`--- Querying: select * from institutes where owner_id = '${user.id}' ---`);
    const { data: myInstitute, error: myErr } = await supabase
      .from("institutes")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (myErr) {
      addDebug(`❌ Filtered query failed: ${myErr.message} (code: ${myErr.code})`);
      setPageState("error");
      return;
    }

    if (!myInstitute) {
      addDebug("❌ Filtered query returned NULL — no institute with your owner_id");
      
      // Check if any institute exists at all
      if (allInstitutes && allInstitutes.length > 0) {
        addDebug("⚠️ BUT institutes DO exist in the table!");
        addDebug("⚠️ The owner_id in the table does NOT match your user.id");
        addDebug(`   Your user.id:      ${user.id}`);
        addDebug(`   Table's owner_id:  ${allInstitutes[0]?.owner_id}`);
        addDebug(`   Match? ${user.id === allInstitutes[0]?.owner_id ? "YES ✅" : "NO ❌ — THIS IS THE BUG"}`);
      }

      setPageState("no-institute");
      return;
    }

    addDebug(`✅ Found your institute: "${myInstitute.name}" (id: ${myInstitute.id})`);
    setInstitute(myInstitute);
    setPageState("dashboard");
  }, [user]);

  useEffect(() => { loadInstitute(); }, [loadInstitute]);

  // Create institute handler
  const handleCreate = async () => {
    if (!createName.trim() || !user) return;
    setCreating(true);
    addDebug(`--- Creating institute: "${createName}" with owner_id: ${user.id} ---`);

    // Try with all possible columns
    const { data, error } = await supabase
      .from("institutes")
      .insert({ name: createName.trim(), owner_id: user.id })
      .select()
      .single();

    if (error) {
      addDebug(`❌ Create failed: ${error.message} (code: ${error.code}, details: ${error.details})`);
      
      // Try to see what columns the table has
      const { data: cols } = await supabase.from("institutes").select("*").limit(0);
      addDebug(`   Table columns test result: ${JSON.stringify(cols)}`);
      setCreating(false);
      return;
    }

    addDebug(`✅ Created! id=${data.id}, owner_id=${data.owner_id}`);
    setCreating(false);
    loadInstitute();
  };

  // ─── RENDER ───

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>a4ai Institute Dashboard — Debug Mode</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>Check your browser console (F12) for detailed logs</p>

      {/* Debug log display */}
      <div style={{ background: "#1a1a2e", color: "#0f0", borderRadius: 16, padding: 20, marginBottom: 24, fontFamily: "monospace", fontSize: 13, lineHeight: 1.8, maxHeight: 400, overflowY: "auto" }}>
        {debugInfo.length === 0 ? (
          <span style={{ color: "#666" }}>Loading...</span>
        ) : (
          debugInfo.map((msg, i) => (
            <div key={i} style={{ color: msg.includes("❌") ? "#ff6b6b" : msg.includes("✅") ? "#51cf66" : msg.includes("⚠️") ? "#ffd43b" : "#0f0" }}>
              {msg}
            </div>
          ))
        )}
      </div>

      {/* State display */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #eee", marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          Current state: <span style={{ color: pageState === "dashboard" ? "green" : pageState === "error" ? "red" : pageState === "no-institute" ? "orange" : "#666" }}>{pageState}</span>
        </h2>

        {pageState === "no-institute" && (
          <div style={{ marginTop: 16 }}>
            <p style={{ marginBottom: 12, color: "#666" }}>No institute found for your account. Create one:</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="Institute name"
                style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid #ddd", fontSize: 15, fontWeight: 600 }}
              />
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{ padding: "12px 24px", borderRadius: 12, background: "#7c3aed", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", opacity: creating ? 0.5 : 1 }}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}

        {pageState === "dashboard" && institute && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#111" }}>🎉 {institute.name}</p>
            <p style={{ color: "#666", fontSize: 14 }}>Institute ID: {institute.id}</p>
            <p style={{ color: "#666", fontSize: 14 }}>Owner ID: {institute.owner_id}</p>
            <p style={{ color: "green", fontWeight: 700, marginTop: 12 }}>
              ✅ Everything works! The database connection is fine.
            </p>
            <p style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
              Now you can replace this debug file with the full dashboard file.
            </p>
          </div>
        )}

        {pageState === "error" && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={loadInstitute}
              style={{ padding: "12px 24px", borderRadius: 12, background: "#7c3aed", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <p style={{ color: "#999", fontSize: 12 }}>
        This is a temporary debug page. Once the issue is fixed, replace this file with the full dashboard.
      </p>
    </div>
  );
}

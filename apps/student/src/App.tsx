import * as React from "react";
import { Button } from "@shaxmatchi/ui";

async function getHealth(): Promise<{ ok: boolean; service: string } | null> {
  try {
    const res = await fetch("http://localhost:3000/health");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function App() {
  const [health, setHealth] = React.useState<string>("loading...");

  React.useEffect(() => {
    void (async () => {
      const data = await getHealth();
      setHealth(data ? `ok (${data.service})` : "backend not reachable");
    })();
  }, []);

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", padding: 24, maxWidth: 720 }}>
      <h1 style={{ margin: 0 }}>Student</h1>
      <p style={{ marginTop: 8, color: "#6B7280" }}>Backend health: {health}</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <Button onClick={() => alert("Hello from Student!")}>Shared UI Button</Button>
        <Button variant="secondary" onClick={() => alert("Secondary button")}>
          Secondary
        </Button>
      </div>
    </div>
  );
}


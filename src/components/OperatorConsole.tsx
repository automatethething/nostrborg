"use client";

import { DrillHistory, PaidIntent } from "@/components/DrillHistory";
import { RestoreDrill } from "@/components/RestoreDrill";
import { useState } from "react";

export function OperatorConsole() {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DrillHistory refreshToken={refreshToken} />
      <RestoreDrill onComplete={() => setRefreshToken((value) => value + 1)} />
      <PaidIntent />
    </div>
  );
}

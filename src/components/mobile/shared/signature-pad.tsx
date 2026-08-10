// Signature manuscrite du PV (tracé au doigt/stylet) et rendu d'une signature
// déjà apposée. Extraits de `admin-app.tsx`.
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eraser } from "lucide-react";
import { toast } from "sonner";

// Forme d'affichage d'une signature côté mobile. Distincte du type `Signature`
// du domaine (`@/types/domain`, importé sous l'alias `PvSignature` dans
// `admin-app.tsx`) : ici les libellés de méthode sont accentués pour l'affichage.
export type Signature = {
  userId: string;
  nom: string;
  qualite: string;
  methode: "tracé" | "otp" | "biométrie";
  imageBase64?: string;
  timestamp: string;
  hash: string;
};

export function SignatureRow({ s, you = false }: { s: Signature; you?: boolean }) {
  const t = new Date(s.timestamp);
  const tStr = `${t.getDate().toString().padStart(2, "0")}/${(t.getMonth() + 1).toString().padStart(2, "0")} · ${t.getHours().toString().padStart(2, "0")}h${t.getMinutes().toString().padStart(2, "0")}`;
  const methodLabel: Record<Signature["methode"], string> = {
    tracé: "Tracé manuscrit",
    otp: "Code OTP",
    biométrie: "Biométrie",
  };
  return (
    <div
      className={`rounded-lg p-2.5 border ${you ? "bg-gold/5 border-gold/30" : "bg-white border-slate-100"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-navy flex items-center gap-1.5">
            {s.nom}{" "}
            {you && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold text-gold-foreground font-bold">
                Vous
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 truncate">{s.qualite}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="inline-flex items-center gap-1 text-emerald-600 text-[11px] font-semibold">
            <CheckCircle2 className="h-3 w-3" /> Signé
          </div>
          <div className="text-[10px] text-slate-400">{tStr}</div>
        </div>
      </div>
      {s.imageBase64 && (
        <div className="mt-1.5 bg-white rounded border border-slate-200 p-1">
          <img src={s.imageBase64} alt="Tracé signature" className="h-12 w-full object-contain" />
        </div>
      )}
      <div className="mt-1 text-[9px] text-slate-400 flex items-center gap-1 flex-wrap">
        <span>{methodLabel[s.methode]}</span> · <span>eIDAS</span> ·{" "}
        <span className="font-mono">SHA-256:{s.hash.slice(0, 8)}…</span>
      </div>
    </div>
  );
}

export function CanvasSignPad({ onValidate }: { onValidate: (img: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [empty, setEmpty] = useState(true);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0D1B3E";
  }, []);

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const t =
      "touches" in e ? (e.touches[0] ?? (e as any).changedTouches[0]) : (e as React.MouseEvent);
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e);
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
  };
  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };
  const validate = () => {
    if (empty) return toast.error("Veuillez tracer votre signature");
    const img = canvasRef.current!.toDataURL("image/png");
    onValidate(img);
  };

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm">
      <div className="text-[11px] text-slate-500 mb-2 text-center">
        Signez dans le cadre avec votre doigt ou stylet
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        className="w-full h-40 bg-slate-50 border border-dashed border-slate-300 rounded-lg touch-none"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={clear}
          className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-[12px] font-semibold flex items-center justify-center gap-1.5"
        >
          <Eraser className="h-3.5 w-3.5" /> Effacer
        </button>
        <button
          onClick={validate}
          className="flex-[2] py-2.5 rounded-lg bg-navy text-white text-[12px] font-semibold flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="h-4 w-4" /> Valider la signature
        </button>
      </div>
    </div>
  );
}

// BigVoteBtn — extrait de `admin-app.tsx`.


export function BigVoteBtn({
  label,
  color,
  icon: Icon,
  onClick,
}: {
  label: string;
  color: "emerald" | "red" | "slate";
  icon: any;
  onClick: () => void;
}) {
  const tons = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return (
    <button
      onClick={onClick}
      className={`py-4 rounded-xl border-2 flex flex-col items-center gap-1.5 active:scale-[0.97] transition ${tons[color]}`}
    >
      <Icon className="h-6 w-6" />
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

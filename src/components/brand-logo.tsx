// Logo institutionnel BNETD (wordmark navy, fond transparent).
// Le fichier vit dans public/ : on le référence par son URL racine.
// variant="white" convertit le tracé navy en blanc (filtre CSS) pour les
// fonds sombres (sidebars, hero, header mobile) où le navy deviendrait illisible.
export function BrandLogo({
  className = "",
  imgClassName = "h-5",
  variant = "navy",
}: {
  className?: string;
  imgClassName?: string;
  variant?: "navy" | "white";
}) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <img
        src="/Logo_bnetd_transparence.png"
        alt="BNETD"
        className={`w-auto ${imgClassName}`}
        style={variant === "white" ? { filter: "brightness(0) invert(1)" } : undefined}
      />
    </span>
  );
}

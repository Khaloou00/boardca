import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Shield, Smartphone, ClipboardSignature, Globe2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { InstallButton } from "@/components/install-button";

const slides = [
  {
    icon: Shield,
    title: "Le CA entièrement digital.",
    desc: "De la convocation à la signature, un cycle complet, sécurisé et souverain pour le BNETD.",
  },
  {
    icon: Smartphone,
    title: "Consultation hors-ligne",
    desc: "Lisez et annotez le Board Book où que vous soyez, même sans réseau internet.",
  },
  {
    icon: ClipboardSignature,
    title: "Votes et signatures eIDAS",
    desc: "Exprimez vos votes en séance et signez le PV légalement depuis votre appareil.",
  },
  {
    icon: Globe2,
    title: "Prêt à démarrer ?",
    desc: "Connectez-vous à votre espace sécurisé pour accéder à vos réunions et documents.",
  },
];

export function MobileOnboarding() {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < slides.length - 1) setStep(step + 1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy text-navy-foreground relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,var(--gold),transparent_40%),radial-gradient(circle_at_80%_80%,var(--gold),transparent_35%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.15))]" />
      
      {/* Top logo */}
      <div className="relative z-10 p-6 flex justify-center mt-10">
        <BrandLogo imgClassName="h-10" />
      </div>

      {/* Main content slider */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 text-center overflow-hidden">
        {slides.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 flex flex-col items-center justify-center p-8 text-center transition-all duration-500 transform ${
              i === step
                ? "opacity-100 translate-x-0"
                : i < step
                ? "opacity-0 -translate-x-12 pointer-events-none"
                : "opacity-0 translate-x-12 pointer-events-none"
            }`}
          >
            <div className="h-24 w-24 rounded-full bg-gold/20 flex items-center justify-center mb-8 border border-gold/30">
              <s.icon className="h-12 w-12 text-gold" />
            </div>
            <h2 className="text-3xl font-bold mb-4 tracking-tight">{s.title}</h2>
            <p className="text-navy-foreground/75 leading-relaxed text-lg">
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 p-8 pb-12">
        <div className="flex items-center justify-center gap-2 mb-10">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-gold" : "w-2 bg-gold/30"
              }`}
            />
          ))}
        </div>

        {step < slides.length - 1 ? (
          <button
            onClick={next}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold text-gold-foreground py-4 font-bold text-lg hover:brightness-110 active:scale-[0.98] transition shadow-lg shadow-gold/20"
          >
            Suivant <ChevronRight className="h-5 w-5" />
          </button>
        ) : (
          <div className="space-y-3">
            <Link
              to="/auth"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold text-gold-foreground py-4 font-bold text-lg hover:brightness-110 active:scale-[0.98] transition shadow-lg shadow-gold/20"
            >
              Accéder à mon espace
            </Link>
            <InstallButton className="w-full flex items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/10 py-4 font-bold text-lg text-gold active:bg-gold/20 transition" />
          </div>
        )}
      </div>
    </div>
  );
}

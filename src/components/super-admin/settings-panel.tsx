import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock, Fingerprint, Server, Save } from "lucide-react";
import { toast } from "sonner";

export function SettingsPanel() {
  const [twoFA, setTwoFA] = useState(true);
  const [biometric, setBiometric] = useState(true);
  const [sso, setSso] = useState(false);
  const [autoLogout, setAutoLogout] = useState([15]);
  const [ipRestrict, setIpRestrict] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-navy">Paramètres sécurité</h1>
        <p className="text-muted-foreground mt-1">
          Politique d'authentification et conformité de la plateforme.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-navy" />
            <h2 className="font-semibold text-navy">Authentification</h2>
          </div>
          <div className="space-y-4">
            <Toggle label="2FA obligatoire pour tous les rôles" value={twoFA} onChange={setTwoFA} />
            <Toggle
              label="Biométrie sur mobile (Face ID / Touch ID)"
              value={biometric}
              onChange={setBiometric}
              icon={Fingerprint}
            />
            <Toggle label="SSO Entreprise (SAML / OIDC)" value={sso} onChange={setSso} />
            <div className="pt-2">
              <Label className="text-sm">Déconnexion automatique — {autoLogout[0]} min</Label>
              <Slider
                value={autoLogout}
                onValueChange={setAutoLogout}
                min={5}
                max={60}
                step={5}
                className="mt-2"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-5 w-5 text-navy" />
            <h2 className="font-semibold text-navy">Conformité</h2>
          </div>
          <div className="space-y-4">
            <Toggle
              label="Restriction par plage IP (VPN BNETD)"
              value={ipRestrict}
              onChange={setIpRestrict}
            />
            <InfoRow label="Chiffrement au repos" value="AES-256" />
            <InfoRow label="Chiffrement en transit" value="TLS 1.3" />
            <InfoRow label="Rétention journal d'audit" value="10 ans" />
            <InfoRow label="Conformité" value="RGPD · ARTCI · Loi 2013-450" />
          </div>
        </Card>

        <Card className="p-6 col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-5 w-5 text-navy" />
            <h2 className="font-semibold text-navy">Hébergement</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <InfoBox label="Datacenter primaire" value="Abidjan — VITIB" />
            <InfoBox label="Réplication" value="Yamoussoukro — temps réel" />
            <InfoBox label="Sauvegardes chiffrées" value="Toutes les 4 h" />
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          className="bg-navy hover:bg-navy-light"
          onClick={() => toast.success("Paramètres enregistrés")}
        >
          <Save className="h-4 w-4 mr-2" /> Enregistrer
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <div className="flex items-center gap-2 text-sm">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span>{label}</span>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-2 border-b border-border/60 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-navy">{value}</span>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/50 border border-border">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-semibold text-navy mt-1">{value}</div>
    </div>
  );
}

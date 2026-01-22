"use client";

import { useEffect, useState, useTransition } from "react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getAutoModSettings, updateAutoModSettings, AutoModSettings } from "@/actions/twitch/moderation";

interface SliderSetting {
  key: keyof AutoModSettings;
  label: string;
  description: string;
}

const sliderSettings: SliderSetting[] = [
  {
    key: "disability",
    label: "Disability",
    description: "Discrimination against disability",
  },
  {
    key: "aggression",
    label: "Aggression",
    description: "Hostility involving aggression",
  },
  {
    key: "sexuality_sex_or_gender",
    label: "Sexuality, Sex or Gender",
    description: "Discrimination based on sexuality, sex, or gender",
  },
  {
    key: "misogyny",
    label: "Misogyny",
    description: "Discrimination against women",
  },
  {
    key: "bullying",
    label: "Bullying",
    description: "Hostility involving name calling or insults",
  },
  {
    key: "swearing",
    label: "Swearing",
    description: "Profanity",
  },
  {
    key: "race_ethnicity_or_religion",
    label: "Race, Ethnicity or Religion",
    description: "Racial discrimination",
  },
  {
    key: "sex_based_terms",
    label: "Sex Based Terms",
    description: "Sexual content",
  },
];

const levelLabels = ["Off", "Low", "Medium", "High", "Maximum"];

export default function AutoModSettingsForm() {
  const [settings, setSettings] = useState<AutoModSettings | null>(null);
  const [localSettings, setLocalSettings] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      const changed = sliderSettings.some((s) => localSettings[s.key] !== (settings[s.key] as number));
      setHasChanges(changed);
    }
  }, [localSettings, settings]);

  async function loadSettings() {
    setIsLoading(true);
    const result = await getAutoModSettings();
    if (result.success && result.data) {
      setSettings(result.data);
      const initial: Record<string, number> = {};
      sliderSettings.forEach((s) => {
        initial[s.key] = result.data![s.key] as number;
      });
      setLocalSettings(initial);
    } else {
      toast.error(result.message);
    }
    setIsLoading(false);
  }

  function handleSliderChange(key: string, value: number[]) {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: value[0],
    }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateAutoModSettings({
        disability: localSettings.disability,
        aggression: localSettings.aggression,
        sexuality_sex_or_gender: localSettings.sexuality_sex_or_gender,
        misogyny: localSettings.misogyny,
        bullying: localSettings.bullying,
        swearing: localSettings.swearing,
        race_ethnicity_or_religion: localSettings.race_ethnicity_or_religion,
        sex_based_terms: localSettings.sex_based_terms,
      });

      if (result.success && result.data) {
        setSettings(result.data);
        toast.success("AutoMod settings saved successfully");
        setHasChanges(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleReset() {
    if (settings) {
      const initial: Record<string, number> = {};
      sliderSettings.forEach((s) => {
        initial[s.key] = settings[s.key] as number;
      });
      setLocalSettings(initial);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AutoMod Settings</CardTitle>
          <CardDescription>Configure how aggressively AutoMod filters messages in your chat. Higher levels result in more aggressive filtering.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {sliderSettings.map((setting) => (
            <div key={setting.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">{setting.label}</Label>
                  <p className="text-sm text-muted-foreground">{setting.description}</p>
                </div>
                <span className="text-sm font-medium text-primary min-w-[80px] text-right">{levelLabels[localSettings[setting.key] ?? 0]}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-8">Off</span>
                <Slider value={[localSettings[setting.key] ?? 0]} min={0} max={4} step={1} onValueChange={(value) => handleSliderChange(setting.key, value)} className="flex-1" />
                <span className="text-xs text-muted-foreground w-8 text-right">Max</span>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} disabled={isPending || !hasChanges}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={isPending || !hasChanges}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

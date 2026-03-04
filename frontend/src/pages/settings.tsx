import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Save, Eye, EyeOff } from "lucide-react";
import * as api from "@/lib/api";

interface Settings {
    scanIntervalMinutes: number;
    isAutoScanEnabled: boolean;
    isAutoCommentEnabled: boolean;
    maxCommentsPerHour: number;
    commentDelaySeconds: number;
    aiProvider: string;
    openaiApiKey: string;
    geminiApiKey: string;
}



const defaultSettings: Settings = {
    scanIntervalMinutes: 5,
    isAutoScanEnabled: false,
    isAutoCommentEnabled: false,
    maxCommentsPerHour: 10,
    commentDelaySeconds: 30,
    aiProvider: "openai",
    openaiApiKey: "",
    geminiApiKey: "",
};

export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showKeys, setShowKeys] = useState({ openai: false, gemini: false });

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        try {
            const res = await api.getSettings();
            setSettings({ ...defaultSettings, ...res.data });
        } finally {
            setLoading(false);
        }
    }


    function update<K extends keyof Settings>(key: K, value: Settings[K]) {
        setSettings((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSave() {
        setSaving(true);
        try {
            await api.updateSettings(settings);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="text-center text-muted-foreground py-12">Loading...</div>;
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save Changes"}
                </Button>
            </div>


            {/* Scan Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Scan Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Scan Interval (minutes)</Label>
                            <p className="text-xs text-muted-foreground">How often to scan groups for new posts</p>
                        </div>
                        <Input
                            type="number"
                            min={1}
                            max={60}
                            value={settings.scanIntervalMinutes}
                            onChange={(e) => update("scanIntervalMinutes", Number(e.target.value))}
                            className="w-24"
                        />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Auto Scan</Label>
                            <p className="text-xs text-muted-foreground">Automatically scan groups at interval</p>
                        </div>
                        <Switch
                            checked={settings.isAutoScanEnabled}
                            onCheckedChange={(v) => update("isAutoScanEnabled", v)}
                        />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Auto Comment</Label>
                            <p className="text-xs text-muted-foreground">Automatically post comments on matched posts</p>
                        </div>
                        <Switch
                            checked={settings.isAutoCommentEnabled}
                            onCheckedChange={(v) => update("isAutoCommentEnabled", v)}
                        />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Max Comments Per Hour</Label>
                            <p className="text-xs text-muted-foreground">Rate limit to avoid detection</p>
                        </div>
                        <Input
                            type="number"
                            min={1}
                            max={50}
                            value={settings.maxCommentsPerHour}
                            onChange={(e) => update("maxCommentsPerHour", Number(e.target.value))}
                            className="w-24"
                        />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Comment Delay (seconds)</Label>
                            <p className="text-xs text-muted-foreground">Delay between posting comments</p>
                        </div>
                        <Input
                            type="number"
                            min={5}
                            max={300}
                            value={settings.commentDelaySeconds}
                            onChange={(e) => update("commentDelaySeconds", Number(e.target.value))}
                            className="w-24"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* AI Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">AI Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <Label>AI Provider</Label>
                        <Select value={settings.aiProvider} onValueChange={(v) => update("aiProvider", v)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="gemini">Gemini</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <Label>OpenAI API Key</Label>
                        <div className="flex gap-2">
                            <Input
                                type={showKeys.openai ? "text" : "password"}
                                value={settings.openaiApiKey}
                                onChange={(e) => update("openaiApiKey", e.target.value)}
                                placeholder="sk-..."
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setShowKeys((p) => ({ ...p, openai: !p.openai }))}
                            >
                                {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Gemini API Key</Label>
                        <div className="flex gap-2">
                            <Input
                                type={showKeys.gemini ? "text" : "password"}
                                value={settings.geminiApiKey}
                                onChange={(e) => update("geminiApiKey", e.target.value)}
                                placeholder="AI..."
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setShowKeys((p) => ({ ...p, gemini: !p.gemini }))}
                            >
                                {showKeys.gemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

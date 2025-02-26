"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiModel, setAiModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [enableHistory, setEnableHistory] = useState(true);
  const [enableLocalStorage, setEnableLocalStorage] = useState(true);
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 1000 });

  // Load saved settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load API key from localStorage
        const savedApiKey = localStorage.getItem("openai_api_key");
        if (savedApiKey) {
          setApiKey(savedApiKey);
        }

        // Load AI settings from localStorage
        const savedAiModel = localStorage.getItem("ai_model") || "gpt-4o";
        const savedTemperature = parseFloat(localStorage.getItem("temperature") || "0.7");
        const savedMaxTokens = parseInt(localStorage.getItem("max_tokens") || "4096");
        const savedEnableHistory = localStorage.getItem("enable_history") !== "false";
        const savedEnableLocalStorage = localStorage.getItem("enable_local_storage") !== "false";

        setAiModel(savedAiModel);
        setTemperature(savedTemperature);
        setMaxTokens(savedMaxTokens);
        setEnableHistory(savedEnableHistory);
        setEnableLocalStorage(savedEnableLocalStorage);

        // Get storage usage
        await fetchStorageUsage();
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, []);

  // Fetch storage usage
  const fetchStorageUsage = async () => {
    try {
      const response = await fetch("/api/storage/usage");
      if (response.ok) {
        const data = await response.json();
        setStorageUsage({
          used: data.used || 0,
          total: data.total || 1000
        });
      }
    } catch (error) {
      console.error("Error fetching storage usage:", error);
    }
  };

  // Save API key
  const handleSaveApiKey = async () => {
    setIsLoading(true);
    try {
      // Save to localStorage
      localStorage.setItem("openai_api_key", apiKey);
      
      // Optional: Validate API key with a test request
      const isValid = await validateApiKey(apiKey);
      
      if (isValid) {
        toast.success("API key saved successfully");
      } else {
        toast.error("Invalid API key");
      }
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Failed to save API key");
    } finally {
      setIsLoading(false);
    }
  };

  // Validate API key with a test request
  const validateApiKey = async (key: string) => {
    try {
      // This is a simple validation - in production you might want to make a test request
      return key.startsWith("sk-") && key.length > 20;
    } catch (error) {
      return false;
    }
  };

  // Save AI settings
  const handleSaveAISettings = () => {
    setIsLoading(true);
    try {
      // Save settings to localStorage
      localStorage.setItem("ai_model", aiModel);
      localStorage.setItem("temperature", temperature.toString());
      localStorage.setItem("max_tokens", maxTokens.toString());
      localStorage.setItem("enable_history", enableHistory.toString());
      
      toast.success("AI settings saved successfully");
    } catch (error) {
      console.error("Error saving AI settings:", error);
      toast.error("Failed to save AI settings");
    } finally {
      setIsLoading(false);
    }
  };

  // Save storage settings
  const handleSaveStorageSettings = () => {
    setIsLoading(true);
    try {
      localStorage.setItem("enable_local_storage", enableLocalStorage.toString());
      toast.success("Storage settings saved successfully");
    } catch (error) {
      console.error("Error saving storage settings:", error);
      toast.error("Failed to save storage settings");
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all data
  const handleClearAllData = async () => {
    if (confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      setIsLoading(true);
      try {
        // Clear localStorage except for settings
        const settingsToKeep = {
          openai_api_key: localStorage.getItem("openai_api_key"),
          ai_model: localStorage.getItem("ai_model"),
          temperature: localStorage.getItem("temperature"),
          max_tokens: localStorage.getItem("max_tokens"),
          enable_history: localStorage.getItem("enable_history"),
          enable_local_storage: localStorage.getItem("enable_local_storage")
        };
        
        localStorage.clear();
        
        // Restore settings
        Object.entries(settingsToKeep).forEach(([key, value]) => {
          if (value) localStorage.setItem(key, value);
        });
        
        // Clear IndexedDB or other storage as needed
        
        toast.success("All data cleared successfully");
        await fetchStorageUsage();
      } catch (error) {
        console.error("Error clearing data:", error);
        toast.error("Failed to clear data");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Format bytes to human-readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Settings</h1>
      
      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="ai">AI Settings</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ai" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Configure your OpenAI API key for AI chat functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">OpenAI API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Your API key is stored locally and never sent to our servers
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveApiKey} disabled={isLoading || !apiKey}>
                {isLoading ? "Saving..." : "Save API Key"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Model Settings</CardTitle>
              <CardDescription>
                Configure the AI model and parameters for chat
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-model">AI Model</Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger id="ai-model" className="w-full">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  GPT-4o offers the best performance for PDF analysis
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">
                  Temperature: {temperature}
                </Label>
                <Input
                  id="temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Lower values make responses more deterministic, higher values more creative
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-tokens">
                  Max Tokens: {maxTokens}
                </Label>
                <Input
                  id="max-tokens"
                  type="range"
                  min="1000"
                  max="8000"
                  step="100"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum length of AI responses (8000 max for GPT-4o)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enable-history"
                  checked={enableHistory}
                  onCheckedChange={setEnableHistory}
                />
                <Label htmlFor="enable-history">Save chat history</Label>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveAISettings} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save AI Settings"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="storage" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Storage Settings</CardTitle>
              <CardDescription>
                Configure how PDVerse stores your files and data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="local-storage"
                  checked={enableLocalStorage}
                  onCheckedChange={setEnableLocalStorage}
                />
                <Label htmlFor="local-storage">Use local storage</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Store all files and data locally on your device
              </p>

              <div className="space-y-2 mt-4">
                <Label>Storage Usage</Label>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div 
                    className="bg-primary h-2.5 rounded-full" 
                    style={{ width: `${Math.min(100, (storageUsage.used / storageUsage.total) * 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatBytes(storageUsage.used)} used</span>
                  <span>{formatBytes(storageUsage.total)} total</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="mr-2" 
                onClick={handleClearAllData}
                disabled={isLoading}
              >
                Clear All Data
              </Button>
              <Button 
                onClick={handleSaveStorageSettings} 
                disabled={isLoading}
              >
                Save Storage Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

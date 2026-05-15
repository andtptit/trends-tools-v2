"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Info } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    crawl_limit: "5",
    actor_tiktok_profile: "clockworks/tiktok-profile",
    actor_tiktok_scraper: "clockworks/tiktok-scraper",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (data) {
        const newSettings = { ...settings };
        data.forEach(item => {
          if (item.key in newSettings) {
            // @ts-ignore
            newSettings[item.key] = item.value;
          }
        });
        setSettings(newSettings);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const upsertData = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('system_settings')
      .upsert(upsertData);

    if (error) {
      toast.error("Lỗi khi lưu cài đặt: " + error.message);
    } else {
      toast.success("Đã lưu cài đặt thành công!");
    }
    setSaving(false);
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="p-8">Đang tải cấu hình...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-3xl font-bold tracking-tight">Cài đặt hệ thống</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Cấu hình Crawler</CardTitle>
          <CardDescription>Điều chỉnh các tham số và Actor ID để cào dữ liệu từ Apify.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="limit">Số lượng bài viết/video tối đa mỗi lần cào</Label>
            <Input 
              id="limit" 
              type="number" 
              value={settings.crawl_limit} 
              onChange={(e) => updateSetting('crawl_limit', e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="actor_profile">Actor ID cho Profile/Kênh</Label>
              <Input 
                id="actor_profile" 
                value={settings.actor_tiktok_profile} 
                onChange={(e) => updateSetting('actor_tiktok_profile', e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actor_scraper">Actor ID cho Hashtag</Label>
              <Input 
                id="actor_scraper" 
                value={settings.actor_tiktok_scraper} 
                onChange={(e) => updateSetting('actor_tiktok_scraper', e.target.value)} 
              />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-md flex gap-3 text-sm text-blue-700">
            <Info className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold mb-1">Mẹo nhỏ:</p>
              <p>Nếu bạn gặp lỗi "Actor with this name was not found", có thể Actor đó đã bị đổi tên hoặc xóa trên Apify Store. Bạn có thể tìm ID mới tại <a href="https://apify.com/store" target="_blank" className="underline font-bold">Apify Store</a> và cập nhật vào đây.</p>
            </div>
          </div>
          
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

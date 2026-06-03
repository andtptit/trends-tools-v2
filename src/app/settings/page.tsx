"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Info, Brain } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    crawl_limit: "5",
    actor_tiktok_profile: "clockworks/tiktok-profile",
    actor_tiktok_scraper: "clockworks/tiktok-scraper",
    base_ai_prompt: "Bạn là một chuyên gia phân tích dữ liệu mạng xã hội và nghiên cứu xu hướng (Trend Analyst). Hãy khắt khe trong việc đánh giá và đưa ra kịch bản thật viral.",
    trend_score_quantitative_weight: "70",
    trend_score_velocity_weight: "60",
    trend_score_min_views_viral: "15000"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Save className="w-5 h-5 text-blue-600"/> Cấu hình thuật toán Trend Score 2.0</CardTitle>
          <CardDescription>Tùy biến trọng số tính điểm và ngưỡng đột biến cho xu hướng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantitative_weight">Tỷ trọng Điểm định lượng (%)</Label>
              <Input 
                id="quantitative_weight" 
                type="number"
                min="0"
                max="100"
                value={settings.trend_score_quantitative_weight} 
                onChange={(e) => updateSetting('trend_score_quantitative_weight', e.target.value)} 
              />
              <p className="text-xs text-gray-500">Tỷ trọng còn lại ({100 - (parseInt(settings.trend_score_quantitative_weight) || 0)}%) sẽ thuộc về điểm định tính từ AI.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="velocity_weight">Tỷ trọng Tốc độ lan truyền trong điểm định lượng (%)</Label>
              <Input 
                id="velocity_weight" 
                type="number"
                min="0"
                max="100"
                value={settings.trend_score_velocity_weight} 
                onChange={(e) => updateSetting('trend_score_velocity_weight', e.target.value)} 
              />
              <p className="text-xs text-gray-500">Tỷ trọng còn lại ({100 - (parseInt(settings.trend_score_velocity_weight) || 0)}%) thuộc về Tỷ lệ tương tác.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_views_viral">Lượt xem/giờ để coi là cực nóng (100 điểm Tốc độ)</Label>
            <Input 
              id="min_views_viral" 
              type="number"
              value={settings.trend_score_min_views_viral} 
              onChange={(e) => updateSetting('trend_score_min_views_viral', e.target.value)} 
            />
            <p className="text-xs text-gray-500">Số lượt xem trung bình mỗi giờ đạt mốc này sẽ được quy đổi thành 100 điểm thành phần Tốc độ.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-purple-600"/> Cấu hình Trí tuệ Nhân tạo (AI)</CardTitle>
          <CardDescription>Thiết lập luật tối cao (Base Prompt) cho AI. Luật này sẽ áp dụng chung cho tất cả các Niche.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="base_prompt">Base System Prompt (Luật gốc cho AI)</Label>
            <Textarea 
              id="base_prompt" 
              className="h-32 text-sm"
              value={settings.base_ai_prompt} 
              onChange={(e) => updateSetting('base_ai_prompt', e.target.value)} 
            />
            <p className="text-xs text-gray-500">Đoạn text này sẽ là "luật tối cao" trước khi bắt đầu phân tích. Nó sẽ tự động kết hợp với Prompt của từng Niche mà bạn đã cài trong mục Danh mục.</p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto flex items-center gap-2 bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu cài đặt AI'}
          </Button>
        </CardContent>
      </Card>

      <div className="pt-4">
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto flex items-center gap-2" variant="outline">
          <Save className="w-4 h-4" />
          {saving ? 'Đang lưu tất cả...' : 'Lưu tất cả cài đặt'}
        </Button>
      </div>
    </div>
  );
}

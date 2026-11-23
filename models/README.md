# İsteğe bağlı 3D model dosyaları (GLB)

Oyun tüm modelleri koddan üretir; bu klasör boş kalabilir. Kullanım izni olan (ör. CC0 / CC-BY) GLB
modelleriniz varsa buraya koyup `manifest.json` içinde tanımlayabilirsiniz. Tanımlı bir model yüklenince
o nesnenin prosedürel görünümü gizlenir; motor alevi, kamera ve fizik aynen çalışır.

```json
{
  "falconBooster": { "file": "models/falcon9-booster.glb" },
  "falconUpper":   { "file": "models/falcon9-upper.glb", "rotY": 0 },
  "superHeavy":    { "file": "models/super-heavy.glb" },
  "ship":          { "file": "models/starship.glb" },
  "dragon":        { "file": "models/dragon.glb" },
  "droneShip":     { "file": "models/drone-ship.glb", "height": 12 },
  "mechazilla":    { "file": "models/tower.glb", "height": 150 },
  "falconPad":     { "file": "models/pad.glb", "height": 95 }
}
```

- Model, alt noktası orijinde ve +Y yukarı olacak şekilde otomatik hizalanır.
- Ölçek verilmezse roket boyuna (veya `height` değerine) göre otomatik ayarlanır; `scale` ile elle verilebilir.
- `rotY` (radyan) ve `y` (metre) ile döndürme / kaydırma yapılabilir.
- Lisans ve marka haklarına dikkat edin: yalnızca kullanım izniniz olan modelleri ekleyin.

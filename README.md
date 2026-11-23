# Yörünge Ağı — Roket Simülasyon Oyunu 🚀🌍

Tarayıcıda çalışan, Three.js tabanlı, fiziğe dayalı bir roket simülasyonu. Amacın Starlink tipi uyduları
yörüngeye taşıyarak dünyaya **%95 internet kapsaması** sağlamak.

## Çalıştırma

`index.html` dosyasını tarayıcıda açman yeterli (internet bağlantısı gerekir; Three.js CDN'den yüklenir).
İstersen yerel bir sunucuyla da açabilirsin:

```bash
python3 -m http.server 8000   # sonra http://localhost:8000
```

## Roketler (sırayla açılır)

| Roket | Kilit | Özellik |
|---|---|---|
| **Falcon 1** | Başlangıç | Tek Merlin, 2 uydu, tek kullanımlık (1. kademe yeniden girişte parçalanır) |
| **Falcon 9 Block 5** | 2 başarılı F1 + $40 M | Rampaya dönüş (RTLS) veya drone gemiye iniş, iniş bacakları, ızgara kanatçıkları |
| **Falcon Heavy** | 3 başarılı F9 + $120 M | Yan boosterlar rampaya **çift iniş**, merkez çekirdek drone gemiye |
| **Starship** | 1 başarılı FH + $300 M | Sıcak kademe ayrılması, Super Heavy kuleye döner ve **"chopstick" kollarla yakalanır** |

## Fizik

- Gerçek kütle / itki / Isp değerleri, irtifaya göre değişen itki, üstel atmosfer, sürükleme, Max-Q
- Dünya dönüşü (408 m/s), Kepler yörünge elemanları (apoapsis/periapsis)
- Booster kurtarma: geri dönüş yanışı, giriş yanışı, ızgara kanatçıklı süzülme, intihar (hoverslam) iniş yanışı
- Yeniden girişte ısınma → plazma efekti; korumasız kademeler parçalanır

## Animasyonlar

Motor alevleri (vakumda genişleyen), kalkış buharı, duman izi, kademe ayrılması, burun konisi ayrılması,
ızgara kanatçık ve iniş bacağı açılması, iniş tozu, kule kollarının kapanması, patlama / ateş topu / şok dalgası /
enkaz parçaları, uyduların bırakılıp güneş panellerini açması, harita görünümünde takımyıldız ve kapsama alanı.

## Kontroller

| Tuş | İşlev |
|---|---|
| `Boşluk` | Kademe ayır |
| `T` | Otopilot aç/kapa |
| `A` / `D` | Yunuslama (manuel) |
| `W` / `S`, `Z` / `X` | Gaz |
| `L` | İniş yanışını ateşle |
| `C` | Kule kollarını kapat (Starship yakalama) |
| `P` | Uyduları bırak |
| `V` / `B` | Araçlar arası kamera |
| `M` | Harita görünümü |
| `,` / `.` | Zaman hızlandırma |
| `K` | Uçuş sonlandırma (FTS) |
| Fare | Sürükle = döndür, tekerlek = yakınlaş |

## Dosyalar

- `index.html` — arayüz
- `css/style.css` — stil
- `js/sim.js` — fizik ve görev simülasyonu (render'dan bağımsız)
- `js/game.js` — 3D sahne, modeller, efektler, HUD, ilerleme (kayıt `localStorage`'da)

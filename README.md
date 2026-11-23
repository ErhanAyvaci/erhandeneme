# Yörünge Ağı — Roket Simülasyon & Strateji Oyunu 🚀🌍

Tarayıcıda çalışan, Three.js tabanlı, fiziğe dayalı bir roket simülasyonu ve uzay şirketi yönetim oyunu.
Amacın: uydu ağınla **dünya nüfusunun %95'ine internet** ulaştırmak.

## Çalıştırma

`index.html` dosyasını tarayıcıda açman yeterli (Three.js CDN'den yüklendiği için internet gerekir).
İstersen yerel sunucuyla: `python3 -m http.server 8000` → `http://localhost:8000`

## Oyun döngüsü (haftalık tur)

- Her hafta her rampadan **bir fırlatma** yapabilirsin; araştırma, tesis, filo ve sözleşme kararları verirsin.
- **Haftayı bitir** → fabrikalar uydu üretir, boosterlar bakımdan/üretimden çıkar, aboneler öder, tesis giderleri düşer,
  yeni hava durumu ve sözleşme teklifleri gelir.
- Uçuş görselleştirmesinde gece/gündüz gerçek zamanlıdır: fırlatma saati hava raporunda yazar, gece fırlatmalarında
  şehir ışıkları, projektörler ve motor alevinin yeri aydınlatması görülür.

## Ar-Ge ağacı (para + başarı şartı)

| Dal | Örnek zincir |
|---|---|
| Roketler | Falcon 1 → Merlin 1D → **Falcon 9** → **Falcon Heavy** → Raptor → **Starship** → Starship V2 |
| Kurtarma | (2 başarılı F1 uçuşu) **Izgara kanatçıkları** → okyanusa kontrollü iniş testi → İniş bacakları → **Rampaya dönüş** → Drone gemi → Burun konisi kurtarma → **Mechazilla kule yakalama** → **Ship yakalama** |
| Motor | MVac uzatma, Block 5, motor güvenilirliği, Raptor 2/3 |
| Uydular | Starlink v0.9 → v1.0 → **v1.5 (lazer)** → V2 mini → V3, yüksek eğimli yörüngeler, **GEO optik röle** |
| Görevler | Ticari GTO uyduları, Kargo Dragon, Mürettebatlı Dragon |

Falcon 1 **uydu taşımaz**: test uçuşları ve küçük sözleşmelerle para ve deneyim kazandırır.

## Tesisler

Uydu fabrikası (haftalık üretim), roket fabrikası (booster üretim süresi), bakım hangarı, LC-39A rampası (Falcon Heavy),
Starbase (Starship + 2 Mechazilla kulesi), drone gemiler, burun konisi gemisi.

## Uydu ağı

- Dünya 17 bölgeye ayrılır (her birinin abone talebi var).
- Uydular **yer istasyonu** olan bölgelerde hizmet verir; okyanuslar ve kutuplar için **lazer bağlantılı uydular**
  veya **GEO röle uyduları** gerekir.
- Yörünge eğimi önemli: 53° orta enlemler, 70° yüksek enlemler, 97.6° kutuplar.
- Kapasite sınırı: daha yeni nesil uydular daha çok aboneye hizmet verir.

## Fizik

- Gerçek değerlere yakın kütle / itki / Isp, irtifaya göre itki, üstel atmosfer, sürükleme, Max-Q, Dünya dönüşü
- Hava durumu: jet akımı (Max-Q'da yapısal yük), yer rüzgârı (iniş/yakalama), dalgalar (drone gemi güvertesi)
- Motor arızaları (çok motorlu roketlerde motor-arızası toleransı)
- Booster kurtarma: geri dönüş yanışı, giriş yanışı, ızgara kanatçıklı süzülme, intihar (hoverslam) iniş yanışı
- Ship: yörüngeden çıkış yanışı, göbek üstü yeniden giriş, çevrilme manevrası, kule yakalama (RK4 çarpma noktası tahmini)
- GTO (35 786 km apoapsis) ve uzay istasyonu (410 km) hedefleri

## Kontroller

| Tuş | İşlev |
|---|---|
| `Boşluk` | Kademe ayır |
| `T` | Otopilot aç/kapa |
| `A` / `D` | Yunuslama (manuel) |
| `W` / `S`, `Z` / `X` | Gaz |
| `L` | İniş yanışını ateşle |
| `C` | Kule kollarını kapat |
| `P` | Yükü bırak |
| `V` / `B` | Araçlar arası kamera |
| `N` | Sinematik kamera (takip / yer / teleobjektif / araç üstü) |
| `M` | Harita görünümü |
| `,` / `.` | Zaman hızlandırma |
| `K` | Uçuş sonlandırma (FTS) |
| Fare / dokunmatik | Sürükle = döndür, tekerlek / iki parmak = yakınlaş |

Dokunmatik cihazlarda ekran düğmeleri otomatik görünür.

## Dosyalar

- `index.html`, `css/style.css` — arayüz
- `js/sim.js` — fizik ve görev simülasyonu (render'dan bağımsız)
- `js/progress.js` — Ar-Ge, tesisler, haftalık tur, filo, ağ modeli, sözleşmeler, hava durumu, başarımlar
- `js/models.js` — detaylı prosedürel 3D modeller (roketler, Dragon, kuleler, gemiler)
- `js/hangar.js` — kontrol merkezi sekmeleri
- `js/game.js` — 3D sahne, efektler, kamera, HUD
- `js/textures.js` — gömülü Dünya dokuları (NASA Blue Marble / Black Marble türevleri, kamu malı)

# Yörünge Ağı — Roket Simülasyon & Strateji Oyunu 🚀🌍

Tarayıcıda çalışan, Three.js tabanlı, fiziğe dayalı bir roket simülasyonu ve uzay şirketi yönetim oyunu.
Amacın: uydu ağınla **dünya nüfusunun %95'ine internet** ulaştırmak.

## Çalıştırma

- **Vercel / herhangi bir statik sunucu:** Three.js repoda gömülü (`vendor/three`), internet bağlantısı veya derleme gerekmez.
- **Yerel:** `python3 -m http.server 8000` → `http://localhost:8000`
- **Dosyayı doğrudan açmak** (`index.html` çift tık) da çalışır; bu durumda Three.js CDN'den yüklenir (internet gerekir).

## Vercel'e yükleme

Proje statik bir sitedir (derleme adımı yok); `api/` klasöründeki iki küçük fonksiyon isteğe bağlı bulut kaydı içindir. `vercel.json` önbellek başlıklarını ve temiz URL'leri ayarlar.

1. <https://vercel.com/new> → **Import Git Repository** → bu repoyu seç.
2. **Framework Preset:** `Other` · **Build Command:** boş · **Output Directory:** boş (kök dizin) · **Install Command:** boş.
3. **Deploy**. Her push otomatik yeniden yayınlanır (varsayılan dal → production, diğer dallar → önizleme).

Komut satırından: `npm i -g vercel && vercel --prod` (repo kök dizininde).

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
| `I` | Bölünmüş ekran (booster ve üst kademe aynı anda) |
| `,` / `.` | Zaman hızlandırma |
| `K` | Uçuş sonlandırma (FTS) |
| Fare / dokunmatik | Sürükle = döndür, tekerlek / iki parmak = yakınlaş |
| `O` | Duraklat |
| `U` | Sesi aç/kapat |

Dokunmatik cihazlarda ekran düğmeleri otomatik görünür.

## Şirket yönetimi (v3)

- **Zorluk:** Kolay / Normal / Zor (başlangıç parası, arıza oranı, hava, rakip gücü, abone hedefi).
- **Ar-Ge kuyruğu:** projeler haftalar sürer; mühendis sayısı hızı ve paralel laboratuvar sayısını belirler (maaşlar haftalık).
- **Üretim darboğazları:** uydu, Merlin/Raptor motoru ve abone terminali fabrikaları ayrı kaynaklardır.
- **Uydu kohortları:** uydular iyon iticiyle birkaç haftada kabuğa yükselir, ~5 yıl yaşar; sıkışık kabuklarda uzay çöpü ve çarpışma riski artar.
- **Pazar:** bölge bazlı fiyat (düşük/normal/premium), ülke lisansları, yer istasyonu seviyeleri, düşük gecikme primi, askeri paket; iki yapay zekâ rakip pazar payı için yarışır.
- **Olay kartları ve meydan okumalar:** güneş fırtınası, lisans reddi, grev, devlet ihalesi…; her hafta ödüllü bir görev.
- **Finans:** Seri A/B/C ve halka arz, şirket değerlemesi, fırlatma sigortası, FAA soruşturması, müşteri itibarı, Starbase halk onayı.
- **Filo:** booster isimlendirme, uçuş geçmişi, aşınma ve bakım politikası (hızlı/standart/titiz).
- **Ay ve Mars:** tanker uçuşlarıyla yörünge deposunu doldur, HLS ile Ay'a, pencere açıkken Mars'a in (iniş sahnesini sen yönetirsin).
- **Serbest mod:** her roketi, her ayarla, ekonomiyi etkilemeden dene.

## Uçuş ve görseller (v3)

- Geri sayım beklemesi (iptal → %85 iade / devam → arıza riski), elle iniş modu, drone gemide devrilme, Ship ısı kalkanı hasarı,
  üst kademenin yörüngeden indirilmesi, Starship'in rampaya zarar vermesi.
- Gerçek kıyı şeritleri: Cape Canaveral (Atlantik, Banana River, Indian River, Mosquito Lagoon) ve Boca Chica (Körfez, South Bay, Rio Grande).
- Hava görselleri: alçak bulut katmanı, buluttan geçiş, yağmur, sis, şimşek.
- Sıralı patlamalar ve yanan yakıt bulutu, alacakaranlıkta güneşle aydınlanan "denizanası" egzoz bulutu.
- Türkçe sesli geri sayım ve anonslar, canlı yayın telemetri şeridi, bölünmüş ekran, hangarda dönen 3D roket önizlemesi, etkileşimli eğitim.

## Altyapı

- **Hızlı açılış:** düşük çözünürlüklü dokular sayfayla gelir, yüksek çözünürlük (`js/textures-hi.js`) arka planda yüklenir.
- **PWA:** ana ekrana eklenebilir, service worker ile çevrimdışı oynanır (`manifest.webmanifest`, `sw.js`).
- **Bulut kaydı ve sıralama:** `api/save.js`, `api/leaderboard.js` (Vercel Functions). Vercel projesine
  **Storage → Upstash Redis (KV)** entegrasyonu eklendiğinde `KV_REST_API_URL` / `KV_REST_API_TOKEN` otomatik tanımlanır.
  Yapılandırılmamışsa oyun normal çalışır, yalnızca bulut özellikleri devre dışı kalır.
- **Testler:** `npm test` → fizik senaryoları (F1/F9/FH/Starship inişleri, GTO, devrilme, ısı kalkanı), ekonomi botu (her zorlukta kazanılabilirlik), API.

## Diğer özellikler

- **Danışman:** Fırlatma sekmesinde sıradaki mantıklı adımları önerir.
- **Grafik kalitesi:** Düşük / Orta / Yüksek (yavaş cihazlarda otomatik düşer). Kayıt `localStorage`'da; **Kaydı indir / Kayıt yükle** ile başka cihaza taşınabilir.
- **Ses:** Prosedürel motor sesi ses hızıyla gecikir (uzaktaki kamerada Doppler etkisi), havada sönümlenir; ses patlamaları, rüzgâr, patlamalar.
- **Dragon:** Kargo/mürettebat görevlerinde kapsül ayrılır, burun kapağı açılır ve uzay istasyonuna kenetlenir.

## Dosyalar

- `index.html`, `css/style.css` — arayüz
- `js/sim.js` — fizik ve görev simülasyonu (render'dan bağımsız)
- `js/progress.js` — Ar-Ge, tesisler, haftalık tur, filo, ağ modeli, sözleşmeler, hava durumu, başarımlar
- `js/models.js` — detaylı prosedürel 3D modeller (roketler, Dragon, kuleler, gemiler)
- `js/hangar.js` — kontrol merkezi sekmeleri
- `js/game.js` — 3D sahne, efektler, kamera, HUD
- `js/textures.js`, `js/textures-hi.js` — gömülü Dünya dokuları (NASA Blue Marble / Black Marble türevleri, kamu malı)
- `api/` — bulut kaydı ve sıralama (Vercel Functions)
- `tests/` — `node --test` regresyon testleri, `tests/bot.js` otomatik oyuncu
- `manifest.webmanifest`, `sw.js`, `icons/` — PWA
- `vendor/three/` — Three.js r160 (MIT lisansı) ve kullanılan eklentiler
- `vercel.json`, `favicon.svg` — dağıtım yapılandırması

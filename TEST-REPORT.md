# Oyun kontrol raporu

20 Ekim 2026 — yerel proje, Cloudflare Wrangler çalışma ortamı.

## 2026.10.24.2 — Yayın adımı

- Üretim build komutu yalnızca sürüm ve dosya kontrolüne çevrildi; yayın sırasında veri indirilmez.
- Sürüm/dosya kontrolü çalıştırıldı. Oyun testleri bu yapılandırma değişikliği için tekrar çalıştırılmadı.

## 2026.10.24.1 — Spyfall kişisel notlar ve oylama

- Değişen JavaScript dosyalarında sözdizimi kontrolü başarılı.
- Cloudflare kuru derleme kontrolü yapıldı; canlıya dağıtım yapılmadı.
- Bu değişiklik için otomatik veya çok oyunculu işlev testi çalıştırılmadı. Önceki oylama testleri, eski erken sonuçlanma davranışına aittir.

## 2026.10.21.10 — Papaz Kimde ve çizim oyunu

- Yeni modüllerde Node sözdizimi kontrolü başarılı.
- Cloudflare Wrangler kuru derlemesi başarılı; 14 oyun seçeneği ve 12 statik dosya. Sıkıştırılmış Worker yaklaşık 1.69 MiB.
- Yeni oyunlar için otomatik test eklenmedi veya çalıştırılmadı; aşağıdaki eski test sonuçları bu iki oyunu kapsamaz.
- Örnek oyun durumlarıyla 1280 px masaüstü ve 390 px mobil görünüm görsel olarak incelendi. Gerçek çok oyunculu oynanış testi yapılmadı.
- Bu paket canlı siteye dağıtılmadı.

## Önceki sürümlerin sonuçları

- `npm test`: **104 test başarılı, 0 başarısız** (21 Ekim güncellemesi).
- `test/browser-games.mjs`: kurulu Chrome ve dört bağımsız tarayıcı oturumuyla tüm senaryolar başarılı; gerçek WebSocket bağlantıları kullanıldı. Tarayıcı JavaScript hatası görülmedi. 390 px mobil ekranda yatay taşma kontrolü geçti.
- `test/browser-lol.mjs`: dört ayrı tarayıcıda beş LoL modu, şampiyon arama, gerçek 30 saniyelik süre aşımı, yanlış/doğru cevaplar, 2–0 seri bitişi, yeni seri ve Futbol XOX'a geri dönüş başarılı. Bilerek yüklenmeyen şampiyon görselleri isimleri engellemedi. Mobil ekran taşması veya JavaScript hatası görülmedi.
- Gerçek **30 saniyelik** XOX Durable Object alarmı takım sırasını değiştirdi.
- `test/live-city-clock.mjs`: gerçek **90 saniyelik** İsim Şehir alarmı sonuçları açtı; geç cevap reddedildi.
- `test/live-spy-clock.mjs`: gerçek WebSocket oylaması casusu buldu; **30 saniyelik son tahmin** süresi dolunca tur bitti ve her masuma bir kez +2 puan yazıldı.
- `wrangler deploy --dry-run`: başarılı. Bu kontrol canlı yayını değiştirmedi.

## Oyunlar

| Oyun | Kontrol edilen ve düzeltilen davranış |
|---|---|
| Spyfall | Casus ve masum aynı aday listesini görür. Seçilen cevap yalnızca masumlara gönderilir. 12 kategori, kategori başına 40–71 aday. Her oyuncu bağımsız kriptografik kurayla seçilebilir; art arda casus olmak engellenmez. Rastgele sayının eşit dağılımını bozan modulo artığı reddedilir. Geç katılan izleyicidir. Yeniden katılım kendi rolünü korur. |
| Codenames | İki anlatıcı aynı 25 renkli anahtarı alır. Tahminciler gizli anahtarı alamaz; açılan kart renkleri herkeste görünür. Takımlar ve roller seçilir; takım başına bir anlatıcı ve en az bir tahminci gerekir. 1.295 kelimeden tekrarsız tahta üretilir. İlk takımın hedefi 9, diğerinin 8'dir. İpucu, sayı + 1 tahmin, sıra bitirme, yanlış/nötr kart, suikastçı ve oyun sonu engelleri kontrol edildi. |
| İsim Şehir | Türkçe harfler, 8 kategori, gizli cevaplar, taslak kaydı, gönderilen cevabı kilitleme, herkes gönderince erken bitirme. Süre dolunca taslaklar sonuçlara katılır. Aynı cevap 5, farklı cevap 10, boş/yanlış harf 0 puandır. Elle geçersiz sayma puanları yeniden hesaplar. Sayfa yeniden çizilirken yazılanlar silinmez. |
| Futbol XOX | Oyuncular X/O takımlarına ayrılır. Sıra, 30 saniye, pas ve yanlış cevabın sırayı geçirmesi sunucuda uygulanır. Tekrar futbolcu, dolu hücre, eski tahta/sıra ve bitmiş oyun hamleleri denetlenir. Sekiz kazanma çizgisinin tamamı ve beraberlik kontrol edildi. Geçerli cevap kalmayan tahta da beraberlikle biter. |

## Eklenen maç kuralları

- LoL XOX: Riot 16.20.1 listesinin tamamı (173 şampiyon), Wiki kaynak revizyonları, tür/köken/bölge ayrımı, geçmiş türlerin hariç tutulması ve Nunu/Willump birleşimi doğrulandı. Beş modda 200'er olmak üzere 1.000 tahta bağımsız çözüm aramasıyla kontrol edildi; her tahta dokuz farklı şampiyonla tamamlanabildi. Yanlış/tekrar/eski cevaplar, sıra, 30 saniye, seri puanı ve iki galibiyetle bitiş de test edildi. Önceki 54 oyun/veri testi geçti.

- XOX yeni havuzu: 2.000 çözülebilen tahta test edildi. Takım × takım: 793/1.000 ilk 30 havuzu, 896/1.000 Türk kulübü, bunların 850/896 tanesi dört büyük. Takım × ülke: 804/1.000 ilk 30 havuzu, 912/1.000 Türk kulübü, bunların 861/912 tanesi dört büyük. Seçilen havuz dışına çıkılmadı; her tahtada en fazla bir Türk takımı vardı. Beş Türk takımının her biri iki modun bütün kulüp konumlarında ayrıca kontrol edildi. %80/%90/%95 sınırlarının tüm 100 kura bileti için tam karşılığı doğrulandı.

- Spyfall yanlış suçlama (+2 casus), gönüllü doğru tahmin (+2 casus), yakalanıp doğru tahmin (+1 casus), yanlış/süresiz tahmin (her masuma +2), salt çoğunluk ve 10 puanla maç sonu test edildi. Aynı oy/tahmin veya eşzamanlı mesajlar yeniden puan yazamaz. Sonraki tura geçerken puanlar korunur; biten maçtan yeni maç açınca sıfırlanır.
- XOX 2–0 ve 2–1 seri sonuçları, beraberlikte skor koruma, sabit takımlar, iki galibiyetle bitiş ve yeni seri sıfırlaması test edildi.
- İsim Şehir 5 tur, farklı harfler, toplam puan, tur geçişinde değerlendirmeleri sabitleme, ortak kazananlar ve yeni maç sıfırlaması test edildi.
- Genişletilmiş dört tarayıcı testi Spyfall'ın bütün puan dallarını, gerçek oyunlarla 10 puana ulaşmayı, 5 turluk İsim Şehir maçını ve XOX'ta 2–0 seri kazanmayı arayüz üzerinden oynatır.

## Ortak kontroller

Eşzamanlı mesajlar sıraya alınır: iki takım arkadaşı aynı anda oynadığında iki hamle birden kabul edilmez; eşzamanlı İsim Şehir cevapları kaybolmaz. Yeniden bağlanmada açık oyuncu kimliğine ek olarak özel oturum anahtarı gerekir. Eski kurallarla saklanmış uyumsuz oyunlar menüye sıfırlanır. Boş XOX odalarında tekrarlayan alarmlar durur.

## Sınırlar

- İsim Şehir cevaplarının anlam/kategori doğruluğu sözlükle otomatik doğrulanmaz; oyuncular sonuç tablosunda değerlendirir. Harf, eşitlik ve puan hesabı otomatiktir.
- Codenames ipucunun anlamsal uygunluğunu oyuncular değerlendirir. Spyfall soru/tartışması sesli iletişimle yürür.
- Futbol cevapları mevcut Wikidata veri kapsamıyla sınırlıdır; kaynağı eksik doğru bir futbolcu reddedilebilir.
- Tarayıcı oyun testinde harici görsel metadatası yerine boş yanıt kullanıldı; görsel çözümleme/kaynak güvenliği ayrı otomatik testlerde kontrol edildi.
- Kontroller yerel ortamda yapıldı. Güncel `public` ve `src` klasörleri GitHub'a yüklenip Cloudflare yeniden yayımlamadan canlı site değişmez. Testler tüm olası hataların yokluğunu garanti etmez.

## Sürüm 2026.10.20.4

LoL XOX ve Futbol XOX menünün ilk iki ayrı kartıdır. Sürümlü JS/CSS bağlantıları ve dağıtım öncesi bütünlük kontrolü eklendi. `/api/version` yayındaki sürümü gösterir. İncelenen canlı adreste LoL API 404 döndüğü için eski dağıtım bulundu; yereldeki değişiklikler henüz canlıya gönderilmedi.

## Sürüm 2026.10.20.5

65 kulüplük izinli katalog: 18 Süper Lig kulübü, beş büyük ligden altışar ve diğer liglerden seçilmiş liderler. Çıkarılan kulüplerin rastgele/elle tahtalara geri girememesi, tüm yerel kulüplerin katalogda kalması ve eski tahtaların veri sürümüyle reddedilmesi kontrol edildi. 2.000 tahta: takım × takımda 798 ilk 30 profili, 908 Türk kulübü, bunlardan 859 dört büyük; takım × ülkede 810 ilk 30 profili, 905 Türk kulübü, bunlardan 866 dört büyük. Hepsi dokuz farklı cevapla çözülebildi. Bu sürümde 68 test geçti. Canlıya gönderilmedi.

## Sürüm 2026.10.20.6 — güncel futbol kadroları

- Seçili 65 kulübün A takım kadroları: 1.831 oyuncu, bütün kaynak satırları işlendi. 0 çözülemeyen biyografi. Kaynakta sayfası/kimliği olmayan oyuncular gerçek kadro kaydıyla, uydurma Wikidata kimliği olmadan tutuldu.
- Arşiv ile birleştirilmiş toplam: 39209 oyuncu; 1206 yeni oyuncu ve 2542 yeni oyuncu–kulüp ilişkisi. Kariyer arşivi korundu.
- Davinson Sánchez: Ajax/Tottenham/Galatasaray; Kerem Aktürkoğlu: Galatasaray/Benfica/Fenerbahçe; Bitshiabu: PSG/Leipzig/Galatasaray; Deniz Gül: Porto/Galatasaray arama ve doğrulama testlerinden geçti.
- Kullanıcının seçtiği kural: güncel A takım kaydı yeterlidir. 0 veya bilinmeyen maç sayısı pozitif sayı yapılmaz; kaydın kanıtı ayrı tutulur. Kiralık gidenler, akademi ve rezerv listeleri güncel A takım listesinin parçası sayılmaz.
- MediaWiki yönlendirmeleri ve farklı takım adları Wikidata kimliğine bağlanır. Futbol/soccer biyografi şablonları desteklenir. Millî takım veya FIFA kadro bayrağı kullanılır; vatandaşlık tahmin edilmez. Deniz Gül’ün yetişkin millî takımı Türkiye olarak düzeltilmiştir.
- Güncel veri, kaynak başlıkları ve revizyon kimlikleri src/data/football-season.json dosyasında tutulur. Kontrolün en eski kaynak zamanı: 2026-10-20T01:05:04.249Z.
- 78 otomatik test başarılı; güncel havuzla 2.000 yeni tahta çözülebildi. Cloudflare dry-run başarılı, sıkıştırılmış Worker yaklaşık 1,42 MiB. Bu kontroller canlıya yayın yapmadı.
- Dört tarayıcıyla LoL’ün beş modu, gerçek 30 saniye alarmı, 2–0 seri, mobil düzen ve Futbol XOX’a geçiş tekrar doğrulandı.

## Sürüm 2026.10.20.7 — iki eksende Türk takımı ve Süper Lig modu

- Takım × Takım: sol eksende %90, üst eksende bağımsız %70 Türk takımı. Her eksende dört büyük grubunun seçilme ihtimali %95 olarak korunur. Sol ve üst aynı takımı kullanamaz. Kura bayrakları ve tercih grupları çözülebilirlik aramasında yeniden çekilmez.
- 1.000 karma tahta örneğinde 895 sol Türk, 686 üst Türk, 612 iki eksende Türk ve 791 ilk 30 profili çıktı. Takım × Ülke örneğinde üst Türk oranı 904/1.000 idi. 100 kura biletinin tamamında %90/%70/%80/%95 sınırları ayrıca tam olarak kontrol edildi.
- 500 Sadece Süper Lig tahtasının tamamı altı farklı Türk kulübünden oluştu ve dokuz farklı cevapla çözüldü. Elle yabancı kulüp gönderimi ve eksenler arasında aynı kulüp tekrarı sunucuda reddedildi. Bütün Türk/yabancı bayrak ve büyük/diğer grup kombinasyonları test edildi.
- 79 test başarılı, 0 başarısız. Cloudflare dry-run başarılı. Canlıya yayın yapılmadı.

- Dört gerçek tarayıcı oturumunda Sadece Süper Lig düğmesi, altı yerli başlık, her seçim kutusunda 18 kulüp, sonraki tahtada ve yeni seride modun korunması doğrulandı. Gerçek 30 saniye alarmı, 2–0 seri bitişi ve mobil taşma kontrolü geçti; JavaScript hatası yoktu.

## Sürüm 2026.10.21.1 — Kimim Ben?

- Menüde ayrı altıncı oyun; Ünlüler 103, Meslekler 72, Karışık 175 kart. Tekrarsız atama, 2–8 kişi, geçersiz kategori ve asgari katılım kontrol edildi.
- Ortak oda/game durumunda cevap yok. Kişiye özel WebSocket verisinde kendi çözülmemiş kartı null, diğer kartlar açık. Katılma ve yeniden katılma mesajları da kendi kartını sızdırmıyor.
- Doğru cevap, kısa ad/Türkçe aksan desteği, boş/yanlış tahmin, sıra geçişi, eski tur/sıra paketleri, eşzamanlı çift tahmin, izleyici engelleri, çevrimdışı oyuncuyu geçme, cevapları açma ve sonraki tur kontrol edildi.
- test/browser-whoami.mjs dört ayrı gerçek Chrome oturumuyla menü/kategori seçimini, ham gelen WebSocket paketlerinde gizliliği, yeniden katılımı, yanlış ve dört doğru tahmini, Meslekler/Karışık turlarını, pası, erken bitişi, menüye dönüşü ve 390 px mobil taşmayı doğruladı. JavaScript hatası yoktu.
- 88 test başarılı, 0 başarısız. Cloudflare dry-run başarılı. Bu sürüm canlıya yayımlanmadı.

## Sürüm 2026.10.21.2 — Tabu

- Ayrı yedinci oyun, 300 özgün Türkçe kart; her kartta beş farklı yasaklı kelime. Tekrarsız karıştırma ve deste bittiğinde yeni döngü test edildi.
- 4–8 oyuncu, otomatik takım dağılımı, takım değişimi, her takımda en az iki kişi şartı. Her takıma üç 60 saniyelik anlatım, takım ve anlatıcı rotasyonu, toplam puan ve maç bitişi kontrol edildi.
- Doğru +1, tabu −1, üç ücretsiz pas, dördüncü pasın reddi, eski kart/sıra/maç paketleri ve eşzamanlı çift puanlama engeli doğrulandı.
- Kart başlamadan, tahmincilere veya izleyicilere gönderilmez. Sadece anlatıcı ve karşı takımdaki hakem güncel kartı alır. Ortak oda/oyun durumu ve katılma mesajları desteyi/cevabı sızdırmaz.
- Anlatıcı ve hakem bağlantı kesintisinde uygun takımdan devralınabilir; yeniden katılım süreyi sıfırlamaz. Süresi dolmuş kart puan getirmez; alarm idempotenttir.
- test/browser-tabu.mjs dört gerçek Chrome oturumunda menü, takım seçimi, kart gizliliği, +1/−1 puanlar, üç pas sınırı, yeniden katılım, mobil düzen, gerçek 60 saniyelik sunucu alarmı, tur sonucu ve diğer takıma geçişi doğruladı. JavaScript hatası yoktu.
- 99 test başarılı, 0 başarısız. Cloudflare dry-run başarılı. Henüz canlıya yayımlanmadı.

## Sürüm 2026.10.21.3 — Tema, XOX sıra sesi ve lobi keşfi

- 104 birim/entegrasyon testi başarılı. Yeni beş test: özel/boş odaların gizlenmesi, gizli bilgilerin listeden dışlanması, 90 saniyelik kaydın süresinin dolması/yenilenmesi, eşzamanlı kayıtların korunması, katılım/ayrılma/bağlantı kapanması ve kimliksiz heartbeat reddi.
- `test/browser-preferences.mjs`: kurulu Chrome ile dört bağımsız tarayıcı oturumunda gerçek WebSocket akışı. Özel oda listelenmedi; açık oda listelendi; tıklama kodu doldurdu; yanlış şifre reddedildi; doğru şifreyle katılım ve oyuncu sayısı doğrulandı. Son oyuncu ayrılınca oda kaldırıldı.
- İki XOX'te de gerçek WebAudio osilatörleri izlenerek ilk sıra ve pas sonrası yalnızca sırası gelen takımda ses üretildiği, aynı sıra mesajının tekrar ses üretmediği ve sessizde ses oluşturulmadığı doğrulandı. Fiziksel hoparlör çıkışı ölçülmedi.
- Siyah, beyaz ve mavi renk seçimleri sayfa yenilemesinden sonra korundu; başka tarayıcıların rengi etkilenmedi. 390 px mobil ekran görüntüsü incelendi; yatay taşma ve JavaScript hatası yok.
- Yerel geliştirme ve dry-run için geçici `.cache/wrangler-ui.toml` kullanıldı; yalnızca veri yenileme adımı atlandı, üretim yapılandırmasında otomatik veri güncellemesi korunuyor. Canlıya yayın yapılmadı.

## Sürüm 2026.10.21.4 — Hava Hokeyi

- Hava Hokeyi menüye ve oyun API'lerine eklendi. İki oyuncu, izleyiciler, taraf seçimi, 10 golle bitiş, sunucu fiziği ve bağlantı kopunca duraklatma uygulandı.
- Önceki sürümün 104 test sonucu bu oyunu kapsamıyor. Bu değişiklik için yeni otomatik test veya tarayıcı oyun testi çalıştırılmadı. JavaScript sözdizimi ve dağıtım paketi derlemesi kontrol edildi.
- Yerel dry-run, veri dosyalarını yeniden indirmeyen geçici yapılandırmayla yapıldı. Üretimde mevcut veri güncelleme komutu korunuyor. Canlıya yayın yapılmadı.

## Sürüm 2026.10.21.5 — LoL İngilizce adlar ve hokey dengesi

- LoL veri dosyasındaki 74 özellik mevcut kaynak çeviri eşleştirmelerinden İngilizce adlarla zenginleştirildi; şampiyonlar, üyelikler ve kaynak tarihleri değiştirilmedi. Güncelleme betiği gelecekte de İngilizce adları kaydeder.
- Hokey kontrolü göreli sürüklemeye alındı; hız, hızlanma, servis ve vuruş aktarımı yumuşatıldı. İstemci raket tahmini kaldırıldı; görünür kenarlar sunucudaki yarıçaplarla eşlendi ve fizik alt adımı sıklaştırıldı.
- Bu sürümde yeni otomatik test veya tarayıcı oyun testi çalıştırılmadı. Sözdizimi ve paket derlemesi kontrol edildi; oynanış hissi gerçek oyuncularla değerlendirilmedi. Önceki sürüm test sonuçları yeni hokey dengesini kapsamıyor.
- Dry-run yerel geçici yapılandırmayla veri yenilemeden yapıldı; üretimdeki veri güncelleme komutu korunuyor. Canlıya yayın yapılmadı.

## Sürüm 2026.10.21.6 — XOX renk ayrımı ve modern görünüm

- Sabit X=sarı, O=mavi eşlemesi kaldırıldı. İki XOX'te kişisel takım kimliğinden ana/karşıt renkler üretilir; hücreler ve takım etiketleri aynı değişkenleri kullanır. Yakın nötr tonlarda ayrıştırıcı alternatif vardır.
- Tasarım önizlemeleri 1440 px masaüstü ve 390 px mobilde incelendi: giriş, oyun menüsü ve örnek XOX renk yerleşimi. Mavi tercihli O takımının mavi, X rakibin sarı gösterildiği örnek yerleşim incelendi. Önizlemedeki isimler/hamleler temsilidir; gerçek bir maç kaydı değildir.
- Yeni otomatik test veya gerçek çok oyunculu maç testi çalıştırılmadı. Önceki 104 test sonucu bu sürüm için yeniden çalıştırılmadı. JavaScript sözdizimi ve dağıtım derlemesi kontrol edildi.
- Dry-run yerel geçici yapılandırmayla veri yenilemeden yapıldı. Üretimdeki veri güncelleme komutu korunuyor. Canlıya yayın yapılmadı.

## Sürüm 2026.10.21.7 — Amiral Battı, bilgi düelloları, Bayrak Yarışı

- Menü/API oyun listesi 12 seçeneğe çıktı: yeni Amiral Battı, Futbol Bilgi Düellosu, LoL Bilgi Düellosu ve Bayrak Yarışı kartları eklendi.
- Amiral Battı için özel filo mesajları, sunucu yerleştirme/atış doğrulaması, 30 saniye, sıra, batırma, üç ardışık zaman aşımı ve bağlantıda duraklatma uygulandı. Quiz/bayrakta ortak soru, kilitli cevap, gizli cevap anahtarı, sunucu süre/puanı, otomatik tur ve final sonuçları uygulandı.
- 121 bayrak SVG'si flag-icons MIT kaynağından sabit Git revizyonuyla indirildi ve tek JSON verisine paketlendi. Kaynak ve lisans paket içinde. Tekil ara SVG dosyaları .cache altında arşivlendi; dağıtım dosyalarına dahil değil.
- JavaScript sözdizimi ve Cloudflare dry-run derlemesi başarılı. Dry-run yerel geçici yapılandırmayla veri yenilemeden yapıldı; üretimde mevcut otomatik futbol/LoL veri güncellemesi korunuyor.
- Örnek durumlarla masaüstü/mobil filo yerleştirme, atış tahtası, LoL soru, bayrak soru ve menü önizlemeleri incelendi. Önizlemedeki hamle/puan/soru verileri temsilidir; gerçek çok oyunculu maç doğrulaması değildir.
- Bu sürüm için yeni otomatik test veya gerçek WebSocket oyun testi çalıştırılmadı. Önceki sürümlerin test sayıları bu dört yeni oyunu kapsamıyor. Canlıya yayın yapılmadı.

## Sürüm 2026.10.21.8 — Bayrakta ülke arama ve 30 saniye

- Bayrak oyunu dört seçenek yerine ülke kataloğundan yazıp seçmeye geçti. Cevap ülke koduyla sunucuda doğrulanır; seçim kilidi, ortak soru ve süre/puan kuralları korunur. Futbol/LoL bilgi düelloları çoktan seçmeli kalır.
- Bayrak soru verisinde seçenek veya doğru ülke kodu oyun sırasında yayınlanmaz. Doğru ülke adı yalnızca ortak sonuçta gönderilir. Eski çoktan seçmeli Bayrak Yarışı kayıtları güvenli biçimde oyun menüsüne döner.
- Süre 30 saniyedir. Arama Türkçe karakterleri normalleştirir, yaygın ülke takma adlarını destekler; yön tuşları/Enter ve dokunma/tıklama kullanılabilir. Diğer oyunculardan güncelleme gelince arama metni/odak korunur.
- Masaüstü ve 390 px mobilde örnek tur durumuyla arama ekranı önizlendi. Temsilî bayrak kullanıldı; gerçek çok oyunculu maç testi veya yeni otomatik test çalıştırılmadı. Sözdizimi ve Cloudflare dry-run derlemesi kontrol edildi. Canlıya yayın yapılmadı.

## Sürüm 2026.10.21.9 — Hokey fare kontrolü

- Fare hareketinde basılı tutma zorunluluğu kaldırıldı. Raket hedefi doğrudan masa üzerindeki imleç konumundan alınır; eski göreli kontrol kazancı kullanılmaz. Küçük titreşim filtresi, mobil dokunma/sürükleme ve klavye kontrolü korunur.
- `src/hockey.js` değiştirilmedi; sunucu çarpışma ve hareket fiziği aynıdır.
- JavaScript sözdizimi ve Cloudflare dry-run derlemesi kontrol edildi. Yeni otomatik test veya gerçek maç testi çalıştırılmadı. Canlıya yayın yapılmadı.

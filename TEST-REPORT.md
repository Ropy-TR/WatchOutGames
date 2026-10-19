# Oyun kontrol raporu

20 Ekim 2026 — yerel proje, Cloudflare Wrangler çalışma ortamı.

## Sonuç

- `npm test`: **50 test başarılı, 0 başarısız**.
- `test/browser-games.mjs`: kurulu Chrome ve dört bağımsız tarayıcı oturumuyla tüm senaryolar başarılı; gerçek WebSocket bağlantıları kullanıldı. Tarayıcı JavaScript hatası görülmedi. 390 px mobil ekranda yatay taşma kontrolü geçti.
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

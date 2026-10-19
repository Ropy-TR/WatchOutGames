# WatchOut Games

Oda kodu ve şifresiyle oynanan mini oyun sitesi. Arayüz Cloudflare Workers static assets ile sunulur; Durable Objects odaların ve WebSocket bağlantılarının canlı durumunu tutar.

## Yerelde çalıştırma

```sh
npm install
npm run dev
```

## Cloudflare'a yayınlama

1. Cloudflare hesabında oturum aç: `npx wrangler login`
2. `wrangler.toml` içindeki `name` değerini hesabında kullanacağın benzersiz Worker adına göre değiştir.
3. `npm run deploy` komutunu çalıştır.
4. Cloudflare'ın verdiği `*.workers.dev` adresini kullan veya Cloudflare panelinden kendi alan adını bağla.

Worker, Pages static assets ayarını kullanır ve Durable Object için ilk SQLite migration'ını `wrangler.toml` içinde tanımlar. Git entegrasyonuyla Pages projesi olarak değil Worker olarak yayınlanır; `workers.dev` adresi bu yapı için Pages kurulumu gerektirmez.

## Oyunlar

- **Spyfall:** 12 kategori; her kategoride 40–71 aday. Mekânlar, ülkeler, spor dalları, hayvanlar, futbol takımları, futbolcular, meslekler, yiyecekler, eşyalar, ulaşım araçları, bilim/teknoloji ve sanat/eğlence. Tam aday listesi casus ve masumlarda aynıdır; masumlar seçili cevabı, casus yalnızca kendi rolünü görür. 3–8 oyuncu, 8 dakika. Her turda bağımsız, kriptografik güvenli ve modulo yanlılığı olmayan kura; aynı kişi art arda casus olabilir. Soru sorma ve tartışma arkadaşların sesli iletişimiyle yürür. Turun ortasında katılan oyuncu sonraki tura kadar izleyicidir.
- **Codenames:** En az 4 oyuncu, iki takım; her takımda bir anlatıcı ve en az bir tahminci seçilir. 1.295 özgün havuz kelimesinden tekrarsız 25 kart seçilir. İki anlatıcı aynı gizli anahtarı görür; tahmincilere yalnızca açılan kartların rengi gönderilir. İlk başlayan takım 9, diğeri 8 ajanı bulur. Anlatıcı tek kelime ve sayı girer; sayı + 1 tahmin hakkı vardır (0, sınırsız tahmin). Yanlış renk/nötr kart sırayı geçirir; suikastçı anında kaybettirir. En az bir tahminden sonra sıra bitirilebilir. Anlatıcılar kart seçemez; diğer takım sırası dışında hamle yapamaz. İpucunun anlamsal uygunluğunu oyuncular değerlendirir. Temel kurallar: [CGE](https://www.czechgames.com/games/codenames-2015).
- **İsim Şehir:** Türkçe harfler, 8 kategori, 90 saniye. Taslaklar yazarken sunucuya kaydedilir; süre dolunca gönderilmeyen taslaklar da değerlendirilir. Cevaplar oyuncu kimliğiyle tutulur ve tur bitene kadar diğer oyunculardan gizlenir. Herkes gönderirse tur erken biter; gönderilen cevap değiştirilemez. Yanlış harf/boş cevap 0, aynı cevap 5, farklı cevap 10 puandır. Sözcüğün gerçekten o kategoriye ait olması otomatik sözlükle doğrulanmaz: sonuç tablosunda cevap üzerine dokunularak geçersiz sayılır; puanlar yeniden hesaplanır.
- **Futbol XOX:** En az 2 oyuncu; katılım sırasına göre dönüşümlü X/O takımları (4–5 kişi de iki takımda oynar). Başlayan takım rastgele belirlenir. Her hamle 30 saniyedir; doğru cevap hücreyi takıma kazandırır ve sıra değişir. Yanlış/tekrar futbolcu, pas veya süre aşımı sırayı geçirir. Sekiz yatay/dikey/çapraz çizgiden birinde üç hücre kazandırır; dolu tahtada üçlü yoksa beraberliktir. Biten oyuna hamle yapılamaz. Wikidata takım × takım veya takım × ülke doğrulaması sunucudadır; dokuz farklı cevabı bulunan tahtalar üretilir. Boş odalarda 30 saniyelik tekrarlı alarmlar durdurulur.

Tahtada boş hücre kalsa da kullanılmamış geçerli futbolcu kalmazsa XOX beraberlikle biter.

### Maçlar ve toplam skor

**Spyfall:** Maçtaki oyuncuların bireysel puanı turdan tura korunur. Bir veya daha fazla oyuncu 10 puana ulaşınca maç biter; birlikte eşiğe ulaşanlar ortak kazanan olur. Sonraki tur sadece sonuç ekranından açılır ve kura yeniden, önceki rollerden bağımsız çekilir. Yeni maç puanları sıfırlar.

| Tur sonucu | Puan |
|---|---|
| Oylamayla masum suçlanır | Casusa +2 |
| Casus kendi başlattığı tahminde doğru cevabı bulur | Casusa +2 |
| Casus oylamada bulunur ve son tahmininde doğru cevabı bulur | Casusa +1 |
| Casus yanlış tahmin eder veya tahmin süresini geçirir | Her masuma +2 |
| Tur süresi sonunda oylamada çoğunluk oluşmaz | Casusa +2 |

Herkes oylama başlatabilir; tur katılımcıları bir kez oy verir. Salt çoğunluk gerekir (4 kişide 3 oy). Çoğunluk erken oluşursa sonuç hemen uygulanır; aksi halde oylama 30 saniye sürer. Eşitlik veya yeterli oy olmaması, tur süresi kaldıysa oyunu devam ettirir. 8 dakika bitince son oylama açılır. Yakalanan casusa doğru cevap açıklanmadan 30 saniyelik son tahmin hakkı tanınır; yalnızca casus tahmin gönderebilir. Casusun kendi tahmini de 30 saniyedir. Sonraki tura maçın bütün oyuncuları bağlıyken geçilir; maç ortasında gelenler izleyicidir.

**Futbol XOX:** Best of 3 seri; ilk 2 galibiyeti alan takım kazanır (2–0 veya 2–1). Beraberlik galibiyet yazmaz; skor ve takımlar korunarak tahta tekrar oynanır. Sonraki tahtada aynı takımlar kalır ve yeni eşleşmeler üretilir. Başlayan takım ilk tahtada rastgeledir; sonraki tahtaya önceki turu bitiren takımın karşısı başlar. Skoru olan veya hamle yapılmış bir seride takım/ülke seçimleri değiştirilerek tahta sıfırlanamaz. Yeni seri, biten seriden sonra skoru sıfırlar.

**İsim Şehir:** Aynı oyuncularla 5 farklı harfte 5 tur oynanır. Tur puanları üstteki toplam skora eklenir. Geçersiz cevap değerlendirmesi mevcut turun toplamını günceller; sonraki tura geçildiğinde önceki turun puanı sabitlenir. Beşinci turun sonunda en yüksek toplam kazanır; eşitlikte ortak kazananlar gösterilir. Yeni maç sıfırdan başlar.

Maç ve seri puanları oda verisiyle birlikte Durable Object'ta saklanır; bağlantının yenilenmesi puanları sıfırlamaz. Oyun menüsüne dönmek devam eden maçı kapatır. Codenames tek oyun olarak devam eder.

### Kontroller

`npm test`: oyun kuralları, özel rol görünürlüğü, eşzamanlı hamleler, yeniden bağlanma, süre sınırları, veri ve görsel güvenliği için otomatik testler. Yerel Wrangler çalışırken `node test/browser-games.mjs`, mevcut Playwright ve Chrome ile dört bağımsız tarayıcı oturumunu gerçek WebSocket'ler üzerinden oynatır (Playwright bu projeye bağımlılık olarak eklenmez). `node test/live-city-clock.mjs`, gerçek 90 saniyelik Durable Object alarmını ve taslak/sonuç akışını kontrol eder. Tarayıcı testi gerçek 30 saniyelik XOX alarmını bekler. Bu kontroller canlı Cloudflare yayınına dağıtım yapmaz.

Bağlantı yenilendiğinde oda kodu/şifresiyle tekrar katılmak aynı tarayıcıdaki özel oturum anahtarı sayesinde rolü ve cevapları korur. Açık oyuncu kimliği başka oyuncunun oturumunu devralmak için yeterli değildir. Açıkça odadan çıkmak oturumu sonlandırır. Eski sürümdeki devam eden oyunlar yeni kurallarla uyumsuzsa oyun menüsüne sıfırlanır.

## Wikidata

Veri dosyası `src/data/football.json` içinde projeyle birlikte gelir. API anahtarı veya kullanıcı hesabı gerekmez. Oyun sırasında Wikidata'ya istek gönderilmez. `/api/football` küçük lig/takım kataloğunu, `/api/football/search?q=...` ise sunucuda aranan en fazla 35 futbolcuyu sunar; tarayıcı bütün futbolcu havuzunu indirmez.

Kulüp kapsamı 2026–27 sezonundaki 200 takımdır: Premier League, Serie A, La Liga, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, Belçika Pro League, Yunanistan Super League, Polonya Ekstraklasa ve Süper Lig. Türkiye dışındaki ilk 10 Avrupa ülkesi + Türkiye seçimi 15 Ekim 2026 UEFA ülke sıralaması görünümüne dayanır. Seçim ve sezon kaynakları `scripts/football-leagues.json` içinde tutulur. Takım listeleri sezon sayfalarının kulüp/stadyum tablolarından çıkarılır, Wikipedia yönlendirmeleri çözülerek Wikidata kimliklerine bağlanır. Oyuncu geçmişleri Wikidata'dan alınır.

Sezonun kulüp listesini yeniden almak için `npm run clubs:update`, ardından oyuncu havuzunu almak için `npm run data:update` çalıştırılır. Lig/sezon seçimi `scripts/football-leagues.json` dosyasında değiştirilir. Katalog değiştiğinde, veri 24 saatten yeni olsa da bir sonraki build oyuncu verisini yeniden alır. İsim ve alternatif yazılışlar 30 gün önbellekte tutulur; kulüp geçmişleri her veri yenilemesinde yeniden sorgulanır.

Cloudflare'a her yayınlamada Wrangler'ın build adımı `scripts/update-football.mjs` dosyasını çalıştırır. Veri 24 saatten yeniyse mevcut dosya kullanılır. Daha eskiyse yenilenir; Wikidata erişilemiyorsa son sağlam dosyayla yayınlama devam eder ve build loguna eski verinin tarihi yazılır. Yenileme kendiliğinden günlük çalışmaz; bir sonraki deployment sırasında yapılır.

Elle yenilemek için `npm run data:update` kullanılabilir. Bilgisayara araç kurmadan yayınlamak için GitHub deposunu Cloudflare Workers'a bağlayıp deploy komutunu `npx wrangler deploy` bırakmak yeterlidir. Depoda `scripts`, `src/data`, `src/football.js` ve güncel `wrangler.toml` bulunmalıdır.

Kaynak: [Wikidata](https://www.wikidata.org/), [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing). Kulüpler `scripts/football-clubs.json` içinde Wikidata kimlikleriyle tanımlıdır. Futbol mesleği (`P106`) veya futbol branşı (`P641`) bulunan kişiler alınır. Import işlemi yalnızca bu A takım kimliklerine ait, kullanımdan kaldırılmamış `P54` üyeliklerinde pozitif `P1350` maç sayısı olan kayıtları alır. Genç ve rezerv takım kimlikleri dahil edilmez. Spor ülkesi `P1532` alanından alınır; vatandaşlık (`P27`) spor ülkesi yerine kullanılmaz.

Bu filtreler kapsamı daraltır: maç sayısı Wikidata'da eksik olan geçerli futbolcular kabul edilmeyebilir. Bazı kayıtlar eski veya hatalı olabilir. Hiç maç sayılı kaydı bulunmayan kulüpler `clubsWithoutMatchData` alanında listelenir ve çözülebilen rastgele tahtalarda yer alamaz. `fetchedAt` içe aktarılan en eski önbellek yanıtının zamanını belirtir; tüm futbolcuların transferlerinin o tarihte eksiksiz doğrulandığı anlamına gelmez. Her futbolcunun Wikidata kimliği ve maç sayılı üyelik kayıtları veri dosyasında korunur.

## Takım logoları ve futbolcu fotoğrafları

Futbol XOX başlıklarında logolar, cevaplanan hücrelerde futbolcu fotoğrafları gösterilir. `/api/football/media?ids=...` en fazla 8 katalog kimliği için Wikidata'daki `P154` (logo) veya `P18` (fotoğraf) kaydını bulur. Wikimedia Commons Imageinfo API'si küçük resim adresini ve kaynak/lisans bilgisini verir. Tarayıcı görseli doğrudan Wikimedia'nın `upload.wikimedia.org` / `thumb.wikimedia.org` adresinden alır; Worker görsel dosyasını indirmez veya proxy etmez.

Yalnızca kamu malı, CC0, CC BY ve CC BY-SA olarak işaretli Commons dosyaları kullanılır. HTML metadata düz metne dönüştürülür, kaynak ve lisans bağlantıları oyundaki kapalı `Görsel kaynakları` alanında sunulur. Wikipedia'nın fair-use görselleri alınmaz. Her kulüpte kullanılabilir `P154` kaydı bulunmayabilir; bu durumda isim kalır. Fotoğraflar arama listesindeki her aday için değil, yalnızca seçilen futbolcular için istenir.

Cloudflare Cache API sadece görsel URL'si/yazar/lisans gibi JSON metadatasını 7 gün önbellekler; bulunamayan kayıtlar 1 gün saklanır. Geçici servis hataları kalıcı bir eksik görsel olarak önbelleğe yazılmaz. Görsel bulunmaması veya yüklenememesi oyunu engellemez. Yeni anahtar, ücretli servis ya da ek Cloudflare binding'i gerekmez.

Oda parolası Durable Object'ın sakladığı oda kaydında yer alır. Gerçek kişisel veriler veya hesaplar gerekmiyor.

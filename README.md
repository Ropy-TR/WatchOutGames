# WatchOut Games

Oda kodu ve şifresiyle oynanan mini oyun sitesi. Arayüz Cloudflare Workers static assets ile sunulur; Durable Objects odaların ve WebSocket bağlantılarının canlı durumunu tutar.

## Kurulum yapmadan GitHub ile yayınlama

Güncel ZIP dosyasını açıp içindeki `public`, `src`, `scripts`, `test` klasörlerini ve kökteki dosyaları GitHub reposunun köküne yükle. ZIP dosyasını doğrudan yükleme; klasörlerin içeriklerini koru. Cloudflare Worker projesinde bağlı repo ve üretim dalını kontrol et, dağıtım komutu `npx wrangler deploy` olsun. Yeni commit otomatik dağıtılır. Build logunda `WatchOut Games 2026.10.21.7` görünmeli. Yayın sonrası `/api/version` adresi `2026.10.21.7` ve oyun listesinde `hockey` döndürmeli.

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
- **LoL XOX:** Güncel Riot Data Dragon listesindeki 173 şampiyon (16.20.1). Karışık, Bölge × Koridor, Tür × Koridor, Bölge × Sınıf ve Köken × Koridor modları. İki özelliğe de uyan şampiyon seçilir. Futbol XOX ile aynı 30 saniye, sırayla oynama, tekrarlanmayan cevap, üçlüyle kazanma ve best of 3 seri kuralları geçerlidir. Cevaplar sunucuda doğrulanır; her yeni tahta dokuz farklı geçerli şampiyonla tamamlanabilmelidir.

Tahtada boş hücre kalsa da kullanılmamış geçerli futbolcu kalmazsa XOX beraberlikle biter.

Futbol XOX kataloğu 65 kulüple sınırlıdır: Süper Lig listesinde bulunan 18 takım; İngiltere, İspanya, Almanya, İtalya ve Fransa’dan altışar bilindik büyük kulüp; Hollanda’dan Ajax/PSV/Feyenoord, Portekiz’den Benfica/Porto/Sporting, Belçika’dan Anderlecht/Club Brugge/Genk, Yunanistan’dan Olympiacos/Panathinaikos/AEK/PAOK, Polonya’dan Legia/Lech; ayrıca Flamengo ve Bodø/Glimt. Altılılar bilinirlik seçimidir; güncel puan tablosundaki ilk altı anlamına gelmez. Eski 202 kulüplük kariyer arşivi sunucuda veri kaynağı olarak korunur; rastgele ve elle seçilen tahtalar yalnızca bu 65 kulübü kabul eder. %80 ilk 30 önceliği bu izinli listeyle kesiştirilir, çıkarılmış takımları geri getiremez. Takım × Takım’da sol eksene %90, üst eksene bağımsız %70 Türk takımı eklenir; her eksende dört büyük önceliği %95’tir. Diğer %5 bütün diğer Süper Lig kulüplerine açıktır. Wikidata kariyer kesişimi olmayan kulüpler elle seçimde kalır; rastgele tahtada aynı gruptan çözülebilen bir alternatif seçilir. Her tahtanın dokuz farklı cevabı bulunmalıdır.

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

Tarihî arşiv kapsamı 2026–27 sezonu listelerinden 202 kulüptür; oynanabilir katalog yukarıdaki 65 kulüple sınırlıdır. Arşiv ligleri: Premier League, Serie A, La Liga, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, Belçika Pro League, Yunanistan Super League, Polonya Ekstraklasa ve Süper Lig. Türkiye dışındaki ilk 10 Avrupa ülkesi + Türkiye seçimi 15 Ekim 2026 UEFA ülke sıralaması görünümüne dayanır. Seçim ve sezon kaynakları `scripts/football-leagues.json` içinde tutulur. Takım listeleri sezon sayfalarının kulüp/stadyum tablolarından çıkarılır, Wikipedia yönlendirmeleri çözülerek Wikidata kimliklerine bağlanır. Tarihî arşiv Wikidata’dan, güncel A takım kadroları ve bu oyuncuların kariyerleri Wikipedia MediaWiki API üzerinden alınır.

Sezonun kulüp listesini yeniden almak için `npm run clubs:update`, ardından oyuncu havuzunu almak için `npm run data:update` çalıştırılır. Lig/sezon seçimi `scripts/football-leagues.json` dosyasında değiştirilir. Katalog değiştiğinde, veri 24 saatten yeni olsa da bir sonraki build oyuncu verisini yeniden alır. İsim ve alternatif yazılışlar 30 gün önbellekte tutulur; kulüp geçmişleri her veri yenilemesinde yeniden sorgulanır.

Cloudflare'a her yayınlamada Wrangler'ın build adımı `scripts/update-data.mjs` üzerinden futbol ve LoL veri güncelleyicilerini çalıştırır. Wikidata arşivi ve LoL verisi 24 saatten, sezon kadro eki 24 saatten yeniyse mevcut dosya kullanılır. Daha eskiyse yenilenir; kaynaklara erişilemiyorsa son sağlam dosyayla yayınlama devam eder ve build loguna eski verinin tarihi yazılır. Yenileme kendiliğinden günlük çalışmaz; bir sonraki deployment sırasında yapılır.

Elle yenilemek için `npm run data:update` kullanılabilir. Bilgisayara araç kurmadan yayınlamak için GitHub deposunu Cloudflare Workers'a bağlayıp deploy komutunu `npx wrangler deploy` bırakmak yeterlidir. Depoda `scripts`, `src/data`, `src/football.js` ve güncel `wrangler.toml` bulunmalıdır.

Kaynak: [Wikidata](https://www.wikidata.org/), [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing). Kulüpler `scripts/football-clubs.json` içinde Wikidata kimlikleriyle tanımlıdır. Futbol mesleği (`P106`) veya futbol branşı (`P641`) bulunan kişiler alınır. Import işlemi yalnızca bu A takım kimliklerine ait, kullanımdan kaldırılmamış `P54` üyeliklerinde pozitif `P1350` maç sayısı olan kayıtları alır. Genç ve rezerv takım kimlikleri dahil edilmez. Spor ülkesi `P1532` alanından alınır; vatandaşlık (`P27`) spor ülkesi yerine kullanılmaz.

Bu bölüm yalnızca tarihî Wikidata arşivini açıklar. Güncel oyunculardaki eksik kulüpler ayrıca sezon ekinden tamamlanır; güncel A takım kadro kaydı maç sayısı bulunmasa da yeterlidir. İki kaynak da eksik veya gecikmeli olabilir. Bazı kayıtlar eski veya hatalı olabilir. Hiç maç sayılı kaydı bulunmayan kulüpler `clubsWithoutMatchData` alanında listelenir ve çözülebilen rastgele tahtalarda yer alamaz. `fetchedAt` içe aktarılan en eski önbellek yanıtının zamanını belirtir; tüm futbolcuların transferlerinin o tarihte eksiksiz doğrulandığı anlamına gelmez. Her futbolcunun Wikidata kimliği ve maç sayılı üyelik kayıtları veri dosyasında korunur.

## LoL verileri ve şampiyon görselleri

`src/data/lol.json` tüm şampiyonlar ve özelliklerini içeren küçük bir veri kopyasıdır. Güncel ana liste, Türkçe adlar, sınıflar ve ikon adresleri [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) üzerinden alınır. Koridorlar [LoL Wiki ChampionData](https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data) modülündeki `client_positions` ve `external_positions` listelerinin birleşimidir; anlık oynanma oranı veya her olası off-meta rol değildir. Bölge, köken ve tür bilgileri her şampiyonun Wiki `Universe:` biyografisindeki alanlardan alınır. Her karakterin kaynak sayfası, revizyon numarası ve zamanı veri dosyasında saklanır.

- **Bölge:** Biyografideki güncel bölge ilişkileri. Üzeri çizili eski ilişkiler sayılmaz.
- **Köken:** Doğum/oluşum yerinde açıkça geçen ana bölgeler. Güncel bağlılık yerine kullanılmaz; kaynakta açık değilse tahmin edilmez.
- **Tür:** Güncel ana türler, oynanabilir biçimde üst gruplara dönüştürülür. Örneğin Vesani/Marai/Kiilash → Vastaya, Xer'Sai → Hiçlik Yaratığı. Eski türler ve parantezlerdeki geçmiş/soy notları ana tür sayılmaz. Kaynakta bilinmiyorsa “Türü bilinmiyor” kalır. Birleşik şampiyonlar birlikte değerlendirilir: Nunu ve Willump için hem İnsan hem Yeti geçerlidir. Rastgele başlıkta kullanılabilmek için bir özellik en az üç farklı şampiyona ait olmalıdır; tekil türlerin karakterleri yine diğer özellikleri üzerinden seçilebilir.
- **Sınıf:** Data Dragon `tags` alanındaki birincil/ikincil sınıflar. Koridorla ayrı özelliklerdir.

Veri içe aktarıcı Lua'yı veya Wiki şablonlarını çalıştırmaz; yalnızca gerekli veri alanlarını ayrıştırır. Riot listesinden bir şampiyon Wiki'de eksikse içe aktarım yeni dosya yazmadan hata verir; mevcut dosyayı sessizce eksilterek yayımlamaz. Normal Cloudflare build'i böyle bir durumda son sağlam veriyi korur. `npm run lol:update` elle yeniler; API anahtarı, yeni hesap veya ek paket gerekmez.

Oyun sırasında bilgi doğrulaması bu yerel veri kopyasındadır; her hamlede Wiki'ye istek gönderilmez. `/api/lol` küçük katalog ve şampiyon ad/ikon listesini, `/api/lol/search?q=...` en fazla 35 arama sonucunu sunar. Bu yanıtlarda şampiyonların özellik üyelikleri gönderilmez. İkonlar tarayıcı tarafından doğrudan Riot CDN'inden yüklenir; sunucuda görsel dosyası tutulmaz. Yüklenmeyen görselde isim görünmeye devam eder.

LoL Wiki'den türetilmiş alanlarda çeviri, tür gruplaması ve geçmiş kayıtları çıkarma uygulanmıştır; [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) kaynak/lisans bağlantıları arayüzdeki Kaynaklar alanındadır. Riot görselleri Riot Games'e aittir; bu proje Riot Games tarafından onaylanmış değildir.

Yeniden yayınlamada `public`, `src` (`src/data/lol.json` dahil), `scripts`, `package.json` ve `wrangler.toml` güncel olmalıdır. LoL ve futbol için yeni bir Cloudflare binding'i veya migration gerekmez.

## Takım logoları ve futbolcu fotoğrafları

Futbol XOX başlıklarında logolar, cevaplanan hücrelerde futbolcu fotoğrafları gösterilir. `/api/football/media?ids=...` en fazla 8 katalog kimliği için Wikidata'daki `P154` (logo) veya `P18` (fotoğraf) kaydını bulur. Wikimedia Commons Imageinfo API'si küçük resim adresini ve kaynak/lisans bilgisini verir. Tarayıcı görseli doğrudan Wikimedia'nın `upload.wikimedia.org` / `thumb.wikimedia.org` adresinden alır; Worker görsel dosyasını indirmez veya proxy etmez.

Yalnızca kamu malı, CC0, CC BY ve CC BY-SA olarak işaretli Commons dosyaları kullanılır. HTML metadata düz metne dönüştürülür, kaynak ve lisans bağlantıları oyundaki kapalı `Görsel kaynakları` alanında sunulur. Wikipedia'nın fair-use görselleri alınmaz. Her kulüpte kullanılabilir `P154` kaydı bulunmayabilir; bu durumda isim kalır. Fotoğraflar arama listesindeki her aday için değil, yalnızca seçilen futbolcular için istenir.

Cloudflare Cache API sadece görsel URL'si/yazar/lisans gibi JSON metadatasını 7 gün önbellekler; bulunamayan kayıtlar 1 gün saklanır. Geçici servis hataları kalıcı bir eksik görsel olarak önbelleğe yazılmaz. Görsel bulunmaması veya yüklenememesi oyunu engellemez. Yeni anahtar, ücretli servis ya da ek Cloudflare binding'i gerekmez.

Oda parolası Durable Object'ın sakladığı oda kaydında yer alır. Gerçek kişisel veriler veya hesaplar gerekmiyor.

## Güncel sezon verisi — 2026.10.21.3

`src/data/football-season.json`, seçili 65 kulübün güncel A takım kadrolarını ve oyuncuların kariyerlerini içerir. `src/data/football.json` tarihî arşivdir; uygulama ikisini birleştirir. Yeni sezon için tarihî kulüpler silinmez. Güncel A takım kaydı yeni transferin kabul edilmesi için yeterlidir; maç sayısı 0 veya bilinmiyorsa aynen korunur. Kadroda olmayan tarihî bir kulüp için pozitif A takım maç sayısı gerekir. Aynı isimli genç/yedek takımlar farklı Wikidata kimlikleri olduğu için A takıma dönüştürülmez. Senior millî takım maçları varsa onlar, yoksa kadronun FIFA ülke bayrağı kullanılır; vatandaşlık alanı kullanılmaz.

`npm run season:update` sezon ekini yeniler; `node scripts/update-football-season.mjs --force` API önbelleğini atlayarak tekrar okur. Normal dağıtımda kontrol edilmiş sezon eki 24 saatten eskiyse yenileme denenir. Bu zamanlanmış görev değildir: dağıtım çalıştığında kontrol edilir. Kaynak erişilemezse mevcut doğrulanmış dosya korunur ve build loguna tarihiyle uyarı yazılır. API `/api/football` içindeki `seasonCheckedAt` kadro kontrolünün zamanıdır; her kaynağın bütün transferleri hatasız yayımladığını garanti etmez.

Her kadro ve futbolcu kaydında kaynak sayfası ve Wikipedia revizyon kimliği saklanır; isimsiz maç sayıları veya elle uydurulmuş transferler eklenmez. Wikipedia ek verisi CC BY-SA 4.0, Wikidata arşivi CC0 lisansındadır; oyun ekranındaki kapalı Veri kaynakları alanında atıf bulunur.

## Futbol XOX modları — 2026.10.21.3

Takım × Takım: soldaki üç başlığa tam bir Süper Lig takımı eklenme ihtimali %90, üstteki üç başlığa tam bir Süper Lig takımı eklenme ihtimali bağımsız olarak %70. İki olay birlikte yaklaşık %63 olasılığa sahiptir; her oyun için kota değildir. Her eksenin Türk takımı %95 olasılıkla dört büyük grubundan, %5 olasılıkla diğer Süper Lig kulüplerinden seçilir. Aynı kulüp iki eksende tekrarlanmaz. Sol/üst olasılıkları, dört büyük grubu ve yabancı kulüp havuzu tahta aramasından önce bir kez belirlenir; çözülebilirlik araması bu tercihleri değiştirmez. Yabancı slotlar önceki dar havuz kurallarını korur.

Sadece Süper Lig: iki eksendeki toplam altı farklı kulüp yalnızca Süper Lig listesinden gelir. Elle seçim listesi de 18 yerli kulübe sınırlandırılır. Takım × Ülke modunda üstteki kulüpler için %90 Türk takımı olasılığı korunur; solda ülkeler bulunur. Bütün modlarda dokuz farklı cevap, 30 saniye, sıra ve best of 3 kuralları geçerlidir. Sonraki tahtada ve yeni seride seçili mod korunur.

## Kimim Ben? — 2026.10.21.3

Oyun seç menüsünde ayrı karttır. Kategoriler: Ünlüler (103 bilindik isim), Meslekler (72), Karışık (175). 2–8 katılımcı için tekrarsız kartlar sunucudaki kriptografik kurayla atanır. Her yeni tur bağımsızdır; eski tur kartları kura dışında bırakılmaz.

Herkes diğer katılımcıların kartlarını görür. Kendi cevabı sonuçlar açılana veya kendisi doğru tahmin edene kadar istemciye gönderilmez; ortak oda durumunda hiçbir kart cevabı bulunmaz. Sorular sesli sorulur. Sırası gelen oyuncu tahmin yazar veya pas geçer. Yanlış tahmin sırayı geçirir, doğru tahmin oyuncuyu bulanlar listesine ekler. Türkçe aksan, büyük/küçük harf, noktalama ve tanımlanmış kısa adlar desteklenir. Çevrimdışı oyuncunun sırası diğer katılımcılarca geçilebilir.

Herkes bulunca tur otomatik biter. Katılımcılar Turu bitir düğmesiyle cevapları daha erken de açabilir. Sonuçta kategori seçip sonraki tur başlatılır; yeni katılanlar o turda oyuna dahil edilir. Devam eden tura sonradan gelenler izleyicidir ve tahmin/pas/tur bitirme yapamaz. Geri bağlanan kişi gizli oturum belirteciyle aynı kartını korur.

## Tabu — 2026.10.21.3

Menüde ayrı yedinci oyun. 4–8 kişi, kırmızı/mavi takımlar ve takım başına en az iki oyuncu. Beş kişi otomatik 3–2 bölünür; maçtan önce takım değiştirilebilir. 300 özgün Türkçe kartın her birinde beş yasaklı kelime vardır. Konuşma arkadaşların sesli iletişimiyle yürür; konuşma tanıma veya mikrofon izni kullanılmaz.

Her anlatım 60 saniyedir. Doğru +1, tabu −1; üç pas ücretsizdir, dördüncü pas sunucuda engellenir. Kartı yalnızca anlatıcı ve karşı takımdaki hakem alır. Hakem tabu bildirebilir; doğru ve pas işlemleri anlatıcıdadır. Süre anlatıcının başlatmasıyla sunucuda başlar. Tahminciler, izleyiciler ve hazır bekleyen anlatıcı kartı alamaz.

İki takım sırayla oynar, anlatıcı takım içinde döner. Her takım üç anlatım tamamlayınca toplam puan kazananı belirler; eşitlik beraberliktir. Tur sonucunda kullanılmış kelimeler açılır. Deste bitene kadar kart tekrar etmez; 300 kart tüketilirse deste yeniden güvenli kurayla karıştırılır. Çevrimdışı anlatıcı/hakemi yalnızca uygun takımdaki oyuncu devralabilir. Yeniden bağlantı süreyi sıfırlamaz.

## Tema, sıra sesi ve açık lobiler — 2026.10.21.3

- Üst çubuktaki renk seçici ana vurgu rengini değiştirir; tercih yalnızca o tarayıcıda saklanır. Siyah, beyaz ve koyu renklerde düğme yazısı otomatik siyah/beyaz seçilir; koyu zemin üzerindeki vurgu yazıları okunabilir tona açılır.
- Futbol ve LoL XOX'te sıra takımınıza geldiğinde kısa ses çalar. Üstteki ses düğmesiyle kapatılabilir. Tarayıcı ses izni için sayfada önce dokunmak/tıklamak gerekir; cihazın sessiz modu ve tarayıcı ses engelleri geçerlidir.
- Açık lobiler sekmesi 10 saniyede bir yenilenir. Odaya tıklamak katılım formunu koduyla açar; nickname ve oda şifresi gerekir. Oda oluştururken listede görünmesi kapatılabilir. Daha önce oluşturulmuş odalar otomatik olarak herkese açılmaz.
- Liste yalnızca kod, oyun, çevrimiçi oyuncu sayısı ve doluluk durumunu taşır. Oda boşalınca kaydı kaldırılır; kopmuş bağlantıların kaydı en geç 90 saniyede düşer. Oyuncu isimleri, şifreler ve gizli oyun bilgileri listelenmez.
- Bu sürümde `wrangler.toml` yeni `LOBBIES` binding'ini ve `v2` SQLite migration'ını içerir; dosyayı mutlaka paketin geri kalanıyla yükle. Mevcut `v1` Room migration'ı korunmuştur.

## Hava Hokeyi — 2026.10.21.4

- Oyun seç menüsünde ayrı Hava Hokeyi kartı bulunur. İki oyuncu oynar; diğer lobi üyeleri izler. Hazırlık ekranında oyuncular kendi yerlerini bırakıp boş tarafa geçebilir.
- Herkes kendi kalesini ekranın altında görür. Raketi fareyle, masada parmağını sürükleyerek veya yön/WASD tuşlarıyla kontrol eder. Raket kendi yarı sahasında kalır; disk raketlerden, kenarlardan ve kale direklerinden seker.
- İlk 10 gol atan kazanır. Her golden sonra kısa servis geri sayımı vardır. Maç bitince oyunculardan biri yeni maç açabilir.
- Disk fiziği, raket hız sınırı ve skor sunucuda hesaplanır. İstemci yalnızca kendi raketinin hedefini gönderir; gol veya disk konumu gönderemez.
- Oyunculardan biri koparsa maç duraklar, aynı oturumla döndüğünde skor korunarak devam eder. Odadan bilerek çıkmak oturum anahtarını siler; yeni maç için oyun seçimine dönülür.
- Gerçek zamanlı hareket WebSocket ile aktarılır. Yüksek bağlantı gecikmesi oynanışı etkileyebilir. Yeni binding veya migration gerekmez; mevcut Room kullanılır.

## LoL çift dil ve hokey dengesi — 2026.10.21.5

- Yalnızca LoL XOX'te her özellik başlığında Türkçenin altında parantez içinde kaynak İngilizce adı gösterilir: Suret Taşıyıcısı (Aspect Host), Yükselmiş (Ascended), Hiçlik Yaratığı (Voidborn), vb. Bölge/köken/koridor/sınıf adları da aynı biçimdedir. Mevcut 74 özelliğe kaynak adları eklendi; veri yenileme betiği de İngilizce adları korur. Kaynakların indirilme tarihleri değiştirilmedi.
- Hokeyde kontrol basılı tutup sürükleme şeklindedir. Ekrana dokununca raket aniden imlece sıçramaz; hareket mesafesi %78 oranıyla aktarılır. Yön/WASD tuşları da çalışır; çapraz hareket hız avantajı sağlamaz.
- Raket azami hızı 1.400 → 620 birim/sn, disk azami hızı 1.150 → 820, servis hızı 360 → 290 olarak ayarlandı. Raket hızlanması ve duruşu kademelidir; vuruşta raketten diske aktarılan hız azaltıldı. Yavaş dokunuşlara otomatik hız artışı uygulanmaz; disk tamamen durursa bir saniye sonra küçük bir hareketle açılır.
- Raketin çizilen dış sınırı ve diskin çizilen kenarı fizik yarıçapıyla aynıdır (30/11). Kendi raketi dahil iki raket ve disk aynı sunucu kareleriyle çizilir; önden giden bağımsız raket tahmini kaldırıldı. Fizik alt adımları 1/240 saniyedir.
- 10 gol kuralı korunur. Yeni LoL veri kimliği nedeniyle eski açık LoL tahtaları için yeni seri başlatılmalıdır.

## Kişisel XOX renkleri ve yeni arayüz — 2026.10.21.6

- Futbol ve LoL XOX'te seçtiğiniz vurgu rengi her zaman kendi takımınızı temsil eder. X veya O olmanız fark etmez. Rakip rengin RGB tersi kullanılır; siyah zemin üzerinde okunabilirlik için koyu tonlar açılır. Gri gibi tersinin kendisine çok yakın olduğu renklerde belirgin mavi alternatif kullanılır.
- Takım etiketleri ve doldurulmuş hücreler aynı renkleri taşır. Kendi takımınızın yanında SEN yazar; X/O işaretleri de korunur. Renk seçiciden değişiklik yapınca mevcut tahta anında güncellenir. İzleyicide X ana renk, O karşıt renktir. Bu eşleştirme yalnızca arayüzdedir; takım ve skor verisi değişmez.
- Siyah zeminli yeni giriş ekranı, simgeli oyun kartları, yenilenmiş oyuncu paneli, düğmeler, formlar, oyun alanları ve mobil yerleşim eklendi. Görseller yerel SVG/CSS'tir; haricî yazı tipi veya görsel servisi gerekmez.
- `public/modern.css` ve `public/icons.svg` yeni gerekli dosyalardır; güncellemede public klasörünü tümüyle yükle.

## Amiral Battı — 2026.10.21.7

- Menüde ayrı kart. İki oyuncu taraf seçer; diğerleri izleyebilir. 10 × 10 alana 5, 4, 3, 3 ve 2 karelik gemiler yerleştirilir. Gemiler düz olmalı; çapraz dahil birbirine değemez. Yatay/dikey, rastgele yerleştirme, geri alma ve temizleme vardır.
- Hazırım ile filo kilitlenir. İki oyuncu da hazır olunca ilk oyuncu bağımsız kriptografik kurayla seçilir. Atış başına 30 saniye; isabet/ıskadan sonra sıra değişir. Aynı kareye tekrar atış yapılamaz. Rakibin 17 gemi karesini vuran kazanır.
- Bir oyuncu kendi üç ardışık sırasında süreyi kaçırırsa rakibi kazanır; geçerli atış bu sayacı sıfırlar. Bağlantı kopunca süre durur; aynı oturumla döndüğünde devam eder.
- Oyun sırasında herkese yalnızca atış ve hazırlık durumları gönderilir. Her oyuncu kendi filosunu ayrı özel mesajda alır. Rakip filolar ve izleyiciye açık filolar maç bitene kadar gönderilmez.

## Futbol / LoL Bilgi Düellosu — 2026.10.21.7

- Menüde iki ayrı kart; her biri 1v1. Taraf seçimi ve izleyici desteği vardır. İki oyuncuya aynı sırayla aynı 10 soru ve aynı seçenek dizilimi gelir.
- Her soruya 20 saniye. Cevap bir kez kilitlenir. Herkes cevaplayınca veya süre dolunca doğru cevap ve tur sonuçları açılır. Beş saniye sonra sonraki soru otomatik başlar. Doğruya 1 puan; hız bonusu yoktur. On soru sonunda en yüksek puan kazanır; eşitlik beraberedir.
- Futbol soruları mevcut Wikidata arşivindeki tanınmış oyuncuların ülke ve pozitif A takım maç kaydı bulunan kulüp bilgileriyle hazırlanır. Yeni transfer ezberi veya canlı kadro sorusu değildir. LoL soruları mevcut 173 şampiyonun bölge, köken, tür grubu, koridor ve sınıf kayıtlarından üretilir; İngilizce özellik adları gösterilir.
- Aynı sorudaki diğer geçerli özellikler yanlış seçenek yapılmaz. Cevap anahtarı ve sonraki sorular oyunculara gönderilmez. Kişi yalnızca kendi seçimini görür; rakibin seçimi ortak sonuç açılınca görünür. Sunucu süre ve puanı doğrular.

## Bayrak Yarışı — 2026.10.21.7

- 2–8 kişi, ayrı oyun kartı. Maç başladığında bağlı olanlar katılır; sonradan gelenler izler. 121 ülke arasından maçta tekrarlamayan 15 bayrak seçilir. Herkes aynı bayrağı ve aynı dört ülke seçeneğini görür.
- Tur başına 15 saniye. Yanlış cevap ve cevapsız süre aşımı birer yanlış sayılır. Her tur sonunda doğru cevap, herkesin sonucu ve toplamlar görünür; beş saniye sonra devam eder. En az yanlış yapan kazanır; en çok yanlış yapanlar sonuçta ayrıca gösterilir. Eşitlikler paylaşılır; herkes aynı sayıda yanlış yaptıysa beraberedir.
- Oyun başladıktan sonra bağlantısı kesilen kişinin cevapsız turları yanlış sayılır. Oturumuyla dönerse mevcut sorudan devam edebilir. Bağlantı kesmek süreyi uzatmaz.
- Bayraklar `src/data/flags.json` içinde paketlidir; dış görsel servisi gerekmez. Kaynak: flag-icons (MIT), sürüm bilgisi `src/data/flags-source.json`, lisans `public/flags-LICENSE.txt`. İsteğe bağlı yenileme: `npm run flags:update`; otomatik deploy adımı bayrakları indirmez.
- Oyun ekranındaki bayrak isteği ülke kodunu içermez. Güncel oda/maç/tur kimliğiyle sunucudan sadece o turun SVG görseli gönderilir.

Bu dört kart mevcut Room binding'ini kullanır; yeni Cloudflare binding veya migration gerekmez. Güncel ZIP'in tamamı yüklenmelidir; `src/data/flags.json`, `public/table-games.js` ve `public/table-games.css` özellikle gereklidir.

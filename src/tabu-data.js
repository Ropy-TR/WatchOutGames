// Original Turkish association cards, authored for this game.
const rows = `
Telefon|Aramak,Konuşmak,Numara,Cep,Mesaj
Bilgisayar|Klavye,Ekran,Mouse,İnternet,Program
Televizyon|Kumanda,Kanal,Dizi,Ekran,İzlemek
Buzdolabı|Soğuk,Mutfak,Yiyecek,Dondurucu,Saklamak
Çamaşır Makinesi|Deterjan,Kirli,Yıkamak,Kıyafet,Sıkmak
Bulaşık Makinesi|Tabak,Bardak,Deterjan,Yıkamak,Mutfak
Elektrik Süpürgesi|Toz,Temizlemek,Halı,Çekmek,Torba
Ütü|Kırışık,Kıyafet,Sıcak,Buhar,Düzeltmek
Fırın|Pişirmek,Mutfak,Sıcak,Tepsi,Kek
Mikrodalga|Isıtmak,Yemek,Mutfak,Dakika,Fırın
Klima|Sıcak,Soğuk,Yaz,Serinlemek,Kumanda
Vantilatör|Pervane,Rüzgar,Yaz,Serinlemek,Dönmek
Saç Kurutma Makinesi|Fön,Islak,Banyo,Sıcak,Kuaför
Tost Makinesi|Ekmek,Kaşar,Isıtmak,Kahvaltı,Sucuk
Kettle|Su,Kaynatmak,Elektrik,Çay,Sıcak
Kumanda|Televizyon,Tuş,Kanal,Pil,Uzaktan
Kulaklık|Müzik,Duymak,Ses,Kulak,Kablo
Şarj Aleti|Pil,Telefon,Priz,Kablo,Doldurmak
Fotoğraf Makinesi|Çekmek,Poz,Lens,Resim,Flaş
Yazıcı|Kağıt,Mürekkep,Bilgisayar,Çıktı,Toner
İnternet|WiFi,Site,Bağlanmak,Modem,Ağ
Şifre|Gizli,Hesap,Güvenlik,Giriş,Parola
Klavye|Tuş,Yazmak,Bilgisayar,Harf,Boşluk
Mouse|Fare,Tıklamak,Bilgisayar,İmleç,Kaydırmak
Oyun Konsolu|PlayStation,Xbox,Kol,Televizyon,Joystick
Robot|Makine,Yapay,Otomatik,Metal,İnsan
Uzay Gemisi|Astronot,Roket,Gezegen,Uçmak,Dünya
Uydu|Uzay,Yörünge,Dünya,Televizyon,Sinyal
Pil|Enerji,Elektrik,Kumanda,Şarj,Bitmek
Ampul|Işık,Lamba,Elektrik,Yanmak,Aydınlatmak
Anahtar|Kapı,Kilit,Açmak,Ev,Çilingir
Şemsiye|Yağmur,Islanmak,Açmak,Yağış,Sap
Gözlük|Görmek,Cam,Göz,Numara,Güneş
Ayna|Yansıma,Bakmak,Yüz,Cam,Kendin
Saat|Zaman,Akrep,Yelkovan,Dakika,Kol
Cüzdan|Para,Kart,Cep,Kimlik,Deri
Çanta|Taşımak,Sırt,Fermuar,Eşya,Omuz
Valiz|Seyahat,Bavul,Tekerlek,Tatil,Kıyafet
Yastık|Uyumak,Yatak,Baş,Yumuşak,Yorgan
Battaniye|Örtünmek,Soğuk,Yatak,Sıcak,Yün
Halı|Yer,Zemin,Dokuma,Desen,Süpürmek
Perde|Pencere,Cam,Güneş,Kumaş,Açmak
Masa|Sandalye,Yemek,Ayak,Çalışmak,Üst
Sandalye|Oturmak,Masa,Ayak,Sırt,Tabure
Koltuk|Oturmak,Salon,Kanepe,Rahat,Mobilya
Dolap|Kapak,Raf,Eşya,Kıyafet,Saklamak
Merdiven|Basamak,Çıkmak,İnmek,Kat,Yukarı
Asansör|Kat,Bina,Çıkmak,Düğme,İnmek
Kapı|Açmak,Kilit,Ev,Zil,Anahtar
Pencere|Cam,Manzara,Perde,Açmak,Duvar
Çatı|Ev,Kiremit,Üst,Yağmur,Bina
Balkon|Dışarı,Ev,Manzara,Korkuluk,Teras
Bahçe|Çiçek,Ağaç,Toprak,Çim,Ev
Havuz|Yüzmek,Su,Mayo,Yaz,Atlamak
Duş|Banyo,Su,Yıkanmak,Sabun,Sıcak
Diş Fırçası|Macun,Ağız,Temizlemek,Diş,Banyo
Sabun|Köpük,El,Yıkamak,Temizlik,Koku
Havlu|Kurulamak,Banyo,Islak,Kumaş,El
Parfüm|Koku,Sıkmak,Şişe,Güzel,Boyun
Makas|Kesmek,Kağıt,Bıçak,Terzi,Saç
Kalem|Yazmak,Silgi,Defter,Uç,Mürekkep
Defter|Sayfa,Yazmak,Okul,Çizgi,Kalem
Kitap|Okumak,Sayfa,Yazar,Roman,Kapak
Gazete|Haber,Kağıt,Manşet,Okumak,Günlük
Harita|Yol,Ülke,Yön,Şehir,Coğrafya
Dürbün|Uzak,Büyütmek,Göz,Mercek,Bakmak
Pusula|Kuzey,Yön,İbre,Güney,Kaybolmak
Çadır|Kamp,Doğa,Uyumak,Kurmak,Fermuar
Uyku Tulumu|Kamp,Çadır,Gece,Sıcak,Yatmak
El Feneri|Işık,Pil,Karanlık,Kamp,Aydınlatmak
Bisiklet|Pedal,Tekerlek,Sürmek,Zincir,Gidon
Motosiklet|Motor,Kask,İki,Tekerlek,Sürmek
Otomobil|Araba,Direksiyon,Tekerlek,Benzin,Yol
Otobüs|Durak,Yolcu,Şoför,Bilet,Toplu
Tren|Ray,Vagon,İstasyon,Lokomotif,Demiryolu
Metro|Yeraltı,İstasyon,Tren,Ulaşım,Hat
Tramvay|Ray,Şehir,Durak,Toplu,Elektrik
Uçak|Pilot,Kanat,Hava,Uçmak,Havalimanı
Helikopter|Pervane,Uçmak,Hava,Pilot,İniş
Gemi|Deniz,Kaptan,Liman,Yolcu,Yüzmek
Denizaltı|Su,Derinlik,Gemi,Asker,Periskop
Taksi|Sarı,Şoför,Ücret,Yolcu,Taksimetre
Ambulans|Hasta,Hastane,Siren,Acil,Doktor
İtfaiye|Yangın,Su,Hortum,Söndürmek,Kırmızı
Trafik Lambası|Kırmızı,Yeşil,Sarı,Dur,Yol
Emniyet Kemeri|Araba,Kaza,Koltuğa,Bağlamak,Güvenlik
Direksiyon|Araba,Çevirmek,Sürmek,Şoför,El
Lastik|Tekerlek,Hava,Patlamak,Araba,Kauçuk
Benzin|Yakıt,Araba,İstasyon,Depo,Motor
Pasaport|Yurtdışı,Seyahat,Kimlik,Vize,Sınır
Havalimanı|Uçak,Pist,Bavul,Bilet,Uçuş
Otel|Tatil,Oda,Konaklamak,Resepsiyon,Yıldız
Restoran|Yemek,Garson,Menü,Hesap,Masa
Kafe|Kahve,İçmek,Oturmak,Arkadaş,Çay
Market|Alışveriş,Kasiyer,Sepet,Ürün,Fiyat
Eczane|İlaç,Reçete,Eczacı,Hasta,Doktor
Hastane|Doktor,Hasta,Hemşire,Tedavi,Ameliyat
Okul|Öğrenci,Öğretmen,Ders,Sınıf,Teneffüs
Üniversite|Öğrenci,Fakülte,Kampüs,Diploma,Profesör
Kütüphane|Kitap,Sessiz,Okumak,Ödünç,Raf
Sinema|Film,Perde,Bilet,Patlamış Mısır,İzlemek
Tiyatro|Sahne,Oyuncu,Perde,Oyun,Seyirci
Müze|Eser,Tarih,Sergi,Sanat,Ziyaret
Stadyum|Futbol,Maç,Taraftar,Tribün,Saha
Hayvanat Bahçesi|Hayvan,Kafes,Aslan,Ziyaret,Doğa
Akvaryum|Balık,Su,Cam,Yüzmek,Deniz
Lunapark|Dönme Dolap,Eğlence,Oyuncak,Bilet,Hız
Dönme Dolap|Lunapark,Yüksek,Kabin,Dönmek,Eğlence
Çarpışan Araba|Lunapark,Vurmak,Direksiyon,Eğlence,Elektrik
Pazar|Tezgah,Sebze,Meyve,Alışveriş,Satıcı
Berber|Saç,Kesmek,Tıraş,Makas,Sakal
Kuaför|Saç,Boya,Fön,Kesmek,Şekil
Terzi|Dikiş,Kıyafet,İğne,Kumaş,Ölçü
Fırıncı|Ekmek,Hamur,Sıcak,Pişirmek,Un
Kasap|Et,Bıçak,Kıyma,Kesmek,Dükkan
Doktor|Hasta,Hastane,Tedavi,Muayene,Reçete
Öğretmen|Okul,Ders,Öğrenci,Sınıf,Tahta
Avukat|Mahkeme,Hukuk,Dava,Savunmak,Hakim
Polis|Güvenlik,Suç,Üniforma,Karakol,Yakalamak
Astronot|Uzay,Roket,Ay,Giysi,Gezegen
Pilot|Uçak,Uçmak,Kokpit,Hava,Kaptan
Çiftçi|Tarla,Toprak,Traktör,Ekmek,Hasat
Aşçı|Yemek,Mutfak,Pişirmek,Şef,Tencere
Garson|Restoran,Sipariş,Servis,Masa,Hesap
Futbolcu|Top,Maç,Gol,Saha,Takım
Hakem|Düdük,Kart,Maç,Faul,Karar
Kaleci|Gol,Kale,Top,Eldiven,Kurtarmak
Basketbol|Pota,Top,Sayı,Parke,Beş
Voleybol|File,Top,Smaç,Servis,Altı
Tenis|Raket,Top,Kort,Set,Servis
Yüzme|Su,Havuz,Kulaç,Mayo,Deniz
Boks|Yumruk,Eldiven,Ring,Dövüş,Nakavt
Güreş|Minder,Pehlivan,Tuş,Yağ,Boğuşmak
Satranç|Şah,Mat,Taş,Vezir,Hamle
Tavla|Zar,Pul,Kapı,Çift,Oynamak
Okey|Taş,Istaka,Per,Sayı,Çifte
İskambil|Kart,Papaz,As,Maça,Kupa
Bilardo|Istaka,Top,Delik,Masa,Vurmak
Bowling|Lobut,Top,Devirmek,Kulvar,Atmak
Kayak|Kar,Kış,Pist,Dağ,Kaymak
Sörf|Dalga,Deniz,Tahta,Rüzgar,Denge
Kamp|Çadır,Doğa,Ateş,Orman,Uyumak
Piknik|Mangal,Doğa,Örtü,Yemek,Aile
Balık Tutmak|Olta,Deniz,Yem,Yakalamak,Kanca
Uçurtma|Rüzgar,Gökyüzü,İp,Uçmak,Kağıt
Balon|Hava,Şişirmek,Patlamak,Parti,Uçmak
Hediye|Doğum Günü,Paket,Sürpriz,Vermek,Almak
Doğum Günü|Pasta,Mum,Yaş,Kutlamak,Hediye
Düğün|Gelin,Damat,Evlilik,Dans,Salon
Mezuniyet|Diploma,Okul,Kep,Tören,Bitirmek
Tatil|Dinlenmek,Yaz,Deniz,Seyahat,İzin
Kardan Adam|Kış,Havuç,Kar,Yapmak,Soğuk
Gökkuşağı|Renk,Yağmur,Gökyüzü,Yedi,Güneş
Şimşek|Işık,Gök,Gürültü,Fırtına,Çakmak
Yağmur|Su,Bulut,Islanmak,Şemsiye,Damla
Kar|Beyaz,Kış,Soğuk,Yağmak,Buz
Rüzgar|Esinti,Hava,Uçmak,Fırtına,Esmek
Güneş|Sıcak,Işık,Yıldız,Gündüz,Gökyüzü
Ay|Gece,Uydu,Dünya,Krater,Dolunay
Yıldız|Gece,Gökyüzü,Parlamak,Uzay,Güneş
Deprem|Sarsıntı,Fay,Bina,Yer,Sallanmak
Yanardağ|Lav,Patlamak,Dağ,Ateş,Krater
Şelale|Su,Akmak,Yüksek,Dökülmek,Nehir
Deniz|Su,Tuzlu,Dalga,Plaj,Yüzmek
Okyanus|Deniz,Büyük,Su,Kıta,Derin
Orman|Ağaç,Doğa,Yeşil,Hayvan,Yeşillik
Çöl|Kum,Sıcak,Deve,Su,Kurak
Ada|Deniz,Kara,Etraf,Su,Tatil
Mağara|Karanlık,Dağ,Yarasa,İçeri,Kaya
Köprü|Nehir,Geçmek,İki,Yol,Boğaz
Tünel|Yeraltı,Yol,Dağ,Karanlık,Geçmek
Kedi|Miyav,Hayvan,Pati,Bıyık,Fare
Köpek|Havlamak,Hayvan,Sadık,Kuyruk,Kemik
Aslan|Yele,Orman,Kral,Hayvan,Kükremek
Fil|Hortum,Büyük,Kulak,Hayvan,Afrika
Zürafa|Boyun,Uzun,Benek,Hayvan,Afrika
Maymun|Muz,Ağaç,Tırmanmak,Hayvan,Goril
Penguen|Buz,Kutup,Kuş,Yüzmek,Siyah
Yunus|Deniz,Memeli,Zıplamak,Su,Balık
Köpekbalığı|Deniz,Diş,Yüzgeç,Tehlike,Balık
Kaplumbağa|Kabuk,Yavaş,Hayvan,Deniz,Karada
Tavşan|Havuç,Kulak,Zıplamak,Hayvan,Hızlı
At|Binmek,Nal,Koşmak,Yele,Kişnemek
İnek|Süt,Çiftlik,Hayvan,Ot,Buzağı
Tavuk|Yumurta,Kümes,Horoz,Kanat,Civciv
Arı|Bal,İğne,Kovan,Çiçek,Vızıldamak
Kelebek|Kanat,Renk,Tırtıl,Uçmak,Koza
Örümcek|Ağ,Böcek,Sekiz,Bacak,Örmek
Yılan|Zehir,Sürünmek,Dil,Uzun,Hayvan
Kartal|Kuş,Kanat,Uçmak,Pençe,Yırtıcı
Baykuş|Gece,Kuş,Göz,Ötmek,Uçmak
Pizza|Hamur,Peynir,Dilim,İtalyan,Fırın
Hamburger|Köfte,Ekmek,Fast Food,Patates,Sos
Lahmacun|Kıyma,Hamur,İnce,Limon,Maydanoz
Mantı|Yoğurt,Hamur,Kıyma,Kayseri,Sarımsak
Döner|Et,Dürüm,Kesmek,Şiş,Ekmek
Kebap|Et,Şiş,Adana,Mangal,Pişirmek
Baklava|Şerbet,Fıstık,Tatlı,Yufka,Antep
Dondurma|Soğuk,Külah,Süt,Yaz,Erimek
Çikolata|Kakao,Tatlı,Süt,Kahverengi,Tablet
Pasta|Mum,Doğum Günü,Krema,Dilim,Tatlı
Simit|Susam,Halka,Kahvaltı,Çay,Hamur
Börek|Yufka,Peynir,Kıyma,Fırın,Tepsi
Menemen|Yumurta,Domates,Biber,Kahvaltı,Tava
Pilav|Pirinç,Tane,Tereyağı,Yemek,Nohut
Çorba|Kaşık,Sıcak,Kase,Mercimek,İçmek
Salata|Marul,Domates,Salatalık,Yeşillik,Limon
Makarna|İtalyan,Haşlamak,Sos,Spagetti,Hamur
Patlamış Mısır|Sinema,Tuz,Patlamak,Tencere,Atıştırmalık
Karpuz|Yaz,Çekirdek,Kırmızı,Yeşil,Dilim
Muz|Sarı,Meyve,Kabuk,Maymun,Tropikal
Çilek|Kırmızı,Meyve,Küçük,Reçel,Yaz
Limon|Sarı,Ekşi,Meyve,Sıkmak,C Vitamini
Kahve|Kafein,Fincan,İçmek,Telve,Çekirdek
Çay|Bardak,Demlemek,Sıcak,Rize,İçmek
Ayran|Yoğurt,Tuz,İçmek,Beyaz,Su
Limonata|Limon,Şeker,İçecek,Yaz,Soğuk
Mikrofon|Ses,Konuşmak,Şarkı,Sahne,Hoparlör
Gitar|Tel,Çalmak,Müzik,Pena,Enstrüman
Piyano|Tuş,Siyah,Beyaz,Müzik,Çalmak
Keman|Yay,Tel,Müzik,Çalmak,Enstrüman
Davul|Tokmak,Vurmak,Ritim,Müzik,Zurna
Konser|Şarkıcı,Sahne,Müzik,Seyirci,Bilet
Karaoke|Şarkı,Söylemek,Mikrofon,Söz,Müzik
Masal|Prenses,Çocuk,Anlatmak,Bir Varmış,Peri
Rüya|Uyku,Gece,Görmek,Hayal,Kabus
Sihirbaz|Numara,Şapka,Tavşan,Hokus Pokus,Gösteri
Dedektif|İpucu,Suç,Çözmek,Gizem,Araştırmak
Korsan|Gemi,Deniz,Hazine,Göz Bandı,Kılıç
Hazine|Altın,Sandık,Harita,Define,Bulmak
Ejderha|Ateş,Kanat,Masal,Uçmak,Yaratık
Vampir|Kan,Diş,Gece,Yarasa,Drakula
Zombi|Ölü,Yürümek,Korku,Beyin,Saldırmak
Hayalet|Ruh,Korku,Görünmez,Beyaz,Ölü
Süper Kahraman|Güç,Kostüm,Kurtarmak,Pelerin,Çizgi Roman
İstanbul|Boğaz,Köprü,Şehir,Türkiye,Marmara
Ankara|Başkent,Türkiye,Anıtkabir,Şehir,Meclis
İzmir|Ege,Saat Kulesi,Kordon,Şehir,Boyoz
Kapadokya|Balon,Peribacası,Nevşehir,Turist,Kayalar
Pamukkale|Beyaz,Denizli,Traverten,Su,Turist
Eyfel Kulesi|Paris,Fransa,Demir,Yüksek,Yapı
Piramit|Mısır,Firavun,Üçgen,Mezar,Kum
Özgürlük Heykeli|Amerika,New York,Meşale,Heykel,Taç
Noel Baba|Hediye,Kırmızı,Sakal,Kızak,Yılbaşı
Alışveriş|Para,Mağaza,Almak,Sepet,Harcamak
İndirim|Fiyat,Ucuz,Kampanya,Yüzde,Alışveriş
Piyango|Bilet,Şans,Para,Çekiliş,Kazanmak
Kumbara|Para,Biriktirmek,Bozuk,Kutu,Tasarruf
Kredi Kartı|Banka,Ödeme,Borç,Limit,Taksit
ATM|Banka,Para,Çekmek,Kart,Şifre
İmza|Ad,Kalem,Belge,Onay,Yazmak
Mektup|Zarf,Posta,Yazmak,Pul,Göndermek
Takvim|Gün,Ay,Yıl,Tarih,Hafta
Doğum Belgesi|Bebek,Tarih,Kimlik,Doğmak,Resmi
Karne|Okul,Not,Dönem,Öğrenci,Tatil
Sınav|Soru,Cevap,Not,Çalışmak,Test
Ödev|Okul,Ev,Öğretmen,Ders,Yapmak
Teneffüs|Okul,Ders,Zil,Ara,Öğrenci
Zil|Çalmak,Kapı,Okul,Ses,Basmak
Alarm|Uyanmak,Saat,Çalmak,Ses,Sabah
Trafik|Araba,Yol,Yoğun,Kaza,Sıkışmak
Park Yeri|Araba,Bırakmak,Otopark,Boş,Durmak
Navigasyon|Yol,Harita,Adres,GPS,Tarif
Selfie|Fotoğraf,Kendi,Telefon,Çekmek,Yüz
Sosyal Medya|Paylaşmak,Beğeni,Takipçi,İnternet,Hesap
Emoji|Yüz,Mesaj,İfade,Sarı,Gülmek
Şarj|Pil,Telefon,Doldurmak,Elektrik,Bitmek
Uzaktan Kumandalı Araba|Oyuncak,Pil,Sürmek,Kumanda,Tekerlek
Yapboz|Parça,Birleştirmek,Resim,Tamamlamak,Oyun
Lego|Parça,Plastik,Birleştirmek,Oyuncak,İnşa
Salıncak|Park,Sallanmak,İp,Çocuk,Oturmak
Kaydırak|Park,Çocuk,Kaymak,Merdiven,Aşağı
Tahterevalli|Park,İki,Denge,Yukarı,Aşağı
Trambolin|Zıplamak,Yay,Çocuk,Eğlence,File
İp Atlama|Zıplamak,Spor,İp,Çevirmek,Ayak
Saklambaç|Ebe,Saklanmak,Bulmak,Saymak,Oyun
Körebe|Göz,Bağlamak,Yakalamak,Ebe,Oyun
Sessiz Sinema|Konuşmadan,Anlatmak,Hareket,Film,Tahmin
Taş Kağıt Makas|El,Üç,Oyun,Kazanmak,Seçmek
Mendil Kapmaca|Koşmak,Ebe,İki Takım,Bez,Yakalamak
Uğur Böceği|Kırmızı,Benek,Siyah,Böcek,Şans
Kirpi|Diken,Hayvan,Küçük,Top,Orman
Panda|Bambu,Siyah,Beyaz,Ayı,Çin
Koala|Ağaç,Avustralya,Hayvan,Uyumak,Okaliptüs
Deve|Hörgüç,Çöl,Hayvan,Kum,Su
Tilki|Kurnaz,Hayvan,Kuyruk,Turuncu,Orman
Kurt|Uluma,Orman,Sürü,Hayvan,Köpek
Geyik|Boynuz,Orman,Hayvan,Koşmak,Kızak
Fare|Peynir,Kedi,Kuyruk,Küçük,Kemirmek
Kurbağa|Su,Zıplamak,Yeşil,Vırak,Hayvan
Timsah|Diş,Nehir,Sürüngen,Tehlike,Hayvan
Flamingo|Pembe,Kuş,Bacak,Uzun,Göl
Papağan|Kuş,Konuşmak,Renk,Gaga,Taklit
Tavus Kuşu|Kuyruk,Renk,Kuş,Açmak,Tüy
Denizanası|Deniz,Şeffaf,Yakmak,Su,Dokunaç
Ahtapot|Sekiz,Kol,Deniz,Mürekkep,Yumuşak
Denizyıldızı|Beş,Kol,Deniz,Yıldız,Hayvan
Bukalemun|Renk,Değiştirmek,Kertenkele,Dil,Kamuflaj
Karınca|Çalışkan,Yuva,Küçük,Böcek,Sürü
Sivrisinek|Isırmak,Kan,Kaşınmak,Vızıldamak,Yaz
`;
export const TABU_CARDS = rows.trim().split('\n').map((row) => {
  const [word, rest] = row.trim().split('|');
  return { word, banned: rest.split(',') };
});

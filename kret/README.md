# Kret — Zaginiona rodzina

Przygoda przeglądarkowa w przekroju ziemi. Wersja 2.2: swobodne tunele, widoczne akcje i czytelna informacja o zmianach stanu. Na komputer, telefon i tablet, bez instalacji ani zewnętrznych bibliotek.

## Cel

Odnajdź Pikusia pod korzeniami ogrodu, Figę w zakopanych ruinach oraz Tuptusia w jaskini grzybów. Zawołaj każdego i poprowadź własnymi tunelami do domu. Pierwszy ratunek daje lepsze pazurki i dalszy nasłuch, drugi odblokowuje zryw. Po uratowaniu całej rodziny można dalej odkrywać sekrety i urządzać norę.

## Sterowanie

- WASD / strzałki: płynny ruch, także ukośnie; przytrzymanie kierunku kopie.
- Mysz: przytrzymaj przycisk na planszy, aby kopać w stronę kursora.
- Telefon i tablet: joystick po prawej, przyciski czynności po lewej. Działa ruch w dowolnym kierunku.
- Spacja / Nasłuch: zielone drgania to jedzenie, złote to rodzina, czerwone to zagrożenia. Blisko wejścia możesz wystawić sam nos.
- Q / Zjedz: odzyskaj siły.
- E: zawołaj małego kreta, odkryj przedmiot, przesuń mały kamień albo otwórz urządzanie nory.
- F / Zasyp: jednym naciśnięciem zasyp przejście za sobą na ostatniej trasie. Złote koło pokazuje zasypane miejsce. Nie trzeba potwierdzać ani zatrzymywać świata. Brak bezpiecznego miejsca daje wyraźny powód, a sterowanie pozostaje aktywne. Zasypywanie działa również bez energii; pozostaw bezpieczne miejsce dla rodziny i wnętrza komór.
- Shift / Zryw: szybszy bieg w istniejących tunelach, po uratowaniu Figi.
- M: mapa; P / Escape: pauza. W pauzie można włączyć dźwięk.

## Świat

Ogród korzeni, piasek pod łąką, zakopane ruiny, podziemny strumień i jaskinia świecących grzybów. Duże skały są rozpoznawalnymi przeszkodami z drogą dookoła. Małe kamienie można przesuwać, a ulepszonymi pazurkami kruszyć. Larwy, uciekające dżdżownice, liście, monety, bursztyn i stare przedmioty nagradzają eksplorację.

Kopanie łączy tunele nawet wtedy, gdy punkt przed kretem jest już otwarty. Małe odizolowane resztki ziemi rozpadają się w pobliżu wykopu. Ostatni odcinek wyjścia jest pionowy, a na powierzchni powstaje kopiec z otworem. Kamienie bez podparcia ostrzegają drżeniem i strzałką przez 0,85 sekundy, potem spadają do pierwszego podparcia.

Moneta daje 2 błyskotki na ulepszenia; but zawiera 4 materiały i 2 porcje jedzenia; bursztyn daje błyskotkę i pełną energię. Ruiny, źródło oraz świecący ogród mają osobne nagrody. Przedmioty zbierzesz po podejściu lub przyciskiem Odkryj. Zebrane monety i bursztyn znikają, pozostałe obiekty dostają oznaczenie ✓. Panel Rodzina pokazuje listę odkryć i nagrody.

Lis wchodzi tylko istniejącym otworem przy kopcu, porusza się otwartymi przejściami do 35 pikseli pod powierzchnią i nie kopie ziemi ani nie atakuje przez ścianę. Ostrzega przed atakiem. Wąż porusza się istniejącymi tunelami; kryjówka go zatrzymuje. Sowa poluje na powierzchni, gdzie obraz jest rozmyty. Deszcz i źródło dostarczają wody do otwartych przejść. Woda jest symulowana co 0,1 sekundy w dwóch krokach, szybko spływa w dół i rozlewa się po bokach. Odpływy osuszają połączone tunele; spiżarnię można przenieść wraz z zapasami. Zasypanie drogi zatrzymuje zwierzęta i wodę, ale może też odciąć drogę rodzinie.

Komunikaty, statystyki i sterowanie mają wydzielone miejsce poza obszarem planszy. Kamera śledzi kreta również na powierzchni.

Pasek nad planszą pokazuje aktualną sytuację i przycisk najlepszej czynności. Przy małym krecie pojawia się Zawołaj, złote zaznaczenie postaci oraz podświetlenie przycisku. Po zawołaniu widać stan idzie za tobą; zablokowana droga powoduje wskazówkę o poszerzeniu tunelu. Przedmioty, niski poziom energii, zalanie, wejście do nowej krainy, odpoczynek i zdobyte zasoby mają osobne potwierdzenia.

Uciekaj!, kierunek drapieżnika, czerwone obramowanie i liczba utraconego zdrowia pokazują atak. Po ataku zwierzę odsuwa się przez 3,5 sekundy, kret ma 5 sekund ochrony oraz szybszy ruch i kopanie nawet bez energii. Przyciśnięcie przez kamień nie blokuje ucieczki: można ruszać od kamienia albo użyć Wydostań, które prowadzi do najbliższej dostępnej strony. Te zmiany nie teleportują kreta ani nie usuwają skały.

## Zapis

Postęp zapisuje się co 5 sekund i przy pauzie, osobno w każdej przeglądarce. Wersja 2.2 zachowuje zapis wersji 2, tunele, kopce, położenia kamieni i odkrycia. Zapis starej wersji 1 nie jest usuwany. Zasłabnięcie pozwala wrócić do nory z zachowaniem tuneli, odkryć i komór. Towarzyszące małe krety czekają wtedy w miejscu, w którym zostały.

## Uruchomienie

Hostuj folder na statycznym serwerze HTTP. Grafika: Canvas 2D; dźwięk: Web Audio. Wszystkie zasoby są lokalne i używają ścieżek względnych. Ruch i kształty tuneli są ciągłe; mała, niewidoczna siatka służy wyłącznie do obliczania odkrycia terenu i przepływu wody.

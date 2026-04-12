import type { ScenarioType } from "@/types/scenario";

export interface TourContext {
  selectScenario: (type: ScenarioType) => void;
  deactivateScenario: () => void;
}

export type TourPlacement = "top" | "bottom" | "left" | "right" | "center" | "fixed-top";

export interface TourStep {
  id: string;
  target: string | null; // data-tour selector, null = centered modal
  title: string;
  description: string;
  placement: TourPlacement;
  onEnter?: (ctx: TourContext) => void;
  onExit?: (ctx: TourContext) => void;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Witaj w Sztabie Kryzysowym",
    description:
      "To jest interaktywny przewodnik po aplikacji. Pokaze Ci krok po kroku wszystkie mozliwosci systemu zarzadzania kryzysowego dla Wojewodztwa Lubelskiego. Kliknij \"Dalej\" aby rozpoczac.",
    placement: "center",
  },
  {
    id: "layer-panel",
    target: "layer-panel",
    title: "Panel warstw danych",
    description:
      "Tutaj zarzadzasz warstwami na mapie. Mozesz wlaczac i wylaczac poszczegolne warstwy (szpitale, szkoly, rzeki, granice administracyjne), regulowac ich przezroczystosc i przegladac obiekty na liscie. System integruje 16+ warstw z roznych zrodel.",
    placement: "right",
  },
  {
    id: "region-picker",
    target: "region-picker",
    title: "Filtr regionu",
    description:
      "Wybierz powiat lub gmine, aby ograniczyc widok mapy do wybranego obszaru. Mozesz tez kliknac granice administracyjna bezposrednio na mapie. Dane automatycznie przefiltruja sie do wybranego regionu.",
    placement: "right",
  },
  {
    id: "map-area",
    target: "map-area",
    title: "Mapa interaktywna",
    description:
      "Centralna czesc aplikacji. Zoom kolkiem myszy, przeciagaj aby przesunac. Klikaj obiekty na mapie (szpitale, szkoly, wodowskazy) aby zobaczyc szczegoly. Granice administracyjne mozna kliknac aby ustawic filtr regionu.",
    placement: "bottom",
  },
  {
    id: "map-mode",
    target: "map-mode-toggle",
    title: "Tryb wizualizacji",
    description:
      "Przelaczaj miedzy trybem punktowym (pojedyncze obiekty) a trybem heksagonalnym H3 (agregacja przestrzenna). Tryb H3 pokazuje zageszenie obiektow w heksagonach — przydatny do analizy rozkladu zasobow.",
    placement: "right",
  },
  {
    id: "scenario-panel",
    target: "scenario-panel",
    title: "Panel scenariuszy kryzysowych",
    description:
      "Tutaj wybierasz i uruchamiasz scenariusze zagrozen. Dostepne sa trzy symulacje: chmura toksyczna, powodz i zgloszenia cywilne. Kazdy scenariusz automatycznie dostosowuje widoczne warstwy i oblicza wplyw na infrastrukture.",
    placement: "left",
  },
  {
    id: "scenario-toxic",
    target: "scenario-panel",
    title: "Scenariusz: Chmura toksyczna",
    description:
      "Model Gaussowski dyspersji chmury z Zakladow Azotowych Pulawy. Mozesz wybrac substancje (amoniak, chlor, NO\u2082, kwas azotowy), scenariusz uwolnienia, kierunek i predkosc wiatru. System wyznacza 3 strefy zagrozen wedlug progow ERPG i oblicza zagrozenie dla okolicznych obiektow.",
    placement: "fixed-top",
    onEnter: (ctx) => ctx.selectScenario("toxic-cloud"),
  },
  {
    id: "scenario-flood",
    target: "scenario-panel",
    title: "Scenariusz: Powodz ISOK",
    description:
      "Oficjalne strefy zagrozenia powodziowego z systemu ISOK. Trzy scenariusze: Q 10% (czesta), Q 1% (stuletnia), Q 0,2% (ekstremalna). Mozesz wlaczyc filtr obiektow — wtedy widoczne sa tylko szpitale, szkoly i DPS-y lezace w strefie zalewowej.",
    placement: "fixed-top",
    onEnter: (ctx) => {
      ctx.deactivateScenario();
      setTimeout(() => ctx.selectScenario("flood"), 300);
    },
  },
  {
    id: "scenario-civil",
    target: "scenario-panel",
    title: "Scenariusz: Zgloszenia cywilne",
    description:
      "Zgloszenia z aplikacji mobilnej CIVIL42 w czasie rzeczywistym. System klasteryzuje ogniska incydentow (promien 1 km), filtruje po czasie (15 min, 1h, 6h) i analizuje zagrozenie dla pobliskich obiektow. Mozesz otworzyc symulator telefonu z aplikacja do zgloszen.",
    placement: "fixed-top",
    onEnter: (ctx) => {
      ctx.deactivateScenario();
      setTimeout(() => ctx.selectScenario("civil-reports"), 300);
    },
  },
  {
    id: "impact-bar",
    target: "impact-bar",
    title: "Pasek analizy wplywu",
    description:
      "Automatyczna analiza zagrozen. Pokazuje szacowana liczbe zagrozonych osob i obiektow infrastruktury krytycznej w kazdej strefie. Dane aktualizuja sie w czasie rzeczywistym przy zmianie parametrow scenariusza.",
    placement: "top",
  },
  {
    id: "summary",
    target: null,
    title: "Gotowe!",
    description:
      "Znasz juz wszystkie mozliwosci Sztabu Kryzysowego. System integruje dane z GIOS, IMGW, ISOK, OpenStreetMap i CIVIL42, umozliwiajac podejmowanie decyzji opartych na danych w sytuacjach kryzysowych. Mozesz wrocic do przewodnika w kazdej chwili klikajac ikone ksiazki w panelu bocznym.",
    placement: "center",
    onEnter: (ctx) => ctx.deactivateScenario(),
  },
];

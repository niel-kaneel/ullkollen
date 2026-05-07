
alter table public.shearers
  add column if not exists certified_by_farklipparforbundet boolean default false,
  add column if not exists listed_by_faravelsforbundet boolean default false,
  add column if not exists website text,
  add column if not exists service_areas text[] default '{}',
  add column if not exists self_managed boolean default false,
  add column if not exists notes text;

delete from public.shearers
where display_name in (
  'Anders Klippservice', 'Eva Fårklippning AB', 'Sami Sheep Shearing',
  'Klippteam Skåne', 'Mellansverige Klipp'
);

insert into public.shearers (
  display_name, phone, email, website,
  home_lat, home_lng, service_areas,
  languages, certified_by_farklipparforbundet,
  listed_by_faravelsforbundet, approved, active, notes
) values
('Martin Larsson', '+46 702 01 88 41', null, null, 65.5848, 22.1547, array['Norrbotten','Västerbotten'], array['sv'], true, true, true, true, 'Luleå. Tel även 0920-303 04.'),
('Harry Johansson', '+46 702 37 55 00', null, null, 63.8258, 20.2630, array['Västerbotten','Norrland'], array['sv'], true, true, true, true, 'Umeå'),
('Joakim Luther', '+46 702 58 04 98', 'jocke.luther@gmail.com', null, 63.8258, 20.2630, array['Västerbotten'], array['sv'], false, true, true, true, 'Umeå'),
('Mattis Wentzel', '+46 702 85 53 81', null, null, 63.2900, 18.7150, array['Västernorrland','Ångermanland'], array['sv'], true, true, true, true, 'Örnsköldsvik'),
('Iain Thomson', '+46 724 03 29 22', 'mrithomson@gmail.com', null, 62.6320, 17.9410, array['Västernorrland'], array['sv','en'], false, true, true, true, 'Härnösand'),
('Carina Jälkentalo', '+46 705 84 92 06', null, null, 63.7330, 14.6000, array['Jämtland'], array['sv'], true, true, true, true, 'Föllinge / Laxsjö'),
('Jacob Holmberg', '+46 736 26 68 33', null, null, 61.8290, 16.0900, array['Hälsingland','Gävleborg'], array['sv'], true, false, true, true, 'Ljusdal'),
('Tyrone Steele', '+46 736 50 17 72', null, null, 61.3490, 16.4030, array['Hälsingland','Gävleborg'], array['sv','en'], true, true, true, true, 'Bollnäs / Arbrå'),
('Chris Wurst', '+46 706 99 33 88', null, null, 61.1240, 14.6160, array['Dalarna'], array['sv','en','de'], true, true, true, true, 'Orsa'),
('Edvin Uhlås', '+46 705 50 90 37', null, 'https://www.uhlasfarservice.se', 60.2310, 17.7050, array['Uppland','Mellansverige'], array['sv'], false, true, true, true, 'Uppland & grannlän. Del av Uhlås Fårservice.'),
('Emil Uhlås', '+46 702 82 43 80', null, 'https://www.uhlasfarservice.se', 60.2310, 17.7050, array['Uppland','Mellansverige'], array['sv'], true, true, true, true, 'Örbyhus / Uppland. Del av Uhlås Fårservice.'),
('Erik Uhlås', '+46 702 28 00 93', null, 'https://www.uhlasfarservice.se', 60.2310, 17.7050, array['Uppland','Mellansverige'], array['sv'], true, false, true, true, 'Örbyhus. Tel även 0702-48 28 75. Del av Uhlås Fårservice.'),
('Johan Uhlås', '+46 702 46 54 55', null, 'https://www.uhlasfarservice.se', 59.6370, 17.0780, array['Uppland','Mälardalen'], array['sv'], true, true, true, true, 'Enköping / Uppsala. Del av Uhlås Fårservice.'),
('Joel Jonsson', '+46 768 27 21 55', null, null, 59.8580, 17.6390, array['Uppland'], array['sv'], true, false, true, true, 'Uppsala'),
('Jenny Wallberg', '+46 706 68 25 44', 'jenny.wallberg@gmail.com', null, 59.8580, 17.6390, array['Uppland'], array['sv'], true, true, true, true, 'Uppsala'),
('Hans Wigren', '+46 705 92 69 52', null, null, 60.2050, 17.6160, array['Norra Uppland'], array['sv'], true, true, true, true, 'Tobo / norra Uppland'),
('Elin Esperi', '+46 730 69 45 11', 'esperi_@hotmail.com', null, 59.7580, 18.7050, array['Roslagen','Stockholm'], array['sv'], true, true, true, true, 'Norrtälje'),
('Edward Mackenzie', '+46 793 06 57 03', 'edwardmackenzie99@gmail.com', null, 59.3293, 18.0686, array['Stockholm','Södermanland'], array['sv','en'], false, true, true, true, 'Stockholm och Södermanland'),
('Janne Slobodnik', '+46 706 05 22 64', null, 'https://www.hemmapaklev.se/farklippning', 59.6090, 16.5440, array['Mälardalen','Västra Götaland','Halland','Småland'], array['sv'], false, true, true, true, 'Utgår från Västerås och Mårdaklev'),
('Therese Lindh', '+46 704 83 24 93', null, null, 58.9960, 16.2080, array['Södermanland'], array['sv'], true, false, true, true, 'Katrineholm'),
('Per Eriksson', '+46 708 46 12 86', null, null, 59.1400, 14.9500, array['Närke','Örebro'], array['sv'], true, false, true, true, 'Vintrosa'),
('Magnus Wuolo', '+46 709 59 98 07', null, null, 59.2750, 15.2130, array['Närke','Örebro'], array['sv'], true, true, true, true, 'Örebro'),
('Margareta Jonsson', '+46 702 67 94 93', 'margareta@norrbrofargard.se', null, 59.3120, 14.1100, array['Värmland'], array['sv'], true, true, true, true, 'Kristinehamn'),
('Liam af Ekström von Sabljar', '+46 708 13 36 40', null, null, 59.5500, 13.5000, array['Värmland','Södra Sverige'], array['sv'], true, false, true, true, 'Värmland / södra Sverige'),
('Morgan Isaksson', '+46 707 60 73 93', 'info@morganklipper.se', null, 59.7470, 14.0860, array['Värmland','Västra Götaland','Närke'], array['sv'], true, true, true, true, 'Utgår från Deje. Klipper i Värmland och grannlän.'),
('Nisse Wessling', '+46 738 26 06 01', null, null, 59.5500, 13.5000, array['Värmland'], array['sv'], false, true, true, true, 'Värmland'),
('Giambattista Paltrinieri', '+47 403 83 298', 'giambattista_paltrinieri@hotmail.it', null, 59.4800, 11.6300, array['Värmland','Västergötland','Norge'], array['sv','no','it'], true, true, true, true, 'Utgår från Oslo'),
('Erik Jegermalm', '+46 768 52 73 26', 'e.jegermalm@live.se', null, 58.3260, 15.1320, array['Östergötland'], array['sv'], true, true, true, true, 'Mjölby'),
('Jens Fältskog', '+46 706 93 86 54', null, null, 58.4810, 16.3210, array['Östergötland'], array['sv'], true, true, true, true, 'Söderköping'),
('Mårten Parner', '+46 704 40 03 90', null, null, 58.5380, 15.0410, array['Östergötland'], array['sv'], false, true, true, true, 'Motala'),
('Rocco Zander', '+46 702 78 00 39', null, null, 58.4108, 15.6210, array['Östergötland'], array['sv'], true, true, true, true, 'Linköping / Rimforsa'),
('Henrik Rolf', '+46 768 37 85 32', 'henrik.lovasa@gmail.com', null, 57.8730, 15.5900, array['Östergötland','Småland'], array['sv'], true, true, true, true, 'Ydre'),
('Matilda Andersson', '+46 768 21 78 98', null, null, 57.8730, 15.5900, array['Östergötland','Norra Småland'], array['sv'], true, true, true, true, 'Ydre / Österbymo'),
('Edvin Hellgren', '+46 727 48 62 22', null, null, 58.0340, 14.9760, array['Småland'], array['sv'], true, false, true, true, 'Tranås'),
('Tony Östangård', '+46 702 01 52 63', null, null, 57.4280, 15.0760, array['Småland'], array['sv'], true, true, true, true, 'Vetlanda'),
('Bengt Jinker', '+46 708 76 55 85', null, null, 56.8330, 13.9400, array['Småland','Kronoberg'], array['sv'], true, false, true, true, 'Ljungby'),
('Conny Malm', '+46 702 66 78 84', null, null, 57.8920, 16.4810, array['Småland'], array['sv'], false, true, true, true, 'Gamleby'),
('Johan Tildemyr', '+46 722 42 24 65', null, null, 57.7780, 15.6660, array['Götaland','Svealand'], array['sv'], false, true, true, true, 'Utgår från Gullringen'),
('Josef Åstrand', '+46 730 75 66 38', null, null, 57.7580, 16.6390, array['Småland','Kalmar'], array['sv'], false, true, true, true, 'Västervik'),
('Daniella Kürten', '+46 737 16 55 30', 'danni.kuerten@gmail.com', null, 57.7580, 16.6390, array['Småland','Kalmar'], array['sv','en','de'], true, true, true, true, 'Gunnebo / Västervik'),
('Daniel Karlsson', '+46 702 07 05 06', null, null, 56.6620, 16.4570, array['Öland','Kalmar'], array['sv'], true, true, true, true, 'Färjestaden, Öland'),
('Darryl Keenan', '+46 705 97 16 60', null, null, 57.0000, 14.5000, array['Småland'], array['sv','en'], false, true, true, true, 'Småland'),
('Camilla Svensson', '+46 768 26 48 01', 'camilla.svensson90@hotmail.com', null, 58.7080, 14.1140, array['Västra Götaland'], array['sv'], true, true, true, true, 'Töreboda / Moholm'),
('Sven Olofsson', '+46 760 46 40 71', 'sven.olofsson1@gmail.com', null, 58.6940, 11.2570, array['Bohuslän','Västra Götaland'], array['sv'], true, true, true, true, 'Grebbestad'),
('Henrik Nilsson', '+46 707 81 24 66', null, null, 58.0560, 12.4220, array['Bohuslän','Västra Götaland'], array['sv'], true, true, true, true, 'Nygård'),
('Gert Larsson', '+46 702 05 03 68', null, null, 58.5970, 11.2810, array['Bohuslän'], array['sv'], true, true, true, true, 'Fjällbacka'),
('Axel Olsson', '+46 768 09 42 37', null, null, 58.2280, 11.9220, array['Bohuslän','Västra Götaland'], array['sv'], false, true, true, true, 'Ljungskile'),
('Magnus Gustafsson', '+46 730 85 43 95', null, null, 58.0790, 12.5740, array['Västra Götaland'], array['sv'], false, true, true, true, 'Sollebrunn'),
('Lennart Johansson', '+46 705 63 26 30', null, null, 57.7900, 13.4170, array['Sjuhärad','Västra Götaland'], array['sv'], false, true, true, true, 'Ulricehamn'),
('Gert Fredriksson', '+46 706 47 28 91', null, null, 57.8500, 13.4670, array['Sjuhärad','Västra Götaland'], array['sv'], true, true, true, true, 'Timmele / Ulricehamn. Tel även 0321-30602.'),
('Erik Ullman', '+46 733 58 29 25', 'farklippningsverket@fastmail.com', null, 57.7089, 11.9746, array['Göteborg','Västra Götaland'], array['sv','en'], false, true, true, true, 'Göteborg'),
('Carl-Oskar Allered', '+46 706 17 15 14', 'c-osentreprenad@hotmail.com', null, 56.5117, 13.0420, array['Halland','Skåne'], array['sv'], true, true, true, true, 'Skottorp / Laholm'),
('Christofer Dunér', '+46 739 63 81 41', 'christofer@dunersmaskin.se', null, 56.2820, 13.2810, array['Skåne'], array['sv'], false, true, true, true, 'Örkelljunga'),
('Oliver Kristoffersson', '+46 722 35 12 30', 'oliver.kristoffersson93@gmail.com', null, 56.0470, 12.9460, array['Skåne'], array['sv'], true, true, true, true, 'Billesholm. Styrelseledamot Fårklipparförbundet.'),
('Kjell Andersson', '+46 705 28 53 55', null, 'http://www.svartafaret.nu', 55.7050, 13.1910, array['Skåne'], array['sv'], false, true, true, true, 'Skåne och grannlän'),
('Stefan Svensson', '+46 793 46 97 59', 'stefan.svensson75@live.se', null, 56.0790, 13.2360, array['Skåne'], array['sv'], false, true, true, true, 'Ljungbyhed'),
('Daniel Jonsgården', '+46 734 26 37 28', 'UiMkonsulter@outlook.com', null, 55.5430, 13.9500, array['Sydöstra Skåne'], array['sv'], true, true, true, true, 'Tomelilla. Nyutbildad — tar mindre besättningar.'),
('Åsa Schön-Karlsson', '+46 703 22 75 66', null, null, 56.8780, 14.8090, array['Småland','Blekinge','Norra Skåne'], array['sv'], true, true, true, true, 'Växjö'),
('Emi Johansson', '+46 700 62 06 69', null, null, 56.1700, 14.8625, array['Blekinge'], array['sv'], true, true, true, true, 'Karlshamn'),
('Lars Ohlsson', '+46 732 03 52 44', null, null, 56.2050, 15.5340, array['Blekinge'], array['sv'], true, true, true, true, 'Nättraby. Listad även som Lars Olsson hos Fåravelsförbundet.'),
('Viktor Larsson', '+46 700 61 24 70', 'vikkevirrelarsson@gmail.com', null, 57.6390, 18.2950, array['Gotland'], array['sv'], true, true, true, true, 'Visby'),
('Sackarias Lindh', '+46 707 90 76 58', 'lindh.sackarias@gmail.com', null, 57.6390, 18.2950, array['Gotland','Fastlandet'], array['sv'], false, true, true, true, 'Visby — klipper även på fastlandet'),
('Torbjörn Svensson', '+46 736 58 25 72', null, null, 57.4660, 18.3920, array['Gotland'], array['sv'], false, true, true, true, 'Atlingbo'),
('PM Andersson', '+46 708 44 64 85', null, null, 57.4560, 18.8190, array['Gotland'], array['sv'], false, true, true, true, 'Katthammarsvik'),
('Olof Lithberg', '+46 707 38 80 02', null, null, 57.4490, 18.4960, array['Gotland'], array['sv'], false, true, true, true, 'Buttle'),
('Reine Åkerbäck', '+46 708 46 16 19', null, null, 57.3320, 18.3080, array['Gotland'], array['sv'], false, true, true, true, 'Hejde'),
('Emil Nordin', '+46 703 90 07 71', null, null, 57.2390, 18.3760, array['Gotland'], array['sv'], false, true, true, true, 'Hemse'),
('Jonas Niklasson', '+46 737 07 27 88', null, null, 57.1330, 18.3360, array['Gotland'], array['sv'], false, true, true, true, 'Havdhem'),
('Hannes Niklasson', '+46 735 74 70 44', null, null, 57.1330, 18.3360, array['Gotland'], array['sv'], true, false, true, true, 'Gotland'),
('Herman Kullander', '+46 737 45 34 66', 'kullander85@gmail.com', null, 57.2730, 18.4630, array['Gotland','Fastlandet'], array['sv'], true, true, true, true, 'Stånga / Gotland — klipper även på fastlandet'),
('Magnus Svensson', '+46 702 76 26 18', null, null, 57.0850, 18.1670, array['Gotland'], array['sv'], true, true, true, true, 'Öja, Gotland');

DROP FUNCTION IF EXISTS public.nearest_shearers(double precision, double precision, integer, integer);

CREATE OR REPLACE FUNCTION public.nearest_shearers(user_lat double precision, user_lng double precision, max_km integer DEFAULT 9999, max_results integer DEFAULT 200)
 RETURNS TABLE(id uuid, display_name text, phone text, email text, website text, languages text[], breed_specialties text[], service_areas text[], hourly_rate_sek integer, certified_by_farklipparforbundet boolean, listed_by_faravelsforbundet boolean, self_managed boolean, notes text, distance_km double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, display_name, phone, email, website, languages, breed_specialties, service_areas, hourly_rate_sek, certified_by_farklipparforbundet, listed_by_faravelsforbundet, self_managed, notes, distance_km
  from (
    select s.id, s.display_name, s.phone, s.email, s.website, s.languages, s.breed_specialties, s.service_areas, s.hourly_rate_sek,
      coalesce(s.certified_by_farklipparforbundet,false) as certified_by_farklipparforbundet,
      coalesce(s.listed_by_faravelsforbundet,false) as listed_by_faravelsforbundet,
      coalesce(s.self_managed,false) as self_managed,
      s.notes,
      (6371 * acos(
        cos(radians(user_lat)) * cos(radians(s.home_lat)) *
        cos(radians(s.home_lng) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(s.home_lat))
      ))::double precision as distance_km
    from public.shearers s
    where s.approved = true and s.active = true and s.home_lat is not null and s.home_lng is not null
  ) q
  where distance_km <= max_km
  order by distance_km asc
  limit max_results
$function$;

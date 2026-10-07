ALTER TABLE `protocols` ADD `noteTable` json;

UPDATE `protocols`
SET `noteTable` = JSON_OBJECT(
  'title', 'Bảng pha gel Zymography',
  'columns', JSON_ARRAY('Thành phần', 'Separating gel (7.5%)', 'Stacking gel (5%)'),
  'rows', JSON_ARRAY(
    JSON_ARRAY('Water', '0.85 mL', '1.172 mL'),
    JSON_ARRAY('30% Acrylamide', '1.25 mL', '0.268 mL'),
    JSON_ARRAY('1.5M Tris-HCl (pH 8.8)', '1.3 mL', '0 mL'),
    JSON_ARRAY('0.5M Tris-HCl (pH 6.8)', '0 mL', '0.52 mL'),
    JSON_ARRAY('Gelatin 10 mg/mL', '1.6 mL', '0 mL'),
    JSON_ARRAY('10% SDS', '50 µL', '20 µL'),
    JSON_ARRAY('10% APS', '50 µL', '20 µL'),
    JSON_ARRAY('TEMED', '5 µL', '2 µL'),
    JSON_ARRAY('Total volume', '5 mL', '2 mL'),
    JSON_ARRAY('Volume added to the cast', '4–4.5 mL', '1–1.5 mL')
  )
)
WHERE `slug` = 'zymography' AND `noteTable` IS NULL;

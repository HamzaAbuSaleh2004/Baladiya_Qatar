// Single source of truth for all report categories shown in the UI.
//
// Only categories with `active: true` actually fire the agent flow. The others
// appear as fully styled tiles, navigate to the same capture screen, and the
// agent will gently inform the citizen the category isn't yet supported.

export const CATEGORIES = [
  // Active (the two existing pilot categories)
  { key: 'pothole',         icon: 'add_road',          group: 'Roads & Streets',          en: 'Pothole / Road Damage',     ar: 'حفرة / تلف بالطريق',           active: true },
  { key: 'falling_tree',    icon: 'park',              group: 'Trees and Public Spaces',   en: 'Tree Hazard',               ar: 'خطر شجرة',                    active: true },

  // Waste & Street Cleaning
  { key: 'spill',           icon: 'sanitizer',         group: 'Waste and Street Cleaning', en: 'Street washing and spills', ar: 'انسكابات وتنظيف الشوارع' },
  { key: 'illegal_dump',    icon: 'delete_forever',    group: 'Waste and Street Cleaning', en: 'Illegal waste dumping',     ar: 'إلقاء نفايات بشكل غير قانوني' },
  { key: 'bin_bags',        icon: 'inventory_2',       group: 'Waste and Street Cleaning', en: 'Dumped bin bags',           ar: 'أكياس قمامة متروكة' },
  { key: 'dog_poo',         icon: 'pets',              group: 'Waste and Street Cleaning', en: 'Dog poo',                   ar: 'مخلفات الحيوانات' },
  { key: 'graffiti',        icon: 'palette',           group: 'Waste and Street Cleaning', en: 'Graffiti, posters',         ar: 'كتابات وملصقات على الجدران' },
  { key: 'litter',          icon: 'recycling',         group: 'Waste and Street Cleaning', en: 'Litter',                    ar: 'نفايات متناثرة' },
  { key: 'street_bins',     icon: 'delete',            group: 'Waste and Street Cleaning', en: 'Street bins',               ar: 'حاويات الشوارع' },

  // Roads & Streets
  { key: 'roadworks',       icon: 'construction',      group: 'Roads & Streets',           en: 'Roadworks',                 ar: 'أعمال الطرق' },
  { key: 'streetlight',     icon: 'wb_incandescent',   group: 'Roads & Streets',           en: 'Street lights',             ar: 'إنارة الشوارع' },
  { key: 'pavement',        icon: 'directions_walk',   group: 'Roads & Streets',           en: 'Pavement damage',           ar: 'تلف الأرصفة' },
  { key: 'drains',          icon: 'water_drop',        group: 'Roads & Streets',           en: 'Drains',                    ar: 'مصارف' },
  { key: 'signs',           icon: 'traffic',           group: 'Roads & Streets',           en: 'Signs and bollards',        ar: 'لافتات وحواجز' },

  // Vehicles, Bikes and E-scooters
  { key: 'illegal_park',    icon: 'no_crash',          group: 'Vehicles',                  en: 'Illegally parked vehicles', ar: 'وقوف غير قانوني' },
  { key: 'abandoned',       icon: 'directions_car',    group: 'Vehicles',                  en: 'Abandoned vehicles',        ar: 'مركبات مهملة' },
  { key: 'idling',          icon: 'air',               group: 'Vehicles',                  en: 'Engine running',            ar: 'محرّك يعمل بدون داعٍ' },
  { key: 'illegal_drive',   icon: 'block',             group: 'Vehicles',                  en: 'Illegal driving',           ar: 'قيادة مخالفة' },

  // Air and Light Pollution
  { key: 'air_pollution',   icon: 'masks',             group: 'Air and Light Pollution',   en: 'Smells, smoke or fumes',    ar: 'روائح أو دخان' },
  { key: 'light_pollution', icon: 'wb_iridescent',     group: 'Air and Light Pollution',   en: 'Light pollution',           ar: 'تلوّث ضوئي' },

  // Trees & Public Spaces (extra)
  { key: 'parks',           icon: 'forest',            group: 'Trees and Public Spaces',   en: 'Trees, parks or cemeteries',ar: 'حدائق ومتنزهات' },
];

export const ACTIVE_CATEGORY_KEYS = new Set(CATEGORIES.filter((c) => c.active).map((c) => c.key));

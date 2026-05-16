-- ============================================================
-- BoozeBoard — Catalogue de boissons preset
-- 1 unité = 10g d'alcool pur (norme française)
-- Formule : unités = volume_cl × degré% × 0.8 / 10
-- ============================================================

insert into drinks (party_id, name, emoji, volume_cl, alcohol_pct, is_preset) values
  (null, 'Bière 25cl (5°)',    '🍺', 25,  5,  true),
  (null, 'Bière 50cl (5°)',    '🍺', 50,  5,  true),
  (null, 'Pinte (5°)',         '🍺', 50,  5,  true),
  (null, 'Bière forte 33cl (8°)', '🍺', 33, 8,  true),
  (null, 'Verre de vin',       '🍷', 12,  12, true),
  (null, 'Coupe champagne',    '🥂', 10,  12, true),
  (null, 'Shot',               '🥃', 3,   40, true),
  (null, 'Cocktail standard',  '🍹', 20,  15, true),
  (null, 'Soft / Eau',         '💧', 25,  0,  true)
on conflict do nothing;

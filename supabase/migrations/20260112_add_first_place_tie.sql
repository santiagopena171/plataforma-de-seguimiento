-- Agregar campo para indicar si hay empate en primer lugar
ALTER TABLE race_results 
ADD COLUMN first_place_tie BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN race_results.first_place_tie IS 'Indica si hay empate en el primer lugar. Si es TRUE, los dos primeros elementos de official_order son los ganadores compartidos y no se otorga puntuación de segundo lugar.';

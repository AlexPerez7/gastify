-- OPCIONAL. Pasa las categorías por defecto a la paleta nueva (validada para
-- daltonismo y contraste en tema claro y oscuro; ver PALETTE en
-- src/lib/constants.js). Las categorías nuevas ya se crean con la paleta
-- nueva; esto es solo para cuentas que ya existían.
--
-- Solo toca las categorías que siguen con su color ORIGINAL exacto: si
-- cambiaste el color de alguna a mano, se respeta. Se puede correr más de
-- una vez sin efecto extra. Ingresos, Transferencias y Otros no cambian.

update categories set color = '#D95926' where id = 'comida'        and upper(color) = '#E8654F';
update categories set color = '#C98500' where id = 'transporte'    and upper(color) = '#F0B94A';
update categories set color = '#9085E9' where id = 'suscripciones' and upper(color) = '#9B87C4';
update categories set color = '#3987E5' where id = 'compras'       and upper(color) = '#5B9BD5';
update categories set color = '#D55181' where id = 'servicios'     and upper(color) = '#D98E52';
update categories set color = '#199E70' where id = 'salud'         and upper(color) = '#6FCF97';
update categories set color = '#008300' where id = 'efectivo'      and upper(color) = '#A0A8B4';

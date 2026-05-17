INSERT OR IGNORE INTO `factory_mappings` (`product_id`, `manufacturer_id`, `factory_code`, `factory_name`, `valid_from_month`)
SELECT products.id, manufacturers.id, 'SEID', 'SEID', '202604'
FROM products, manufacturers
WHERE products.code = 'LCD'
  AND manufacturers.code = 'LOCAL';
--> statement-breakpoint
INSERT OR IGNORE INTO `factory_mappings` (`product_id`, `manufacturer_id`, `factory_code`, `factory_name`, `valid_from_month`)
SELECT products.id, manufacturers.id, 'SKW', 'SKW', '202604'
FROM products, manufacturers
WHERE products.code = 'LCD'
  AND manufacturers.code = 'LOCAL';
--> statement-breakpoint
INSERT OR IGNORE INTO `factory_mappings` (`product_id`, `manufacturer_id`, `factory_code`, `factory_name`, `valid_from_month`)
SELECT products.id, manufacturers.id, 'MOKA', 'MOKA', '202604'
FROM products, manufacturers
WHERE products.code = 'LCD'
  AND manufacturers.code = 'LOCAL';
--> statement-breakpoint
INSERT OR IGNORE INTO `factory_mappings` (`product_id`, `manufacturer_id`, `factory_code`, `factory_name`, `valid_from_month`)
SELECT products.id, manufacturers.id, 'MTC', 'MTC', '202604'
FROM products, manufacturers
WHERE products.code = 'LCD'
  AND manufacturers.code = 'LOCAL';

INSERT OR IGNORE INTO `report_months` (`month_key`, `label`, `calendar_year`, `calendar_month`, `fiscal_year`, `fiscal_half`)
VALUES ('202603', 'March 2026', 2026, 3, 2025, 'LH');
--> statement-breakpoint
INSERT OR IGNORE INTO `report_scopes` (`report_month_id`, `product_id`, `manufacturer_id`)
SELECT report_months.id, products.id, manufacturers.id
FROM report_months, products, manufacturers
WHERE report_months.month_key = '202603'
  AND products.code = 'LCD'
  AND manufacturers.code = 'LOCAL';
--> statement-breakpoint
UPDATE `factory_mappings`
SET `valid_from_month` = '202603'
WHERE `product_id` = (SELECT `id` FROM `products` WHERE `code` = 'LCD')
  AND `manufacturer_id` = (SELECT `id` FROM `manufacturers` WHERE `code` = 'LOCAL')
  AND `factory_code` IN ('SEID', 'SKW', 'MOKA', 'MTC')
  AND `valid_from_month` > '202603';

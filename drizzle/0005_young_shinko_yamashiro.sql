CREATE TABLE `fqms_accumulated_model_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_scope_id` integer NOT NULL,
	`source_model_code` text NOT NULL,
	`report_model_code` text NOT NULL,
	`monitoring_file` text,
	`launching_month` text NOT NULL,
	`launching_period` integer NOT NULL,
	`accumulated_sales` integer DEFAULT 0 NOT NULL,
	`defect_qty` integer DEFAULT 0 NOT NULL,
	`non_defect_qty` integer DEFAULT 0 NOT NULL,
	`total_claim_qty` integer DEFAULT 0 NOT NULL,
	`source_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fqms_accumulated_model_rows_scope_source_unique` ON `fqms_accumulated_model_rows` (`report_scope_id`,`source_model_code`);--> statement-breakpoint
CREATE INDEX `fqms_accumulated_model_rows_scope_report_model_idx` ON `fqms_accumulated_model_rows` (`report_scope_id`,`report_model_code`);--> statement-breakpoint
INSERT OR IGNORE INTO `fqms_accumulated_model_rows` (`report_scope_id`, `source_model_code`, `report_model_code`, `monitoring_file`, `launching_month`, `launching_period`, `accumulated_sales`, `defect_qty`, `non_defect_qty`, `total_claim_qty`, `source_json`)
SELECT report_scopes.id, seed.source_model_code, seed.report_model_code, seed.monitoring_file, seed.launching_month, seed.launching_period, seed.accumulated_sales, seed.defect_qty, seed.non_defect_qty, seed.total_claim_qty, seed.source_json
FROM report_scopes
JOIN report_months ON report_months.id = report_scopes.report_month_id
JOIN products ON products.id = report_scopes.product_id
JOIN manufacturers ON manufacturers.id = report_scopes.manufacturer_id
CROSS JOIN (
	SELECT '2TC32GH3000I' AS source_model_code, '2T-C32GH3000I' AS report_model_code, '01-2TC32GH3000I.xlsx' AS monitoring_file, '202409' AS launching_month, 19 AS launching_period, 244357 AS accumulated_sales, 1528 AS defect_qty, 295 AS non_defect_qty, 1823 AS total_claim_qty, '{"proofSource":"scripts/proof-fqms-april.mjs"}' AS source_json
	UNION ALL SELECT '2TC43GH3000I', '2T-C43GH3000I', '02-2TC43GH3000I.xlsx', '202410', 18, 189895, 1587, 286, 1873, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '4TC43HJ6000I', '4T-C43HJ6000I', '03-4TC43HJ6000I.xlsx', '202506', 10, 32083, 157, 71, 228, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '4TC50HJ6000I', '4T-C50HJ6000I', '04-4TC50HJ6000I.xlsx', '202506', 10, 18604, 88, 49, 137, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '4TC55HJ6000I', '4T-C55HJ6000I', '05-4TC55HJ6000I.xlsx', '202506', 10, 16739, 60, 52, 112, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '4TC50HL6500I', '4T-C50HL6500I', '06-4TC50HL6500I.xlsx', '202506', 10, 2195, 7, 6, 13, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '4TC55HL6500I', '4T-C55HL6500I', '07-4TC55HL6500I.xlsx', '202506', 10, 2358, 6, 7, 13, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '4TC65HL6500I', '4T-C65HL6500I', '08-4TC65HL6500I.xlsx', '202506', 10, 1915, 15, 6, 21, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '4TC75HL6500I', '4T-C75HL6500I', '09-4TC75HL6500I.xlsx', '202506', 10, 723, 5, 4, 9, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '4TC65HJ6000I', '4T-C65HJ6000I', '10-4TC65HJ6000I.xlsx', '202506', 10, 9869, 48, 24, 72, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '4TC75HJ6000I', '4T-C75HJ6000I', '11-4TC75HJ6000I.xlsx', '202506', 10, 4142, 14, 21, 35, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '2TC24HD1500I', '2T-C24HD1500I', '12-2TC24HD1500I.xlsx', '202506', 10, 109235, 137, 48, 185, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '2TC32HD1500I', '2T-C32HD1500I', '13-2TC32HD1500I.xlsx', '202506', 10, 181591, 394, 145, 539, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
	UNION ALL SELECT '2TC43HD1500I', '2T-C43HD1500I', '14-2TC43HD1500I.xlsx', '202506', 10, 7620, 15, 11, 26, '{"proofSource":"scripts/proof-fqms-april.mjs"}'
) AS seed
WHERE report_months.month_key = '202604'
	AND products.code = 'LCD'
	AND manufacturers.code = 'LOCAL';
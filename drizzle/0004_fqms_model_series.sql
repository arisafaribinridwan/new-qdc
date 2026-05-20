CREATE TABLE `fqms_model_series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`manufacturer_id` integer NOT NULL,
	`factory_code` text NOT NULL,
	`model_code` text NOT NULL,
	`report_model_code` text NOT NULL,
	`launching_month` text NOT NULL,
	`valid_from_month` text NOT NULL,
	`valid_to_month` text,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fqms_model_series_scope_factory_model_unique` ON `fqms_model_series` (`product_id`,`manufacturer_id`,`factory_code`,`model_code`);--> statement-breakpoint
CREATE INDEX `fqms_model_series_scope_period_idx` ON `fqms_model_series` (`product_id`,`manufacturer_id`,`valid_from_month`,`valid_to_month`);--> statement-breakpoint
CREATE INDEX `fqms_model_series_report_model_idx` ON `fqms_model_series` (`product_id`,`manufacturer_id`,`report_model_code`);--> statement-breakpoint
INSERT OR IGNORE INTO `fqms_model_series` (`product_id`, `manufacturer_id`, `factory_code`, `model_code`, `report_model_code`, `launching_month`, `valid_from_month`, `valid_to_month`, `is_active`, `notes`)
SELECT products.id, manufacturers.id, seed.factory_code, seed.model_code, seed.report_model_code, seed.launching_month, seed.valid_from_month, seed.valid_to_month, seed.is_active, seed.notes
FROM products, manufacturers,
(
	SELECT 'SKW' AS factory_code, '2T-C32GH3000I' AS model_code, '2T-C32GH3000I' AS report_model_code, '202409' AS launching_month, '202409' AS valid_from_month, NULL AS valid_to_month, 1 AS is_active, NULL AS notes
	UNION ALL SELECT 'SKW', '2T-C43GH3000I', '2T-C43GH3000I', '202410', '202410', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '4T-C43HJ6000I', '4T-C43HJ6000I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '4T-C50HJ6000I', '4T-C50HJ6000I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '4T-C55HJ6000I', '4T-C55HJ6000I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '4T-C50HL6500I', '4T-C50HL6500I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '4T-C55HL6500I', '4T-C55HL6500I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '4T-C65HL6500I', '4T-C65HL6500I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '4T-C75HL6500I', '4T-C75HL6500I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '4T-C65HJ6000I', '4T-C65HJ6000I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '4T-C75HJ6000I', '4T-C75HJ6000I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '4TC75HJ6000IG', '4T-C75HJ6000I', '202506', '202506', NULL, 1, 'Mapped to 4T-C75HJ6000I'
	UNION ALL SELECT 'MOKA', '2T-C24HD1500I', '2T-C24HD1500I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '2TC24HD1400I', '2T-C24HD1500I', '202506', '202506', NULL, 1, 'Mapped to 2T-C24HD1500I'
	UNION ALL SELECT 'MOKA', '2T-C32HD1500I', '2T-C32HD1500I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '2T-C43HD1500I', '2T-C43HD1500I', '202506', '202506', NULL, 1, NULL
	UNION ALL SELECT 'MOKA', '2TC32HD1400I', '2T-C32HD1500I', '202506', '202506', NULL, 1, 'Mapped to 2T-C32HD1500I'
) AS seed
WHERE products.code = 'LCD'
	AND manufacturers.code = 'LOCAL';

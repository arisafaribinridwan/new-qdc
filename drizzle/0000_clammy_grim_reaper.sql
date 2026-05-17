CREATE TABLE `data_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_scope_id` integer NOT NULL,
	`import_type` text NOT NULL,
	`source_filename` text NOT NULL,
	`mode` text DEFAULT 'replace' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`header_json` text,
	`missing_headers_json` text,
	`warning_json` text,
	`replaced_import_id` integer,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `data_imports_scope_type_idx` ON `data_imports` (`report_scope_id`,`import_type`);--> statement-breakpoint
CREATE TABLE `export_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_scope_id` integer NOT NULL,
	`export_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`output_path` text,
	`validation_run_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`validation_run_id`) REFERENCES `validation_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `export_jobs_scope_idx` ON `export_jobs` (`report_scope_id`);--> statement-breakpoint
CREATE TABLE `factory_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`manufacturer_id` integer NOT NULL,
	`factory_code` text NOT NULL,
	`factory_name` text NOT NULL,
	`valid_from_month` text NOT NULL,
	`valid_to_month` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `factory_mappings_scope_factory_unique` ON `factory_mappings` (`product_id`,`manufacturer_id`,`factory_code`);--> statement-breakpoint
CREATE INDEX `factory_mappings_scope_idx` ON `factory_mappings` (`product_id`,`manufacturer_id`);--> statement-breakpoint
CREATE TABLE `fcost_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_scope_id` integer NOT NULL,
	`service_import_id` integer,
	`row_count` integer DEFAULT 0 NOT NULL,
	`parts_cost_rupiah` integer DEFAULT 0 NOT NULL,
	`labor_cost_rupiah` integer DEFAULT 0 NOT NULL,
	`transportation_cost_rupiah` integer DEFAULT 0 NOT NULL,
	`total_cost_rupiah` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'check' NOT NULL,
	`summary_json` text,
	`computed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_import_id`) REFERENCES `data_imports`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fcost_summaries_scope_unique` ON `fcost_summaries` (`report_scope_id`);--> statement-breakpoint
CREATE TABLE `fqms_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_scope_id` integer NOT NULL,
	`sales_import_id` integer,
	`service_import_id` integer,
	`sales_quantity` integer DEFAULT 0 NOT NULL,
	`claim_quantity` integer DEFAULT 0 NOT NULL,
	`defect_count` integer DEFAULT 0 NOT NULL,
	`non_defect_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'check' NOT NULL,
	`summary_json` text,
	`computed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sales_import_id`) REFERENCES `data_imports`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`service_import_id`) REFERENCES `data_imports`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fqms_summaries_scope_unique` ON `fqms_summaries` (`report_scope_id`);--> statement-breakpoint
CREATE TABLE `manufacturers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manufacturers_code_unique` ON `manufacturers` (`code`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);--> statement-breakpoint
CREATE TABLE `raw_sales_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer NOT NULL,
	`report_scope_id` integer NOT NULL,
	`row_number` integer NOT NULL,
	`sales_month` text NOT NULL,
	`factory_code` text,
	`model_code` text,
	`model_name` text,
	`quantity` integer DEFAULT 0 NOT NULL,
	`raw_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `data_imports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `raw_sales_rows_import_idx` ON `raw_sales_rows` (`import_id`);--> statement-breakpoint
CREATE INDEX `raw_sales_rows_scope_month_idx` ON `raw_sales_rows` (`report_scope_id`,`sales_month`);--> statement-breakpoint
CREATE TABLE `raw_service_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer NOT NULL,
	`report_scope_id` integer NOT NULL,
	`row_number` integer NOT NULL,
	`keydate` text NOT NULL,
	`factory_code` text,
	`model_code` text,
	`model_name` text,
	`job_sheet_section` integer,
	`symptom_code` text,
	`symptom_name` text,
	`parts_cost` integer DEFAULT 0 NOT NULL,
	`labor_cost` integer DEFAULT 0 NOT NULL,
	`transportation_cost` integer DEFAULT 0 NOT NULL,
	`total_cost` integer DEFAULT 0 NOT NULL,
	`raw_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `data_imports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `raw_service_rows_import_idx` ON `raw_service_rows` (`import_id`);--> statement-breakpoint
CREATE INDEX `raw_service_rows_scope_keydate_idx` ON `raw_service_rows` (`report_scope_id`,`keydate`);--> statement-breakpoint
CREATE TABLE `report_months` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month_key` text NOT NULL,
	`label` text NOT NULL,
	`calendar_year` integer NOT NULL,
	`calendar_month` integer NOT NULL,
	`fiscal_year` integer NOT NULL,
	`fiscal_half` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_months_month_key_unique` ON `report_months` (`month_key`);--> statement-breakpoint
CREATE TABLE `report_scopes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_month_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`manufacturer_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_month_id`) REFERENCES `report_months`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_scopes_month_product_manufacturer_unique` ON `report_scopes` (`report_month_id`,`product_id`,`manufacturer_id`);--> statement-breakpoint
CREATE TABLE `validation_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`validation_run_id` integer NOT NULL,
	`code` text NOT NULL,
	`severity` text NOT NULL,
	`reason` text NOT NULL,
	`related_page` text,
	`related_data_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`validation_run_id`) REFERENCES `validation_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `validation_issues_run_idx` ON `validation_issues` (`validation_run_id`);--> statement-breakpoint
CREATE TABLE `validation_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_scope_id` integer NOT NULL,
	`status` text DEFAULT 'check' NOT NULL,
	`critical_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`summary_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `validation_runs_scope_idx` ON `validation_runs` (`report_scope_id`);--> statement-breakpoint
INSERT INTO `products` (`code`, `name`) VALUES ('LCD', 'LCD');--> statement-breakpoint
INSERT INTO `manufacturers` (`code`, `name`) VALUES ('LOCAL', 'LOCAL');--> statement-breakpoint
INSERT INTO `report_months` (`month_key`, `label`, `calendar_year`, `calendar_month`, `fiscal_year`, `fiscal_half`) VALUES ('202604', 'April 2026', 2026, 4, 2026, 'FH');--> statement-breakpoint
INSERT INTO `report_scopes` (`report_month_id`, `product_id`, `manufacturer_id`)
SELECT report_months.id, products.id, manufacturers.id
FROM report_months, products, manufacturers
WHERE report_months.month_key = '202604'
  AND products.code = 'LCD'
  AND manufacturers.code = 'LOCAL';--> statement-breakpoint
INSERT INTO `factory_mappings` (`product_id`, `manufacturer_id`, `factory_code`, `factory_name`, `valid_from_month`)
SELECT products.id, manufacturers.id, 'SEID', 'SEID', '202604'
FROM products, manufacturers
WHERE products.code = 'LCD'
  AND manufacturers.code = 'LOCAL';
CREATE TABLE IF NOT EXISTS `fqms_historical_defect_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_scope_id` integer NOT NULL,
	`source_model_code` text NOT NULL,
	`report_model_code` text NOT NULL,
	`monitoring_file` text NOT NULL,
	`row_number` integer NOT NULL,
	`notification` text,
	`keydate` text NOT NULL,
	`job_sheet_section` integer,
	`factory_code` text,
	`action` text,
	`defect_category` text,
	`defect` text,
	`raw_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `fqms_historical_defect_rows_scope_file_row_unique` ON `fqms_historical_defect_rows` (`report_scope_id`,`monitoring_file`,`row_number`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `fqms_historical_defect_rows_scope_keydate_idx` ON `fqms_historical_defect_rows` (`report_scope_id`,`keydate`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `fqms_historical_defect_rows_scope_model_idx` ON `fqms_historical_defect_rows` (`report_scope_id`,`report_model_code`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `fqms_historical_defect_rows_scope_defect_idx` ON `fqms_historical_defect_rows` (`report_scope_id`,`defect_category`,`defect`);

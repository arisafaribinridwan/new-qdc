CREATE TABLE `fqms_monitoring_monthly_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_scope_id` integer NOT NULL,
	`source_model_code` text NOT NULL,
	`report_model_code` text NOT NULL,
	`monitoring_file` text NOT NULL,
	`month_key` text NOT NULL,
	`passing_month` integer,
	`sales_qty` integer,
	`accumulated_sales` integer,
	`monthly_defect_qty` integer DEFAULT 0 NOT NULL,
	`accumulated_defect_qty` integer DEFAULT 0 NOT NULL,
	`monthly_non_defect_qty` integer DEFAULT 0 NOT NULL,
	`average_defect_ppm` real,
	`source_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fqms_monitoring_monthly_snapshots_scope_file_month_unique` ON `fqms_monitoring_monthly_snapshots` (`report_scope_id`,`monitoring_file`,`month_key`);--> statement-breakpoint
CREATE INDEX `fqms_monitoring_monthly_snapshots_scope_month_idx` ON `fqms_monitoring_monthly_snapshots` (`report_scope_id`,`month_key`);--> statement-breakpoint
CREATE INDEX `fqms_monitoring_monthly_snapshots_scope_model_idx` ON `fqms_monitoring_monthly_snapshots` (`report_scope_id`,`report_model_code`);

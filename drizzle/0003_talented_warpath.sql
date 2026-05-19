CREATE TABLE `master_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`category` text NOT NULL,
	`defect` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `master_actions_action_unique` ON `master_actions` (`action`);--> statement-breakpoint
CREATE INDEX `master_actions_action_idx` ON `master_actions` (`action`);--> statement-breakpoint
INSERT INTO `master_actions` (`action`, `category`, `defect`) VALUES
('EXPLANATION', 'NON_DEFECT', 'EXPLANATION'),
('REPAIR_MAIN_UNIT', 'DEFECT', 'MAIN_UNIT'),
('REPLACE_MAIN_UNIT', 'DEFECT', 'MAIN_UNIT'),
('BEFORE_IMPROVE', 'N/A', 'N/A'),
('BEFORE_IMPROVE_REMOTE', 'N/A', 'N/A'),
('CANCEL', 'N/A', 'N/A'),
('EXTERNAL', 'N/A', 'N/A'),
('REPLACE_PANEL_BEFORE_CHANGE', 'N/A', 'N/A'),
('SUBTITUSI', 'N/A', 'N/A'),
('VERIFIED_OK', 'N/A', 'N/A'),
('ZY', 'N/A', 'N/A'),
('REINSERT_CABINET', 'DEFECT', 'OTHER'),
('REINSERT_LVDS', 'DEFECT', 'OTHER'),
('REINSERT_SOCKET', 'DEFECT', 'OTHER'),
('REINSERT_SPEAKER', 'DEFECT', 'OTHER'),
('REINSERT_WIFI_UNIT', 'DEFECT', 'OTHER'),
('REPAIR_IR_UNIT', 'DEFECT', 'OTHER'),
('REPAIR_LED_BAR', 'DEFECT', 'OTHER'),
('REPAIR_LVDS', 'DEFECT', 'OTHER'),
('REPAIR_REMOTE', 'DEFECT', 'OTHER'),
('REPAIR_SHEET', 'DEFECT', 'OTHER'),
('REPAIR_SPEAKER', 'DEFECT', 'OTHER'),
('REPAIR_TCON', 'DEFECT', 'OTHER'),
('REPAIR_TCON_UNIT', 'DEFECT', 'OTHER'),
('REPAIR_WIFI_UNIT', 'DEFECT', 'OTHER'),
('REPLACE SWITCH', 'DEFECT', 'OTHER'),
('REPLACE_AC_CORD', 'DEFECT', 'OTHER'),
('REPLACE_FFC_WIRE', 'DEFECT', 'OTHER'),
('REPLACE_IR_UNIT', 'DEFECT', 'OTHER'),
('REPLACE_LED_BAR', 'DEFECT', 'OTHER'),
('REPLACE_LVDS_WIRE', 'DEFECT', 'OTHER'),
('REPLACE_REMOTE', 'DEFECT', 'OTHER'),
('REPLACE_SPEAKER', 'DEFECT', 'OTHER'),
('REPLACE_TAPE', 'DEFECT', 'OTHER'),
('REPLACE_TCON_UNIT', 'DEFECT', 'OTHER'),
('REPLACE_WIFI_UNIT', 'DEFECT', 'OTHER'),
('REPAIR_PANEL', 'DEFECT', 'PANEL'),
('REPLACE_PANEL', 'DEFECT', 'PANEL'),
('REPAIR_POWER_UNIT', 'DEFECT', 'POWER_UNIT'),
('REPLACE_POWER_UNIT', 'DEFECT', 'POWER_UNIT'),
('SETTING', 'NON_DEFECT', 'SETTING'),
('SIGNAL', 'NON_DEFECT', 'SIGNAL'),
('FACTORY_RESET', 'DEFECT', 'SOFTWARE'),
('UPGRADE', 'DEFECT', 'SOFTWARE'),
('USER', 'NON_DEFECT', 'USER');--> statement-breakpoint
CREATE TABLE `raw_service_line_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_scope_id` integer NOT NULL,
	`notification` text NOT NULL,
	`line_key` text NOT NULL,
	`override_symptom` text,
	`override_action` text,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_scope_id`) REFERENCES `report_scopes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `raw_service_line_overrides_scope_line_unique` ON `raw_service_line_overrides` (`report_scope_id`,`line_key`);--> statement-breakpoint
CREATE INDEX `raw_service_line_overrides_scope_notification_idx` ON `raw_service_line_overrides` (`report_scope_id`,`notification`);--> statement-breakpoint
ALTER TABLE `raw_service_rows` ADD `notification` text;--> statement-breakpoint
ALTER TABLE `raw_service_rows` ADD `line_key` text;--> statement-breakpoint
ALTER TABLE `raw_service_rows` ADD `row_hash` text;--> statement-breakpoint
ALTER TABLE `raw_service_rows` ADD `action` text;--> statement-breakpoint
ALTER TABLE `raw_service_rows` ADD `source_defect_category` text;--> statement-breakpoint
ALTER TABLE `raw_service_rows` ADD `source_defect` text;--> statement-breakpoint
CREATE INDEX `raw_service_rows_scope_notification_idx` ON `raw_service_rows` (`report_scope_id`,`notification`);--> statement-breakpoint
CREATE INDEX `raw_service_rows_scope_line_key_idx` ON `raw_service_rows` (`report_scope_id`,`line_key`);

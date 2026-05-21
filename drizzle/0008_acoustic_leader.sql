CREATE TABLE `sales_history_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`manufacturer_id` integer NOT NULL,
	`report_model_code` text NOT NULL,
	`sales_month` text NOT NULL,
	`sales_qty` integer DEFAULT 0 NOT NULL,
	`sales_amount_rupiah` integer DEFAULT 0 NOT NULL,
	`source_filename` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_history_rows_scope_model_month_unique` ON `sales_history_rows` (`product_id`,`manufacturer_id`,`report_model_code`,`sales_month`);--> statement-breakpoint
CREATE INDEX `sales_history_rows_scope_month_idx` ON `sales_history_rows` (`product_id`,`manufacturer_id`,`sales_month`);--> statement-breakpoint
CREATE INDEX `sales_history_rows_scope_model_idx` ON `sales_history_rows` (`product_id`,`manufacturer_id`,`report_model_code`);--> statement-breakpoint
ALTER TABLE `raw_sales_rows` ADD `sales_amount_rupiah` integer DEFAULT 0 NOT NULL;
ALTER TABLE "elements" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."element_type";--> statement-breakpoint
CREATE TYPE "public"."element_type" AS ENUM('shape', 'text', 'arrow', 'freehand');--> statement-breakpoint
ALTER TABLE "elements" ALTER COLUMN "type" SET DATA TYPE "public"."element_type" USING "type"::"public"."element_type";
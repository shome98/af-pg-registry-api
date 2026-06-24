CREATE TYPE "public"."database_type" AS ENUM('MongoDB');--> statement-breakpoint
CREATE TYPE "public"."api_permission" AS ENUM('SCRUD', 'SCRUDQ', 'MCRUD', 'MCRUDQ');--> statement-breakpoint
CREATE TYPE "public"."text_index_strategy" AS ENUM('wildcard', 'explicit');--> statement-breakpoint
CREATE TABLE "MongoDbApis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"apiId" varchar(32) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"apiKeyHash" varchar(64) NOT NULL,
	"apiKeyUpdatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"dbName" varchar(64),
	"dbUri" text,
	"databaseType" "database_type" DEFAULT 'MongoDB' NOT NULL,
	"permission" "api_permission" NOT NULL,
	"recordDefinitions" jsonb NOT NULL,
	"endpoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"softDelete" boolean DEFAULT false NOT NULL,
	"textIndexStrategy" text_index_strategy,
	"hasDocsAccess" boolean DEFAULT false NOT NULL,
	"rateLimit" integer DEFAULT 10000 NOT NULL,
	"corsPolicy" jsonb,
	"provisionedUser" varchar(128),
	"expirationTime" timestamp with time zone NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "MongoDbApis_apiId_unique" UNIQUE("apiId")
);
--> statement-breakpoint
CREATE INDEX "idx_mongo_apis_userId" ON "MongoDbApis" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_mongo_apis_isActive" ON "MongoDbApis" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "idx_mongo_apis_expirationTime" ON "MongoDbApis" USING btree ("expirationTime");--> statement-breakpoint
CREATE INDEX "idx_mongo_apis_userId_isActive" ON "MongoDbApis" USING btree ("userId","isActive");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mongo_apis_apiId" ON "MongoDbApis" USING btree ("apiId");
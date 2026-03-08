-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "parent_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "folder_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "content_plain" TEXT NOT NULL DEFAULT '',
    "source_type" VARCHAR(50) NOT NULL DEFAULT 'manual',
    "source_url" TEXT,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_tags" (
    "document_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "document_tags_pkey" PRIMARY KEY ("document_id","tag_id")
);

-- CreateTable
CREATE TABLE "document_images" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "document_id" UUID,
    "filename" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" VARCHAR(255) NOT NULL DEFAULT '新对话',
    "mode" VARCHAR(20) NOT NULL DEFAULT 'general',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "conversation_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "token_usage" JSONB,
    "model" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "folders_parent_id_idx" ON "folders"("parent_id");

-- CreateIndex
CREATE INDEX "documents_folder_id_idx" ON "documents"("folder_id");

-- CreateIndex
CREATE INDEX "documents_is_archived_idx" ON "documents"("is_archived");

-- CreateIndex
CREATE INDEX "documents_created_at_idx" ON "documents"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "document_tags_tag_id_idx" ON "document_tags"("tag_id");

-- CreateIndex
CREATE INDEX "document_images_document_id_idx" ON "document_images"("document_id");

-- CreateIndex
CREATE INDEX "conversations_is_archived_idx" ON "conversations"("is_archived");

-- CreateIndex
CREATE INDEX "conversations_updated_at_idx" ON "conversations"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_images" ADD CONSTRAINT "document_images_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

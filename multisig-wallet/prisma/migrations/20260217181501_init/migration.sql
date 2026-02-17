-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "vault_address" TEXT,
    "created_at" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "signers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wallet_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "added_at" INTEGER NOT NULL,
    "joined_at" INTEGER,
    CONSTRAINT "signers_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet_id" TEXT NOT NULL,
    "signer_name" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "expires_at" INTEGER NOT NULL,
    "used_by" TEXT,
    "used_at" INTEGER,
    CONSTRAINT "invites_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "proposal_type" TEXT NOT NULL DEFAULT 'transfer',
    "target_chain" INTEGER NOT NULL,
    "token" TEXT NOT NULL DEFAULT 'native',
    "recipient" TEXT NOT NULL,
    "amount" TEXT NOT NULL DEFAULT '0',
    "calldata" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "required_approvals" INTEGER NOT NULL,
    "created_at" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL,
    "executed_at" INTEGER,
    "executed_by" TEXT,
    "tx_hash" TEXT,
    CONSTRAINT "proposals_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "proposal_votes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposal_id" TEXT NOT NULL,
    "voter_key_hash" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "voted_at" INTEGER NOT NULL,
    CONSTRAINT "proposal_votes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipient_key_hash" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "proposal_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" INTEGER NOT NULL,
    CONSTRAINT "notifications_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "signers_wallet_id_idx" ON "signers"("wallet_id");

-- CreateIndex
CREATE INDEX "signers_key_hash_idx" ON "signers"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "signers_wallet_id_key_hash_key" ON "signers"("wallet_id", "key_hash");

-- CreateIndex
CREATE INDEX "invites_wallet_id_idx" ON "invites"("wallet_id");

-- CreateIndex
CREATE INDEX "proposals_wallet_id_idx" ON "proposals"("wallet_id");

-- CreateIndex
CREATE INDEX "proposal_votes_proposal_id_idx" ON "proposal_votes"("proposal_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_votes_proposal_id_voter_key_hash_key" ON "proposal_votes"("proposal_id", "voter_key_hash");

-- CreateIndex
CREATE INDEX "notifications_recipient_key_hash_idx" ON "notifications"("recipient_key_hash");

-- CreateIndex
CREATE INDEX "notifications_wallet_id_idx" ON "notifications"("wallet_id");

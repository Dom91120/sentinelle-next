-- CreateTable
CREATE TABLE "software_certificate" (
    "software_id" INTEGER NOT NULL,
    "certificate_id" INTEGER NOT NULL,

    CONSTRAINT "software_certificate_pkey" PRIMARY KEY ("software_id","certificate_id")
);

-- CreateIndex
CREATE INDEX "software_certificate_certificate_id_idx" ON "software_certificate"("certificate_id");

-- AddForeignKey
ALTER TABLE "software_certificate" ADD CONSTRAINT "software_certificate_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_certificate" ADD CONSTRAINT "software_certificate_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

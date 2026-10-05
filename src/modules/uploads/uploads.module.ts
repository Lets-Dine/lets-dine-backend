import { Module } from "@nestjs/common";
import { CreateUploadSignatureUsecase } from "./application/use-cases/create-upload-signature.usecase";
import { UploadController } from "./interfaces/http/upload.controller";

@Module({
  controllers: [UploadController],
  providers: [CreateUploadSignatureUsecase],
  exports: [CreateUploadSignatureUsecase],
})
export class UploadsModule {}

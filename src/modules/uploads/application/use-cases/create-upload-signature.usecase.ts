import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { BadRequestException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { UPLOAD_ERROR_MESSAGES } from "../../domain/constants";
import { CreateUploadSignatureInput } from "../../interfaces/http/validations/create-upload-signature.validation";

const FOLDER_BY_TARGET: Record<CreateUploadSignatureInput["target"], string> = {
  dish: "dishes",
  "restaurant-cover": "restaurant-covers",
  "restaurant-logo": "restaurant-logos",
};

export interface IUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

/**
 * The UI uploads straight to Cloudinary — this just hands it a signed,
 * time-boxed permission slip scoped to the caller's own restaurant folder,
 * so the API secret never reaches the browser.
 */
@Injectable()
export class CreateUploadSignatureUsecase {
  execute(dto: CreateUploadSignatureInput, authEntity: AuthEntity): IUploadSignature {
    return this.sign(`lets-dine/${authEntity.restaurantId}/${FOLDER_BY_TARGET[dto.target]}`);
  }

  sign(folder: string): IUploadSignature {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException(UPLOAD_ERROR_MESSAGES.NOT_CONFIGURED);
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Cloudinary's signing rule: every param the UI will send (except file/api_key/resource_type),
    // sorted by key, joined as `key=value&...`, with the API secret appended — then SHA-1 it.
    const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");

    return { cloudName, apiKey, timestamp, signature, folder };
  }
}

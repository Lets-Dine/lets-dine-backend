import { IHttpResponse, IResponseMessage } from "../interfaces/http-response.interface";

export function buildHttpResponse<T>(data: T, message: IResponseMessage): IHttpResponse<T> {
  return { data, message };
}

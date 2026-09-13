export interface IResponseMessage {
  key: string;
  message: string;
}

export interface IHttpResponse<T = unknown> {
  data: T;
  message?: IResponseMessage;
}

export type ActionResponse<T> = {
  success: boolean;
  error?: string;
  data?: T;
  status?: number;
};

/**
 * @description
 * Defines a standard return type for server actions. This provides a consistent
 * structure for handling success and error states across the application.
 *
 * @template T - The type of the data returned on success.
 */
export type ActionState<T> =
  | { isSuccess: true; message: string; data: T }
  | { isSuccess: false; message: string; data?: never }

import { ColorVariant } from "./Product";

export interface FallbackSuccess {
  status: string;
  item: ColorVariant;
}

export interface FallbackError {
  status: string;
  item: ColorVariant;
  error: string;
}

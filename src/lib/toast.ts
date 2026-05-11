import { toast as sonner } from "sonner";
import { haptic } from "@/lib/haptics";

/**
 * Standardized toast helpers. Adds haptic feedback + consistent options.
 * Prefer these over calling `sonner` directly so success/error feel uniform.
 */
export const toast = {
  success(message: string, opts?: { description?: string }) {
    haptic("success");
    return sonner.success(message, { duration: 2800, ...opts });
  },
  error(message: string, opts?: { description?: string }) {
    haptic("error");
    return sonner.error(message, { duration: 4000, ...opts });
  },
  info(message: string, opts?: { description?: string }) {
    return sonner(message, { duration: 2800, ...opts });
  },
  warning(message: string, opts?: { description?: string }) {
    haptic("tap");
    return sonner.warning(message, { duration: 3500, ...opts });
  },
  loading(message: string) {
    return sonner.loading(message);
  },
  dismiss(id?: string | number) {
    sonner.dismiss(id);
  },
};

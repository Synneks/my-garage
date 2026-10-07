import { useTranslation } from "react-i18next";
import type { TranslationKey } from "@/i18n";

export function TranslatedMessage({ message }: { message: TranslationKey }) {
  const { t } = useTranslation();
  return <>{t(message)}</>;
}

import { useTranslation } from "react-i18next";
import type { Language } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function LanguageOption({ language }: { language: Language }) {
  return (
    <span className="language-option">
      <svg
        className="language-flag"
        width="20"
        height="14"
        viewBox="0 0 60 42"
        aria-hidden="true"
        focusable="false"
      >
        {language === "ro" ? (
          <>
            <path fill="#002b7f" d="M0 0h20v42H0z" />
            <path fill="#fcd116" d="M20 0h20v42H20z" />
            <path fill="#ce1126" d="M40 0h20v42H40z" />
          </>
        ) : (
          <>
            <path fill="#012169" d="M0 0h60v42H0z" />
            <path stroke="#fff" strokeWidth="10" d="m0 0 60 42M60 0 0 42" />
            <path stroke="#c8102e" strokeWidth="4" d="m0 0 60 42M60 0 0 42" />
            <path stroke="#fff" strokeWidth="14" d="M30 0v42M0 21h60" />
            <path stroke="#c8102e" strokeWidth="8" d="M30 0v42M0 21h60" />
          </>
        )}
      </svg>
      <span aria-hidden="true">{language.toUpperCase()}</span>
      <span className="sr-only" lang={language}>
        {language === "en" ? "English" : "Română"}
      </span>
    </span>
  );
}

export function LanguageSelector({
  onChange,
}: {
  onChange: (language: Language) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <Select
      value={i18n.resolvedLanguage}
      onValueChange={(value) => onChange(value as Language)}
    >
      <SelectTrigger
        className="language-selector"
        aria-label={t("language.label")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="language-menu" position="popper" align="start">
        <SelectItem value="en" textValue="English">
          <LanguageOption language="en" />
        </SelectItem>
        <SelectItem value="ro" textValue="Română">
          <LanguageOption language="ro" />
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

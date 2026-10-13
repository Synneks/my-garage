import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import type { Theme } from "@/components/theme-provider";

export function ModeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          title={t("theme.toggle")}
        >
          <Sun
            aria-hidden="true"
            className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0"
          />
          <Moon
            aria-hidden="true"
            className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100"
          />
          <span className="sr-only">{t("theme.toggle")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as Theme)}
        >
          <DropdownMenuRadioItem value="light">
            {t("theme.light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            {t("theme.dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            {t("theme.system")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

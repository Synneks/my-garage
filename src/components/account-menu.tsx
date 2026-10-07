import { useTranslation } from "react-i18next";
import { locale } from "@/lib/format";
import type { User } from "firebase/auth";
import { LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AccountMenuProps {
  user: Pick<User, "photoURL" | "displayName" | "email">;
  disabled: boolean;
  onSignOut: () => Promise<void>;
}

export function AccountMenu({ user, disabled, onSignOut }: AccountMenuProps) {
  const { t } = useTranslation();
  const name = user.displayName?.trim();
  const email = user.email?.trim();
  const words = name ? name.split(/\s+/) : undefined;
  const initials = words
    ? words.length > 1
      ? `${words[0][0]}${words[words.length - 1][0]}`.toLocaleUpperCase(
          locale(),
        )
      : words[0].slice(0, 2).toLocaleUpperCase(locale())
    : email?.slice(0, 2).toLocaleUpperCase(locale());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="account-avatar-button"
          disabled={disabled}
          aria-label={t("auth.account_menu")}
        >
          <Avatar className="size-9" aria-hidden="true">
            <AvatarImage src={user.photoURL || undefined} alt="" />
            <AvatarFallback className="bg-secondary font-semibold text-secondary-foreground">
              {initials || <UserRound className="size-5" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-64 max-w-[calc(100vw-24px)]"
      >
        <DropdownMenuLabel className="space-y-1 [overflow-wrap:anywhere]">
          <p>{name || t("auth.my_account")}</p>
          {email && (
            <p className="text-xs font-normal text-muted-foreground">{email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11"
          disabled={disabled}
          onSelect={() => void onSignOut()}
        >
          <LogOut />
          {t("auth.sign_out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

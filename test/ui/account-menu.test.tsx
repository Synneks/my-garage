import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { AccountMenu } from "@/components/account-menu";
import { i18n } from "@/i18n";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

it("translates an open account menu immediately and preserves the sign-out action", async () => {
  const onSignOut = vi.fn().mockResolvedValue(undefined);
  render(
    <I18nextProvider i18n={i18n}>
      <AccountMenu
        user={{ displayName: null, email: "owner@example.com", photoURL: null }}
        disabled={false}
        onSignOut={onSignOut}
      />
    </I18nextProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
  expect(screen.getByText("My account")).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
  await act(async () => {
    await i18n.changeLanguage("ro");
  });
  expect(screen.getByText("Contul meu")).toBeTruthy();
  expect(screen.getByText("owner@example.com")).toBeTruthy();
  await userEvent.click(screen.getByRole("menuitem", { name: "Deconectare" }));
  expect(onSignOut).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Meniu cont" })).toBeTruthy();
});

it("preserves the user's display name and initials across languages", async () => {
  render(
    <I18nextProvider i18n={i18n}>
      <AccountMenu
        user={{
          displayName: "Ana Popescu",
          email: "ana@example.com",
          photoURL: null,
        }}
        disabled={false}
        onSignOut={vi.fn()}
      />
    </I18nextProvider>,
  );
  expect(screen.getByText("AP")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
  await act(async () => {
    await i18n.changeLanguage("ro");
  });
  expect(screen.getByText("Ana Popescu")).toBeTruthy();
  expect(screen.getByText("AP")).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Deconectare" })).toBeTruthy();
});

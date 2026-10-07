export function mockGoogleToken() {
  return JSON.stringify({
    sub: "bandit-emulator-owner",
    email: "bandit@example.test",
    email_verified: true,
    name: "Cont de test",
  });
}

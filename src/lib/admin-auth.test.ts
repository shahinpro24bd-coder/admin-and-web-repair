import { describe, expect, it } from "vitest";
import { emailToUsername, friendlyAuthError, usernameToEmail } from "./admin-auth";

describe("admin usernames", () => {
  it("maps a plain username to the private admin email", () => {
    expect(usernameToEmail(" Admin ")).toBe("admin@drlama-admin.app");
  });
  it("keeps a real email address as the login", () => {
    expect(usernameToEmail("Lama@Clinic.com")).toBe("lama@clinic.com");
  });
  it("shows the username again for display", () => {
    expect(emailToUsername("reception@drlama-admin.app")).toBe("reception");
  });
});

describe("auth error messages", () => {
  it("explains a rejected weak password", () => {
    expect(friendlyAuthError("Password is known to be weak and easy to guess, please choose a different one.")).toMatch(/too common/);
  });
  it("hides the raw invalid-credentials message", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe("Wrong username or password.");
  });
});

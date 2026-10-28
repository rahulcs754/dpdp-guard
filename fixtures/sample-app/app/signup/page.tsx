"use client";

export default function SignupPage() {
  return (
    <form action="/api/users" method="post">
      <input name="fullName" placeholder="Full name" />
      <input type="email" name="contactEmail" />
      <input name="mobile" type="tel" autoComplete="tel" />
      <input name="dob" type="date" />
      <input name="password" type="password" />
      <label>
        <input type="checkbox" name="marketingConsent" defaultChecked />
        Send me offers
      </label>
      <label>
        <input type="checkbox" name="rememberMe" defaultChecked />
        Remember me
      </label>
      <button type="submit">Sign up</button>
    </form>
  );
}

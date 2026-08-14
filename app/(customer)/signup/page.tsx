import type { Metadata } from "next";

import { EmailAuthForm } from "../EmailAuthForm";

export const metadata: Metadata = { title: "Załóż konto — ReviewGuide" };

export default function SignupPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <EmailAuthForm
        title="Załóż konto"
        subtitle="Podaj adres e-mail, a wyślemy Ci link do zalogowania. Bez hasła, 14 dni za darmo."
        submitLabel="Wyślij link"
        mode="signup"
      />
    </div>
  );
}

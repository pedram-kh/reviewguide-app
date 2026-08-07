import type { Metadata } from "next";

import { EmailAuthForm } from "../EmailAuthForm";

export const metadata: Metadata = { title: "Zaloguj się — ReviewGuide" };

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "Ten link jest nieprawidłowy, już wykorzystany lub wygasł. Wyślij nowy poniżej.",
  missing_token: "Brakuje tokenu w linku. Wyślij nowy link poniżej.",
  error: "Coś poszło nie tak przy logowaniu. Spróbuj ponownie.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <EmailAuthForm
        title="Zaloguj się"
        subtitle="Podaj adres e-mail użyty przy rejestracji — wyślemy Ci link logowania."
        submitLabel="Wyślij link"
        errorMessage={error ? ERROR_MESSAGES[error] : undefined}
      />
    </div>
  );
}

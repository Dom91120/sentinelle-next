"use client";

import { inferAdditionalFields, twoFactorClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Client Better Auth pour les composants React (déconnexion, état de session). */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: "string", required: false },
        authSource: { type: "string", required: false },
        twoFactorEnabled: { type: "boolean", required: false },
      },
    }),
    usernameClient(),
    twoFactorClient(),
  ],
});

export const { signIn, signOut, twoFactor } = authClient;

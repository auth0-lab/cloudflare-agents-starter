"use client";

import { useCallback, useEffect, useState } from "react";

import { WaitingMessage } from "../util/loader";
import { PromptUserContainer } from "../util/prompt-user-container";
import type { FederatedConnectionAuthProps } from "./FederatedConnectionAuthProps";

export function EnsureAPIAccessPopup({
  interrupt: { connection, requiredScopes, resume },
  connectWidget: { icon, title, description, action, containerClassName },
  auth: { authorizePath = "/auth/login", returnTo = "/close" } = {},
  onFinish,
}: FederatedConnectionAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loginPopup, setLoginPopup] = useState<Window | null>(null);

  //Poll for the login process until the popup is closed
  // or the user is authorized
  useEffect(() => {
    if (!loginPopup) {
      return;
    }
    const interval = setInterval(async () => {
      if (loginPopup?.closed) {
        setIsLoading(false);
        setLoginPopup(null);
        clearInterval(interval);
        if (typeof onFinish === "function") {
          try {
            onFinish();
          } catch (err) {
            console.error("EnsureAPIAccessPopup: onFinish threw:", err);
          }
        } else if (typeof resume === "function") {
          try {
            resume();
          } catch (err) {
            console.error("EnsureAPIAccessPopup: resume() threw:", err);
          }
        }
      }
    }, 1000);
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [loginPopup, onFinish, resume]);

  //Open the login popup
  const startLoginPopup = useCallback(async () => {
    const search = new URLSearchParams({
      return_to: returnTo,
      connection,
      scope: "openid profile email offline_access",
      access_type: "offline",
      prompt: "consent",
      connection_scope: requiredScopes.join(),
    });

    const url = new URL(authorizePath, window.location.origin);
    url.search = search.toString();

    const windowFeatures =
      "width=800,height=650,status=no,toolbar=no,menubar=no";
    const popup = window.open(url.toString(), "_blank", windowFeatures);
    if (!popup) {
      console.error("Popup blocked by the browser");
      return;
    }
    setLoginPopup(popup);
    setIsLoading(true);
  }, [connection, requiredScopes, authorizePath, returnTo]);

  if (isLoading) {
    return <WaitingMessage />;
  }

  return (
    <PromptUserContainer
      title={title}
      description={description}
      icon={icon}
      containerClassName={containerClassName}
      action={{
        label: action?.label ?? "Connect",
        onClick: startLoginPopup,
      }}
    />
  );
}

"use client";

import { useEffect } from "react";

// Profile page lives in Landing Page (njd-services.net/#profile).
// This route redirects there per CLAUDE.md strict rules.
export default function ProfilePage() {
  useEffect(() => {
    window.location.href = "https://njd-services.net/#profile";
  }, []);

  return null;
}
